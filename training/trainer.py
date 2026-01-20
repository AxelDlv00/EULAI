# ╔════════════════════════════════════════════════════════╗
# ║                          SFT                           ║
# ╚════════════════════════════════════════════════════════╝

# ╭────────────────────────────────────────────────────────╮
# │                        Packages                        │
# ╰────────────────────────────────────────────────────────╯

import os
import re
import json
import random
import argparse
import torch
from dataclasses import dataclass
from typing import Dict, List, Any, Optional

from datasets import load_dataset, Dataset
from transformers import AutoTokenizer, PreTrainedTokenizer
from trl import SFTConfig, SFTTrainer
from peft import LoraConfig
from rich.console import Console
from rich.panel import Panel
from rich.rule import Rule
from rich.status import Status

os.environ["TOKENIZERS_PARALLELISM"] = "false"

# ╭────────────────────────────────────────────────────────╮
# │                     Training class                     │
# ╰────────────────────────────────────────────────────────╯

class EULAITrainer:
    def __init__(self, config_path: str):
        self.console = Console()
        self.config = self._load_config(config_path)
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.tokenizer = self._setup_tokenizer()
        
    def _load_config(self, path: str) -> Dict[str, Any]:
        """Charge la configuration depuis un fichier JSON."""
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _setup_tokenizer(self) -> PreTrainedTokenizer:
        """Initialise et configure le tokenizer."""
        model_id = self.config["model"]["id"]
        trust_remote = self.config["model"].get("trust_remote_code", True)
        
        tokenizer = AutoTokenizer.from_pretrained(
            model_id, 
            trust_remote_code=trust_remote
        )
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        return tokenizer

    def prepare_dataset(self) -> Dict[str, Dataset]:
        """Charge et prépare le dataset pour le SFT."""
        with self.console.status("[bold green]Chargement et préparation du dataset..."):
            raw_dataset = load_dataset(self.config["dataset"]["id"])
            
            def preprocess_function(example):
                return {
                    "messages": [
                        {"role": "user", "content": example["policy"]},
                        {"role": "assistant", "content": example["summary"]}
                    ]
                }
            
            # Formatage
            formatted_dataset = raw_dataset.map(
                preprocess_function, 
                remove_columns=raw_dataset["train"].column_names
            )
            
            # On retourne le dataset complet pour le training (Packing s'occupe du reste)
            return {
                "train": formatted_dataset["train"],
                "test": formatted_dataset["test"]
            }

    def train(self):
        """Lance l'entraînement complet."""
        self.console.print(Rule("[bold blue]Démarrage de l'entraînement[/bold blue]"))
        
        dataset = self.prepare_dataset()
        train_cfg = self.config["training"]
        lora_cfg = self.config["lora"]
        
        # Configuration LoRA
        peft_config = LoraConfig(
            r=lora_cfg["r"],
            lora_alpha=lora_cfg["lora_alpha"],
            target_modules=lora_cfg["target_modules"],
            lora_dropout=lora_cfg["lora_dropout"],
            bias=lora_cfg["bias"],
            task_type=lora_cfg["task_type"],
        )

        # Configuration SFT
        training_args = SFTConfig(
            output_dir=train_cfg["output_dir"],
            per_device_train_batch_size=train_cfg["per_device_train_batch_size"],
            per_device_eval_batch_size=train_cfg["per_device_eval_batch_size"],
            gradient_accumulation_steps=train_cfg["gradient_accumulation_steps"],
            learning_rate=train_cfg["learning_rate"],
            num_train_epochs=train_cfg["num_train_epochs"],
            logging_steps=train_cfg["logging_steps"],
            save_strategy=train_cfg["save_strategy"],
            eval_strategy=train_cfg["eval_strategy"],
            lr_scheduler_type="cosine",
            warmup_ratio=train_cfg["warmup_ratio"],
            max_length=train_cfg["max_length"],
            packing=train_cfg["packing"], # Activation du packing ici
            dataset_kwargs={"add_special_tokens": False},
            bf16=train_cfg["bf16"] and torch.cuda.is_bf16_supported(),
            fp16=not (train_cfg["bf16"] and torch.cuda.is_bf16_supported()),
        )

        trainer = SFTTrainer(
            model=self.config["model"]["id"],
            train_dataset=dataset["train"],
            eval_dataset=dataset["test"],
            peft_config=peft_config,
            args=training_args,
            processing_class=self.tokenizer,
        )

        trainer.train()
        
        self.console.print("[bold green]Entraînement terminé. Sauvegarde du modèle...[/bold green]")
        trainer.save_model(train_cfg["output_dir"])
        self.trainer_model = trainer.model # Garde le modèle en mémoire pour l'inférence immédiate
        return trainer

    def _parse_output(self, text: str) -> List[Dict[str, str]]:
        """Parse la sortie du modèle pour extraire les labels structurés."""
        results = []
        pattern = re.compile(r"^-\s*\[(BAD|GOOD|NEUTRAL|BLOCKER)\]\s*:\s*([^:]+):\s*(.+)$", re.MULTILINE)
        
        for match in pattern.finditer(text):
            results.append({
                "label": match.group(1).upper(),
                "title": match.group(2).strip(),
                "explanation": match.group(3).strip()
            })
        return results

    def visualize(self, use_trained_model: bool = True):
        """Visualise les résultats sur des données de test brutes."""
        self.console.print(Rule("[bold magenta]Visualisation Inférence[/bold magenta]"))
        
        # Chargement du modèle si pas déjà fait
        if use_trained_model:
            # Si on vient de finir l'entraînement, on utilise self.trainer_model
            if hasattr(self, 'trainer_model'):
                model = self.trainer_model
            else:
                # Sinon on chargerait l'adapter sauvegardé (implémentation simplifiée ici)
                from peft import PeftModel, PeftConfig
                from transformers import AutoModelForCausalLM
                base_model = AutoModelForCausalLM.from_pretrained(
                    self.config["model"]["id"], 
                    device_map="auto", 
                    torch_dtype=torch.bfloat16
                )
                model = PeftModel.from_pretrained(base_model, self.config["training"]["output_dir"])
        else:
            # Cas théorique : modèle de base (peu utile ici)
            pass

        model.eval()
        
        # Chargement des données brutes pour test unitaire (NON-PACKÉES)
        try:
            raw_test = load_dataset(self.config["dataset"]["id"], split="test")
        except:
            raw_test = load_dataset(self.config["dataset"]["id"])["test"]

        # Sélection aléatoire
        num_samples = self.config["inference"]["num_samples"]
        indices = random.sample(range(len(raw_test)), min(num_samples, len(raw_test)))
        
        for i in indices:
            item = raw_test[i]
            self._run_single_inference(model, item)

    def _run_single_inference(self, model, item):
        """Exécute et affiche une inférence unique."""
        messages = [{"role": "user", "content": item['policy']}]
        
        try:
            inputs = self.tokenizer.apply_chat_template(
                messages, 
                tokenize=True, 
                add_generation_prompt=True, 
                return_tensors="pt",
                enable_thinking=False # Force le mode strict
            ).to(self.device)
        except TypeError:
             # Fallback ancienne version transformers
             inputs = self.tokenizer.apply_chat_template(
                messages, 
                tokenize=True, 
                add_generation_prompt=True, 
                return_tensors="pt"
            ).to(self.device)

        with torch.no_grad():
            outputs = model.generate(
                inputs, 
                max_new_tokens=self.config["inference"]["max_new_tokens"],
                temperature=self.config["inference"]["temperature"],
                do_sample=True,
                pad_token_id=self.tokenizer.eos_token_id
            )
        
        full_output = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        points = self._parse_output(full_output)
        
        self.console.print(f"\n[bold underline white on blue] TEST ID: {item.get('id', 'N/A')[:8]} [/bold underline white on blue]")
        
        if not points:
            self.console.print(Panel(full_output, title="⚠️ Raw Output (Format non détecté)", border_style="red"))
            return

        for p in points:
            label, title, expl = p['label'], p['title'], p['explanation']
            
            style_map = {
                "BLOCKER": ("white on red", "⛔", "red"),
                "BAD": ("red", "❌", "red"),
                "GOOD": ("green", "✅", "green"),
                "NEUTRAL": ("yellow", "ℹ️", "yellow")
            }
            
            color, icon, border = style_map.get(label, ("white", "❓", "white"))
            
            content = f"[{color}][bold]{title}[/bold][/{color}]\n[white]{expl}[/white]"
            self.console.print(Panel(content, title=f"{icon} {label}", border_style=border))

def main():
    parser = argparse.ArgumentParser(description="EULAI Training Pipeline pour Qwen3")
    parser.add_argument("--config", type=str, default="config.json", help="Chemin vers le fichier de config JSON")
    parser.add_argument("--train", action="store_true", help="Lancer l'entraînement")
    parser.add_argument("--visualize", action="store_true", help="Lancer la visualisation post-training")
    
    args = parser.parse_args()
    
    trainer = EULAITrainer(args.config)
    
    if args.train:
        trainer.train()
    
    if args.visualize:
        trainer.visualize(use_trained_model=True)

if __name__ == "__main__":
    main()