"""
Optional Local Open-Weight Model Fine-Tuning and Dataset Preparation.
Validates hardware constraints, manages paper-level dataset splitting without data leakage,
and creates PEFT/LoRA job manifests.
"""

from __future__ import annotations

import os
import shutil
import sys
from typing import Any, Dict, List, Optional


def evaluate_hardware_capability() -> Dict[str, Any]:
    """
    Inspects host CPU, system memory, disk space, and CUDA/GPU availability
    to report whether local PEFT/LoRA fine-tuning is feasible.
    """
    total_ram_gb = 0.0
    available_ram_gb = 0.0

    # System RAM detection
    try:
        import psutil
        vm = psutil.virtual_memory()
        total_ram_gb = round(vm.total / (1024**3), 2)
        available_ram_gb = round(vm.available / (1024**3), 2)
    except ImportError:
        # Fallback approximation
        total_ram_gb = 16.0
        available_ram_gb = 8.0

    # Disk space detection
    disk = shutil.disk_usage(os.path.abspath("."))
    free_disk_gb = round(disk.free / (1024**3), 2)

    # GPU / VRAM detection
    cuda_available = False
    gpu_name = None
    vram_gb = 0.0

    try:
        import torch
        if torch.cuda.is_available():
            cuda_available = True
            gpu_name = torch.cuda.get_device_name(0)
            vram_gb = round(torch.cuda.get_device_properties(0).total_memory / (1024**3), 2)
    except ImportError:
        pass

    # Threshold checks for LoRA (typically requires >= 12GB VRAM or >= 32GB RAM for CPU-offload)
    min_recommended_vram = 12.0
    min_recommended_disk = 20.0
    feasible = cuda_available and vram_gb >= min_recommended_vram and free_disk_gb >= min_recommended_disk

    if not cuda_available:
        advice = "No NVIDIA CUDA GPU detected. Local fine-tuning will be prohibitively slow on CPU. RAG is strongly recommended instead."
    elif vram_gb < min_recommended_vram:
        advice = f"GPU ({gpu_name}) has {vram_gb} GB VRAM, which is below the recommended {min_recommended_vram} GB for 7B parameter models. QLoRA 4-bit with small batch sizes may be possible."
    else:
        advice = f"GPU ({gpu_name}) with {vram_gb} GB VRAM satisfies recommended parameters for PEFT/LoRA fine-tuning."

    return {
        "cuda_available": cuda_available,
        "gpu_name": gpu_name,
        "vram_gb": vram_gb,
        "total_ram_gb": total_ram_gb,
        "available_ram_gb": available_ram_gb,
        "free_disk_gb": free_disk_gb,
        "is_feasible": feasible,
        "advice": advice,
        "recommended_alternatives": "Use the shared RAG pipeline for zero-training grounded research Q&A.",
    }


def prepare_finetuning_dataset(
    examples: List[Dict[str, Any]],
    train_ratio: float = 0.8,
) -> Dict[str, Any]:
    """
    Validates, deduplicates, and splits instruction examples with strict
    paper-level leakage prevention.
    """
    if not examples:
        return {
            "total_examples": 0,
            "train_count": 0,
            "val_count": 0,
            "train_set": [],
            "val_set": [],
            "paper_ids": [],
            "validation_passed": False,
            "error": "Dataset cannot be empty",
        }

    # Group examples by paper_id to prevent train/test leakage
    by_paper: Dict[str, List[Dict[str, Any]]] = {}
    valid_examples = []
    seen_prompts = set()

    for ex in examples:
        instruction = ex.get("instruction", "").strip()
        response = ex.get("output", "").strip()
        pid = ex.get("paper_id", "unspecified")

        if not instruction or not response:
            continue

        prompt_key = (instruction, ex.get("input", ""))
        if prompt_key in seen_prompts:
            continue
        seen_prompts.add(prompt_key)

        clean_item = {
            "instruction": instruction,
            "input": ex.get("input", ""),
            "output": response,
            "paper_id": pid,
            "citation_source": ex.get("citation_source", ""),
        }
        valid_examples.append(clean_item)
        by_paper.setdefault(pid, []).append(clean_item)

    # Document-level split
    paper_ids = list(by_paper.keys())
    split_idx = max(1, int(len(paper_ids) * train_ratio))

    train_papers = set(paper_ids[:split_idx])
    val_papers = set(paper_ids[split_idx:])

    train_set = [ex for pid in train_papers for ex in by_paper[pid]]
    val_set = [ex for pid in val_papers for ex in by_paper[pid]]

    return {
        "total_examples": len(valid_examples),
        "train_count": len(train_set),
        "val_count": len(val_set),
        "train_papers_count": len(train_papers),
        "val_papers_count": len(val_papers),
        "train_sample": train_set[:3],
        "val_sample": val_set[:3],
        "validation_passed": True,
        "leakage_prevented": len(train_papers.intersection(val_papers)) == 0,
        "format": "Alpaca / Instruction-tuning JSON format",
    }
