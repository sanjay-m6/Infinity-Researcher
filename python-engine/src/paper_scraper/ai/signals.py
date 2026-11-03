"""
Statistical linguistic feature extraction and document text extraction.
Calibrated for academic prose and research integrity analysis.
"""

from __future__ import annotations

import collections
import math
import os
import re
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter
from typing import Any, Dict, List, Tuple


def extract_document_file(file_path: str) -> Dict[str, Any]:
    """
    Safely reads text from .pdf, .docx, .txt, .md, .tex, or other academic document files.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File does not exist: {file_path}")

    ext = os.path.splitext(file_path)[1].lower()
    raw_text = ""
    page_count = 1

    if ext == ".pdf":
        try:
            try:
                import pymupdf as fitz
            except ImportError:
                import fitz
            doc = fitz.open(file_path)
            page_count = len(doc)
            pages_text = [page.get_text("text") or "" for page in doc]
            raw_text = "\n\n".join(pages_text)
            doc.close()
        except ImportError:
            # Basic fallback for PDF
            try:
                with open(file_path, "rb") as f:
                    content = f.read()
                # Extract text between parenthesis inside stream if plain PDF
                matches = re.findall(rb"\((.*?)\)\s*Tj", content)
                if matches:
                    raw_text = " ".join(m.decode("latin1", errors="ignore") for m in matches)
                else:
                    raw_text = content.decode("latin1", errors="ignore")
            except Exception as e:
                raise ValueError(f"Could not extract PDF text: {e}")
    elif ext == ".docx":
        try:
            with zipfile.ZipFile(file_path, "r") as zf:
                # Attempt to extract page count from docProps/app.xml if available
                if "docProps/app.xml" in zf.namelist():
                    try:
                        app_xml = zf.read("docProps/app.xml")
                        app_tree = ET.fromstring(app_xml)
                        for elem in app_tree.iter():
                            if elem.tag.endswith("Pages") and elem.text and elem.text.strip().isdigit():
                                page_count = max(1, int(elem.text.strip()))
                                break
                    except Exception:
                        page_count = 1

                # Parse word/document.xml
                if "word/document.xml" not in zf.namelist():
                    raise ValueError("Invalid DOCX format: word/document.xml missing")

                doc_xml = zf.read("word/document.xml")
                root = ET.fromstring(doc_xml)

                paragraphs: List[str] = []
                for p in root.iter():
                    if p.tag.endswith("}p") or p.tag == "p":
                        p_text = "".join(
                            t.text for t in p.iter() if (t.tag.endswith("}t") or t.tag == "t") and t.text
                        )
                        if p_text:
                            paragraphs.append(p_text)

                raw_text = "\n\n".join(paragraphs)
        except zipfile.BadZipFile:
            raise ValueError(f"File is not a valid zip archive / docx: {file_path}")
        except Exception as e:
            raise ValueError(f"Could not extract DOCX text: {e}")
    else:
        # Plain text, markdown, LaTeX
        for enc in ("utf-8", "utf-8-sig", "latin1", "cp1252"):
            try:
                with open(file_path, "r", encoding=enc) as f:
                    raw_text = f.read()
                break
            except (UnicodeDecodeError, LookupError):
                continue

    words = raw_text.split()
    word_count = len(words)
    char_count = len(raw_text)
    replacement_chars = raw_text.count("\ufffd")
    is_clean = replacement_chars < 5

    return {
        "file_path": file_path,
        "file_name": os.path.basename(file_path),
        "file_format": ext.lstrip("."),
        "file_type": ext.lstrip("."),
        "raw_text": raw_text,
        "text": raw_text,
        "word_count": word_count,
        "char_count": char_count,
        "page_count": page_count,
        "is_clean_encoding": is_clean,
        "warning": None if is_clean else "File may contain corrupted characters.",
    }


def compute_statistical_ai_signals(text: str) -> Dict[str, Any]:
    """
    Computes statistical cadence, sentence length variance, and lexical diversity.
    Provides calibrated uncertainty caveats without definitive authorship claims.
    """
    trimmed = text.strip()
    if not trimmed:
        return {
            "status": "insufficient_text",
            "overall_signal_score": 0.0,
            "classification": "insufficient_text",
            "sentence_count": 0,
            "mean_sentence_length": 0.0,
            "std_dev": 0.0,
            "variance": 0.0,
            "burstiness": 0.0,
            "lexical_diversity_ttr": 0.0,
            "vocabulary_variance": 0.0,
            "uncertainty_caveat": "Document contains insufficient text for statistical cadence analysis.",
        }

    # Sentence segmentation
    sentences = re.split(r"(?<=[.!?])\s+", trimmed)
    sentence_lengths: List[int] = []

    for s in sentences:
        words = s.split()
        if len(words) >= 3:
            sentence_lengths.append(len(words))

    all_words = re.findall(r"\b[A-Za-z0-9'-]+\b", trimmed.lower())
    total_tokens = len(all_words)
    unique_tokens = len(set(all_words))
    ttr = (unique_tokens / total_tokens) if total_tokens > 0 else 0.0

    counts = Counter(all_words)
    freqs = list(counts.values())
    if freqs:
        mean_freq = sum(freqs) / len(freqs)
        vocab_variance = sum((f - mean_freq) ** 2 for f in freqs) / len(freqs)
    else:
        vocab_variance = 0.0

    if len(sentence_lengths) < 4:
        return {
            "status": "insufficient_text",
            "overall_signal_score": 0.0,
            "classification": "insufficient_text",
            "sentence_count": len(sentence_lengths),
            "mean_sentence_length": float(sentence_lengths[0]) if sentence_lengths else 0.0,
            "std_dev": 0.0,
            "variance": 0.0,
            "burstiness": 0.0,
            "lexical_diversity_ttr": round(ttr, 3),
            "vocabulary_variance": round(vocab_variance, 2),
            "uncertainty_caveat": "Fewer than 4 valid sentences; statistical features have low diagnostic sensitivity.",
        }

    n = len(sentence_lengths)
    mean_len = sum(sentence_lengths) / n
    variance = sum((x - mean_len) ** 2 for x in sentence_lengths) / n
    std_dev = math.sqrt(variance)

    # Burstiness heuristic (std_dev / mean)
    burstiness = std_dev / mean_len if mean_len > 0 else 0.0

    # Uniformity score: AI models often exhibit lower burstiness and moderate uniform sentence lengths
    # Natural human academic writing features dynamic cadence (intermixing 12-word statements with 35-word complex sentences)
    if burstiness < 0.28 and 18.0 <= mean_len <= 28.0:
        signal_score = 0.68
        classification = "elevated_ai_signal"
    elif burstiness < 0.38:
        signal_score = 0.45
        classification = "mixed_signals"
    else:
        signal_score = 0.18
        classification = "low_ai_signal"

    return {
        "status": "completed",
        "overall_signal_score": round(signal_score, 2),
        "classification": classification,
        "sentence_count": n,
        "mean_sentence_length": round(mean_len, 2),
        "std_dev": round(std_dev, 2),
        "variance": round(variance, 2),
        "burstiness": round(burstiness, 3),
        "lexical_diversity_ttr": round(ttr, 3),
        "vocabulary_variance": round(vocab_variance, 2),
        "uncertainty_caveat": (
            "Statistical cadence measures linguistic uniformity rather than authorship. "
            "Rigorous technical manuscripts frequently adopt standardized, uniform phraseology. "
            "This diagnostic must never be treated as definitive evidence of AI authorship."
        ),
    }

