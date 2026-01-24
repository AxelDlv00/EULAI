import os
import subprocess
import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

BASE_MODEL_ID = "Qwen/Qwen3-0.6B"
ADAPTER_ID = "AxelDlv00/EULAI"
MERGED_DIR = "./model_merged_temp"
MLC_OUTPUT_DIR = "./dist/EULAI-q4f16_1-MLC"
QUANTIZATION = "q4f16_1" 

def main():
    if not os.path.exists(MERGED_DIR):
        print(f"Merging {ADAPTER_ID} with the base model...")
        base_model = AutoModelForCausalLM.from_pretrained(
            BASE_MODEL_ID,
            torch_dtype=torch.float16,
            device_map="cpu", 
            trust_remote_code=True
        )
        model = PeftModel.from_pretrained(base_model, ADAPTER_ID)
        merged_model = model.merge_and_unload()
        merged_model.save_pretrained(MERGED_DIR)        
        tokenizer = AutoTokenizer.from_pretrained(ADAPTER_ID, trust_remote_code=True)
        tokenizer.save_pretrained(MERGED_DIR)
        print("Merge complete.")
    else:
        print(f"The {MERGED_DIR} directory already exists. Moving to conversion.")

    print("Generating optimized MLC configuration for the web...")
    cmd_config = [
        "python", "-m", "mlc_llm", "gen_config",
        MERGED_DIR,
        "--quantization", QUANTIZATION,
        "--conv-template", "chatml",
        "--model-type", "qwen3",
        "--context-window-size", "4096",
        "--prefill-chunk-size", "512",
        "-o", MLC_OUTPUT_DIR
    ]
    subprocess.run(cmd_config, check=True)
    subprocess.run(cmd_config, check=True)

    print("Converting weights to MLC format (via CPU to avoid Vulkan errors)...")
    cmd_convert = [
        "python", "-m", "mlc_llm", "convert_weight",
        MERGED_DIR,
        "--quantization", QUANTIZATION,
        "--model-type", "qwen3",
        "--device", "cpu",
        "-o", MLC_OUTPUT_DIR
    ]
    subprocess.run(cmd_convert, check=True)
    
    print("Compiling WebGPU binary (.wasm)...")
    wasm_path = os.path.join(MLC_OUTPUT_DIR, "EULAI-q4f16_1-webgpu.wasm")
    cmd_compile = [
        "python", "-m", "mlc_llm", "compile",
        os.path.join(MLC_OUTPUT_DIR, "mlc-chat-config.json"),
        "--device", "webgpu",
        "-o", wasm_path
    ]
    try:
        subprocess.run(cmd_compile, check=True)
    except Exception as e:
        print(f"Note: WASM compilation failed (often due to missing TVM).")
        print("You can use a pre-compiled WASM file from Qwen3 instead.")

    print(f"\nComplete! Your files are in: {MLC_OUTPUT_DIR}")

if __name__ == "__main__":
    main()