import os
import torch
import subprocess
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

BASE_MODEL_ID = "Qwen/Qwen3-0.6B"
ADAPTER_ID = "AxelDlv00/EULAI"
LLAMA_CPP_PATH = "./llama.cpp"
MERGED_DIR = "./model_merged_temp"
OUTPUT_DIR = "./gguf_models"
QUANTS = ["Q4_K_M"]

def main():
    if not os.path.exists(LLAMA_CPP_PATH):
         raise FileNotFoundError(f"Dossier llama.cpp introuvable : {LLAMA_CPP_PATH}")
    
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    base_gguf_path = os.path.join(OUTPUT_DIR, f"EULAI-merged-f16.gguf")

    if os.path.exists(base_gguf_path):
        print(f'The file {base_gguf_path} already exists. Skipping merge/conversion step.')
    else:
        base_model = AutoModelForCausalLM.from_pretrained(
            BASE_MODEL_ID,
            torch_dtype=torch.float16,
            device_map="auto",
            trust_remote_code=True
        )
        model = PeftModel.from_pretrained(base_model, ADAPTER_ID)
        merged_model = model.merge_and_unload()
        merged_model.save_pretrained(MERGED_DIR)
        
        tokenizer = AutoTokenizer.from_pretrained(ADAPTER_ID)
        tokenizer.save_pretrained(MERGED_DIR)

        convert_script = os.path.join(LLAMA_CPP_PATH, "convert_hf_to_gguf.py")
        
        cmd_convert = [
            "python", convert_script,
            MERGED_DIR,
            "--outfile", base_gguf_path,
            "--outtype", "f16"
        ]
        subprocess.run(cmd_convert, check=True)

    possible_paths = [
        os.path.join(LLAMA_CPP_PATH, "build", "bin", "llama-quantize"), 
        os.path.join(LLAMA_CPP_PATH, "llama-quantize"),                 
    ]
    
    quantize_bin = None
    for p in possible_paths:
        if os.path.exists(p):
            quantize_bin = p
            break
            
    if not quantize_bin:
        raise FileNotFoundError(f"Impossible de trouver llama-quantize. Cherché ici : {possible_paths}")
        
    for quant in QUANTS:
        final_filename = f"EULAI-{quant}.gguf"
        final_path = os.path.join(OUTPUT_DIR, final_filename)
        
        cmd_quant = [
            quantize_bin,
            base_gguf_path,
            final_path,
            quant
        ]
        
        try:
            subprocess.run(cmd_quant, check=True)
        except subprocess.CalledProcessError as e:
            print(f"Erreur lors de la quantification en {quant} : {e}")
            continue
        
if __name__ == "__main__":
    main()