"""
Paper Scraper AI Subsystem.
Provides section-aware paper chunking, grounding, local evaluation, and fine-tuning dataset preparation.
"""

from .chunker import chunk_pdf_document, chunk_text_content
from .finetuning import evaluate_hardware_capability, prepare_finetuning_dataset
from .signals import extract_document_file, compute_statistical_ai_signals

__all__ = [
    "chunk_pdf_document",
    "chunk_text_content",
    "evaluate_hardware_capability",
    "prepare_finetuning_dataset",
    "extract_document_file",
    "compute_statistical_ai_signals",
]
