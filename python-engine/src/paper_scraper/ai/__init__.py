"""
Paper Scraper AI Subsystem.
Provides section-aware paper chunking, grounding, local evaluation, and fine-tuning dataset preparation.
"""

from .chunker import chunk_pdf_document, chunk_text_content
from .finetuning import evaluate_hardware_capability, prepare_finetuning_dataset

__all__ = [
    "chunk_pdf_document",
    "chunk_text_content",
    "evaluate_hardware_capability",
    "prepare_finetuning_dataset",
]
