"""
Section-aware PDF Text Extraction and Chunking.
Preserves page numbers, identifies headings, and chunks with overlap for RAG ingestion.
"""

from __future__ import annotations

import os
import re
from typing import Any, Dict, List, Optional


HEADING_PATTERN = re.compile(
    r"(?i)^(abstract|introduction|related work|background|methodology|proposed method|architecture|experiments|results|discussion|conclusion|limitations|references|\d+(\.\d+)*\s+[A-Z][A-Za-z0-9\s]+)$"
)


def chunk_text_content(
    paper_id: str,
    text: str,
    page_number: int = 1,
    section_heading: Optional[str] = None,
    chunk_size_chars: int = 1200,
    overlap_chars: int = 150,
) -> List[Dict[str, Any]]:
    """Chunks a block of text preserving page number and section heading."""
    chunks = []
    trimmed = text.strip()
    if not trimmed:
        return chunks

    chars = list(trimmed)
    length = len(chars)
    start = 0
    chunk_index = 0

    while start < length:
        end = min(start + chunk_size_chars, length)
        snippet = "".join(chars[start:end])
        token_count = max(1, len(snippet) // 4)

        chunk_id = f"{paper_id}_p{page_number}_c{chunk_index}"
        chunks.append({
            "id": chunk_id,
            "paper_id": paper_id,
            "chunk_index": chunk_index,
            "page_number": page_number,
            "section_heading": section_heading,
            "content_text": snippet,
            "token_count": token_count,
        })

        chunk_index += 1
        if end >= length:
            break
        start = max(0, end - overlap_chars)

    return chunks


def chunk_pdf_document(
    paper_id: str,
    pdf_path: str,
    chunk_size_chars: int = 1200,
    overlap_chars: int = 150,
) -> List[Dict[str, Any]]:
    """
    Extracts text page-by-page from a PDF document, detects headings,
    and returns a list of chunk dictionaries for SQLite RAG indexing.
    """
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF file not found at: {pdf_path}")

    all_chunks = []
    current_heading = "Abstract"

    # Attempt PyMuPDF (fitz) first
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(pdf_path)
        for page_idx, page in enumerate(doc, start=1):
            text = page.get_text("text") or ""
            # Inspect lines for headings
            for line in text.splitlines():
                clean_line = line.strip()
                if 3 < len(clean_line) < 80 and HEADING_PATTERN.match(clean_line):
                    current_heading = clean_line

            page_chunks = chunk_text_content(
                paper_id=paper_id,
                text=text,
                page_number=page_idx,
                section_heading=current_heading,
                chunk_size_chars=chunk_size_chars,
                overlap_chars=overlap_chars,
            )
            all_chunks.extend(page_chunks)
        return all_chunks
    except ImportError:
        pass

    # Fallback to pypdf if available
    try:
        from pypdf import PdfReader
        reader = PdfReader(pdf_path)
        for page_idx, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            for line in text.splitlines():
                clean_line = line.strip()
                if 3 < len(clean_line) < 80 and HEADING_PATTERN.match(clean_line):
                    current_heading = clean_line

            page_chunks = chunk_text_content(
                paper_id=paper_id,
                text=text,
                page_number=page_idx,
                section_heading=current_heading,
                chunk_size_chars=chunk_size_chars,
                overlap_chars=overlap_chars,
            )
            all_chunks.extend(page_chunks)
        return all_chunks
    except ImportError:
        pass

    # Basic binary/text stream fallback
    with open(pdf_path, "rb") as f:
        content = f.read(20000).decode("latin-1", errors="ignore")
        # Extract ASCII strings
        extracted = "".join(c if (c.isalnum() or c.isspace()) else " " for c in content)
        return chunk_text_content(
            paper_id=paper_id,
            text=extracted,
            page_number=1,
            section_heading="Extracted Document Stream",
            chunk_size_chars=chunk_size_chars,
            overlap_chars=overlap_chars,
        )
