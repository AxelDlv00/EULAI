import os
import re
import json
import random
import argparse
import torch
from typing import Dict, List, Any

from datasets import load_dataset, Dataset
from transformers import AutoTokenizer, AutoModelForCausalLM, PreTrainedTokenizer
from trl import SFTConfig, SFTTrainer
from peft import LoraConfig, PeftModel
from rich.console import Console
from rich.panel import Panel
from rich.rule import Rule

os.environ["TOKENIZERS_PARALLELISM"] = "false"

class EULAITrainer:
    def __init__(self, config_path: str):
        self.console = Console()
        self.config = self._load_config(config_path)
        
        if not torch.cuda.is_available():
            self.console.print("[bold red]Erreur : CUDA n'est pas disponible. Le GPU n'est pas détecté.[/bold red]")
            exit(1)
            
        self.device = "cuda"
        self.tokenizer = self._setup_tokenizer()
        
    def _load_config(self, path: str) -> Dict[str, Any]:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _setup_tokenizer(self) -> PreTrainedTokenizer:
        model_id = self.config["model"]["id"]
        tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        return tokenizer

    def prepare_dataset(self) -> Dict[str, Dataset]:
        with self.console.status("[bold green]Chargement et formatage du dataset..."):
            raw_dataset = load_dataset(self.config["dataset"]["id"])
            
            def preprocess_function(example):
                # Utilisation des colonnes réelles : input et output
                messages = [
                    {"role": "system", "content": "Tu es un expert juridique. Analyse les clauses et réponds uniquement sous forme de liste : - [LABEL] : Titre : Explication."},
                    {"role": "user", "content": example["input"]},
                    {"role": "assistant", "content": example["output"]}
                ]
                text = self.tokenizer.apply_chat_template(
                    messages, 
                    tokenize=False, 
                    add_generation_prompt=False
                )
                return {"text": text}

            formatted_dataset = raw_dataset.map(
                preprocess_function, 
                remove_columns=raw_dataset["train"].column_names
            )
            return {"train": formatted_dataset["train"], "test": formatted_dataset["test"]}

    def train(self):
        self.console.print(Rule("[bold blue]Démarrage de l'entraînement sur GPU[/bold blue]"))
        
        dataset = self.prepare_dataset()
        train_cfg = self.config["training"]
        lora_cfg = self.config["lora"]

        # 1. Chargement explicite du modèle sur GPU avec Flash Attention
        self.console.print(f"[yellow]Chargement du modèle {self.config['model']['id']}...[/yellow]")
        model = AutoModelForCausalLM.from_pretrained(
            self.config["model"]["id"],
            torch_dtype=torch.bfloat16 if train_cfg["bf16"] else torch.float16,
            device_map="auto",
            attn_implementation="sdpa", # Optimisé pour RTX 4000
            trust_remote_code=True
        )
        
        # 2. Configuration LoRA
        peft_config = LoraConfig(
            r=lora_cfg["r"],
            lora_alpha=lora_cfg["lora_alpha"],
            target_modules=lora_cfg["target_modules"],
            lora_dropout=lora_cfg["lora_dropout"],
            bias=lora_cfg["bias"],
            task_type=lora_cfg["task_type"],
        )

        # 3. Configuration SFT
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
            packing=train_cfg["packing"],
            bf16=train_cfg["bf16"],
            dataset_text_field="text",
        )

        trainer = SFTTrainer(
            model=model,
            train_dataset=dataset["train"],
            eval_dataset=dataset["test"],
            peft_config=peft_config,
            args=training_args,
            processing_class=self.tokenizer,
        )

        trainer.train()
        
        self.console.print("[bold green]Succès ! Sauvegarde...[/bold green]")
        trainer.save_model(train_cfg["output_dir"])
        self.trainer_model = trainer.model

    def _parse_output(self, text: str) -> List[Dict[str, str]]:
        results = []
        # Supporte les formats avec ou sans tiret au début
        pattern = re.compile(r"-\s*\[(BAD|GOOD|NEUTRAL|BLOCKER)\]\s*:\s*([^:]+):\s*(.+)$", re.MULTILINE)
        
        for match in pattern.finditer(text):
            results.append({
                "label": match.group(1).upper(),
                "title": match.group(2).strip(),
                "explanation": match.group(3).strip()
            })
        return results

    def visualize(self):
        self.console.print(Rule("[bold magenta]Visualisation[/bold magenta]"))
        
        # Récupération du modèle (soit celui entraîné, soit chargement du checkpoint)
        if hasattr(self, 'trainer_model'):
            model = self.trainer_model
        else:
            self.console.print("[yellow]Chargement du modèle sauvegardé pour inférence...[/yellow]")
            base = AutoModelForCausalLM.from_pretrained(
                self.config["model"]["id"], 
                device_map="auto", 
                torch_dtype=torch.bfloat16 if self.config["training"]["bf16"] else torch.float16,
                trust_remote_code=True
            )
            model = PeftModel.from_pretrained(base, self.config["training"]["output_dir"])

        model.eval()
        
        # Chargement du dataset de test
        raw_test = load_dataset(self.config["dataset"]["id"], split="test")
        num_samples = min(self.config["inference"]["num_samples"], len(raw_test))
        indices = random.sample(range(len(raw_test)), num_samples)
        
        for i in indices:
            item = raw_test[i]
            messages = [
                {"role": "system", "content": "Tu es un expert juridique. Analyse les clauses et réponds uniquement sous forme de liste : - [LABEL] : Titre : Explication."},
                {"role": "user", "content": item['input']}
            ]
            
            # Préparation des inputs (Retourne un dictionnaire de tenseurs)
            inputs = self.tokenizer.apply_chat_template(
                messages, 
                add_generation_prompt=True, 
                return_tensors="pt"
            ).to(self.device)

            with torch.no_grad():
                # On décompresse le dictionnaire avec **
                outputs = model.generate(
                    **inputs, 
                    max_new_tokens=self.config["inference"]["max_new_tokens"],
                    temperature=self.config["inference"]["temperature"],
                    repetition_penalty=self.config["inference"].get("repetition_penalty", 1.1),
                    do_sample=True,
                    pad_token_id=self.tokenizer.eos_token_id
                )
            
            # Extraction uniquement de la partie générée (on ignore le prompt)
            # inputs['input_ids'].shape[-1] nous donne la longueur exacte du prompt
            generated_ids = outputs[0][inputs['input_ids'].shape[-1]:]
            generated_text = self.tokenizer.decode(generated_ids, skip_special_tokens=True)
            
            points = self._parse_output(generated_text)
            
            self.console.print(f"\n[bold blue]CONTRAT ID: {item.get('id', 'N/A')}[/bold blue]")
            
            if not points:
                # Si le regex échoue, on affiche tout de même la réponse brute pour déboguer
                self.console.print(Panel(generated_text, title="Sortie brute (Format non reconnu)", border_style="yellow"))
            else:
                for p in points:
                    style = {"BLOCKER": "red", "BAD": "red", "GOOD": "green", "NEUTRAL": "yellow"}.get(p['label'], "white")
                    self.console.print(Panel(f"[bold]{p['title']}[/bold]\n{p['explanation']}", title=p['label'], border_style=style))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=str, default="config.json")
    parser.add_argument("--train", action="store_true")
    parser.add_argument("--visualize", action="store_true")
    args = parser.parse_args()
    
    trainer = EULAITrainer(args.config)
    if args.train: trainer.train()
    if args.visualize: trainer.visualize()

if __name__ == "__main__":
    main()