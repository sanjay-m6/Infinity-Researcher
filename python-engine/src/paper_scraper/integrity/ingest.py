"""
Multi-format document ingestion and normalization engine.
Supports PDF, DOCX, LaTeX, TXT/Markdown, and pasted text.
Extracts document segments with exact character offsets, section types, and page estimates.
"""

from __future__ import annotations

import hashlib
import io
import re
import unicodedata
import uuid
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field


class DocumentSegmentData(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    segment_index: int
    segment_type: str  # "paragraph", "section_heading", "abstract", "methodology", "results", "discussion", "references", "boilerplate"
    raw_text: str
    normalized_text: str
    char_start: int
    char_end: int
    page_number: int
    embedding_id: Optional[str] = None


class IntegrityIngestResult(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source_type: str  # "file", "library_paper", "pasted_text"
    source_reference: Optional[str] = None
    file_hash: str
    file_name: str
    file_format: str  # "pdf", "docx", "txt", "tex", "raw"
    file_size_bytes: int
    raw_content: str
    normalized_content: str
    word_count: int
    page_count: int
    extraction_metadata: Dict[str, Any] = Field(default_factory=dict)
    segments: List[DocumentSegmentData] = Field(default_factory=list)


def normalize_text_nfkc(text: str) -> str:
    """Normalize text using Unicode NFKC and standard line breaks."""
    if not text:
        return ""
    normalized = unicodedata.normalize("NFKC", text)
    # Normalize Windows and Mac line breaks to Unix
    normalized = normalized.replace("\r\n", "\n").replace("\r", "\n")
    return normalized


def extract_docx_text(file_bytes: bytes) -> Tuple[str, Dict[str, Any]]:
    """
    Extract text and paragraph structure from DOCX without third-party dependencies.
    Extracts XML from word/document.xml.
    """
    metadata: Dict[str, Any] = {"extractor": "native_zip_xml", "version": "1.0"}
    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as z:
            if "word/document.xml" not in z.namelist():
                return "", {"error": "Invalid docx: word/document.xml not found"}
            xml_bytes = z.read("word/document.xml")
            root = ET.fromstring(xml_bytes)
            
            # XML namespace for OpenXML wordprocessingML
            ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
            paragraphs: List[str] = []
            
            for p_elem in root.findall(".//w:p", ns):
                texts = [node.text for node in p_elem.findall(".//w:t", ns) if node.text]
                if texts:
                    paragraphs.append("".join(texts))
            
            full_text = "\n\n".join(paragraphs)
            return full_text, metadata
    except Exception as exc:
        return "", {"error": f"Failed to extract docx: {str(exc)}"}


def extract_latex_text(latex_code: str) -> Tuple[str, Dict[str, Any]]:
    """
    Extract readable text from LaTeX while preserving equations, citations, and structure.
    """
    metadata: Dict[str, Any] = {"extractor": "latex_regex_parser", "version": "1.0"}
    lines = latex_code.splitlines()
    cleaned_lines: List[str] = []
    
    in_comment = False
    for line in lines:
        stripped = line.strip()
        # Skip pure comments
        if stripped.startswith("%"):
            continue
        # Remove trailing comments if not escaped
        cleaned = re.sub(r"(?<!\\)%.*$", "", line)
        cleaned_lines.append(cleaned)
    
    text = "\n".join(cleaned_lines)
    # Simplify common LaTeX wrappers while preserving mathematical text and identifiers
    text = re.sub(r"\\textbf\{([^}]+)\}", r"\1", text)
    text = re.sub(r"\\textit\{([^}]+)\}", r"\1", text)
    text = re.sub(r"\\emph\{([^}]+)\}", r"\1", text)
    
    return text, metadata


def extract_pdf_fallback(file_bytes: bytes) -> Tuple[str, Dict[str, Any]]:
    """
    Extract text from PDF using pypdf if available, or extract readable ASCII/UTF-8 streams.
    """
    metadata: Dict[str, Any] = {"extractor": "pdf_extractor", "version": "1.0"}
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        pages_text: List[str] = []
        for i, page in enumerate(reader.pages):
            txt = page.extract_text() or ""
            pages_text.append(f"\f{txt}")
        full_text = "\n\n".join(pages_text)
        metadata["pages_extracted"] = len(reader.pages)
        return full_text, metadata
    except ImportError:
        # Fallback: scan for text streams or notify OCR/lopdf
        # If lopdf or caller already provided text, this fallback will return empty with note
        return "", {
            "warning": "pypdf not installed in python environment; relying on desktop lopdf text extraction",
            "ocr_status": "not_performed"
        }
    except Exception as exc:
        return "", {"error": f"PDF parse error: {str(exc)}"}


def classify_segment(text: str) -> str:
    """Classify segment type based on content and heading heuristics."""
    trimmed = text.strip()
    lower = trimmed.lower()
    
    if len(trimmed) < 60 and (
        lower.startswith("abstract")
        or lower.startswith("introduction")
        or lower.startswith("related work")
        or lower.startswith("methodology")
        or lower.startswith("methods")
        or lower.startswith("results")
        or lower.startswith("discussion")
        or lower.startswith("conclusion")
        or lower.startswith("references")
        or lower.startswith("bibliography")
    ):
        return "section_heading"
    
    if lower.startswith("abstract") or "in this paper, we" in lower[:100]:
        return "abstract"
    if "references" in lower[:20] or "bibliography" in lower[:20] or re.match(r"^\[\d+\]\s+[A-Z]", trimmed):
        return "references"
    if "all rights reserved" in lower or "copyright" in lower or "permission to make digital" in lower:
        return "boilerplate"
    if any(k in lower for k in ["method", "dataset", "architecture", "algorithm", "implementation"]):
        return "methodology"
    if any(k in lower for k in ["we observe", "table ", "figure ", "results show", "statistically significant"]):
        return "results"
    
    return "paragraph"


def ingest_document(
    content: Optional[str] = None,
    file_bytes: Optional[bytes] = None,
    file_name: str = "document.txt",
    file_format: Optional[str] = None,
    source_type: str = "file",
    source_reference: Optional[str] = None,
) -> IntegrityIngestResult:
    """
    Ingest a document from string or raw bytes and produce a normalized representation.
    """
    fmt = (file_format or Path(file_name).suffix.lstrip(".").lower()) or "raw"
    
    raw_text = ""
    metadata: Dict[str, Any] = {"format": fmt, "tool": "paper_scraper_integrity_ingest_v1"}
    
    if content is not None:
        raw_text = content
        file_bytes = raw_text.encode("utf-8")
    elif file_bytes is not None:
        if fmt in ["docx"]:
            raw_text, meta = extract_docx_text(file_bytes)
            metadata.update(meta)
        elif fmt in ["tex", "latex"]:
            decoded = file_bytes.decode("utf-8", errors="replace")
            raw_text, meta = extract_latex_text(decoded)
            metadata.update(meta)
        elif fmt in ["pdf"]:
            raw_text, meta = extract_pdf_fallback(file_bytes)
            metadata.update(meta)
        else:
            # txt, md, raw
            raw_text = file_bytes.decode("utf-8", errors="replace")
    else:
        raw_text = ""
        file_bytes = b""
    
    file_hash = hashlib.sha256(file_bytes).hexdigest()
    normalized = normalize_text_nfkc(raw_text)
    
    # Segment document into paragraphs
    raw_paras = re.split(r"\n\s*\n", normalized)
    segments: List[DocumentSegmentData] = []
    
    current_char_offset = 0
    current_page = 1
    total_words = 0
    
    for i, p in enumerate(raw_paras):
        p_clean = p.strip()
        if not p_clean:
            current_char_offset += len(p) + 2
            continue
        
        # Check if form feed indicates a new page
        if "\f" in p:
            current_page += p.count("\f")
            p_clean = p_clean.replace("\f", "").strip()
        
        words = len(re.findall(r"\w+", p_clean))
        total_words += words
        
        # Approximate 400 words per page if no form feeds
        calc_page = current_page if "\f" in normalized else max(1, (total_words // 400) + 1)
        
        seg_type = classify_segment(p_clean)
        start_pos = normalized.find(p, current_char_offset)
        if start_pos == -1:
            start_pos = current_char_offset
        end_pos = start_pos + len(p)
        current_char_offset = end_pos + 2
        
        segments.append(
            DocumentSegmentData(
                segment_index=i,
                segment_type=seg_type,
                raw_text=p,
                normalized_text=p_clean,
                char_start=start_pos,
                char_end=end_pos,
                page_number=calc_page,
            )
        )
    
    page_count = max(1, current_page if "\f" in normalized else (total_words // 400) + 1)
    
    return IntegrityIngestResult(
        source_type=source_type,
        source_reference=source_reference,
        file_hash=file_hash,
        file_name=file_name,
        file_format=fmt,
        file_size_bytes=len(file_bytes),
        raw_content=raw_text,
        normalized_content=normalized,
        word_count=total_words,
        page_count=page_count,
        extraction_metadata=metadata,
        segments=segments,
    )
