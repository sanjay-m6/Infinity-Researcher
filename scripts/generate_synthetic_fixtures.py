#!/usr/bin/env python3
"""
Synthetic Research Paper Fixture Generator for Infinity Researcher.
Generates high-quality synthetic academic research papers (.txt, .docx, .pdf)
completely offline without requiring external network access or cloud APIs.

Usage:
    python scripts/generate_synthetic_fixtures.py [--output-dir fixtures/documents]
"""

from __future__ import annotations

import argparse
import os
import sys
import textwrap
import xml.etree.ElementTree as ET
import zipfile
from typing import Dict, List, Tuple


TITLE = "Scalable Retrieval-Augmented Architectures for Research Integrity and Academic Provenance Verification"
AUTHORS = "Dr. Elena Rostova, Dr. Marcus Vance, Dr. Sarah Lin"
AFFILIATION = "Department of Computer Science & Institute for Advanced Academic Systems"
CORRESPONDENCE = "Contact: e.rostova@iaas-research.org | Published: November 2026"

ABSTRACT = (
    "Automated scientific research assistance requires rigorous adherence to academic integrity, "
    "provenance tracking, and factual consistency. In this paper, we propose an offline-first "
    "retrieval-augmented architecture designed specifically for scholarly manuscript auditing, "
    "citation consistency verification, and stylometric cadence evaluation. Our approach integrates "
    "local density estimation with structural XML parsing and deterministic token preservation guards. "
    "Through comprehensive benchmark evaluation on a corpus of 10,000 academic publications, we "
    "demonstrate that our system achieves 94.6% Precision@10 while maintaining sub-30ms retrieval latency. "
    "We further examine research integrity metrics, demonstrating robust resistance against hallucinations "
    "and semantic drift across diverse academic domains."
)

SECTIONS: List[Tuple[str, List[str]]] = [
    (
        "1. Introduction",
        [
            "The rapid proliferation of neural language models across scholarly research workflows has "
            "introduced unprecedented capabilities alongside substantial integrity risks. Researchers increasingly "
            "rely on automated systems for literature synthesis, manuscript drafting, and preliminary peer review. "
            "However, probabilistic generative architectures frequently exhibit severe failure modes, including "
            "hallucinated bibliographic citations [1], semantic drift in quantitative findings, and algorithmic "
            "homogenization of academic prose [2].",
            "To address these vulnerabilities, academic institutions and publishing bodies require deterministic, "
            "privacy-preserving verification tooling capable of running locally without transmitting confidential "
            "pre-publication manuscripts to third-party cloud infrastructure. In this paper, we present the design, "
            "implementation, and empirical evaluation of the Infinity Researcher Integrity Architecture. Our platform "
            "provides four tightly coupled safeguards: multi-format structural document ingestion, token-preserved "
            "academic humanization, bidirectional citation cross-referencing, and multi-formula stylometric analysis.",
            "The primary contributions of this work are threefold: First, we develop an offline-first parsing pipeline "
            "that guarantees clean paragraph and table extraction across PDF, DOCX, and plain-text formats. Second, we "
            "formulate a statistical cadence diagnostic that characterizes lexical burstiness without asserting "
            "unreliable categorical authorship labels. Third, we validate our architecture against authentic benchmark "
            "datasets, demonstrating state-of-the-art retrieval accuracy and provenance enforcement.",
        ],
    ),
    (
        "2. Related Work & Literature Review",
        [
            "Foundational information retrieval methodologies have long relied on probabilistic term matching, most "
            "notably the BM25 ranking algorithm formulated by Robertson and Zaragoza [4]. While BM25 provides robust "
            "exact-match retrieval with low computational overhead, it fails to capture semantic equivalence between "
            "divergent terminologies across interdisciplinary domains.",
            "The advent of transformer-based dense representation models, pioneered by Vaswani et al. [1] and extended "
            "to bidirectional contextual embeddings by Devlin et al. [3], enabled semantic search through approximate "
            "nearest neighbor graphs (HNSW). Nonetheless, dense retrieval alone frequently introduces catastrophic "
            "hallucinations when prompts lack grounded contextual passages.",
            "In the realm of research integrity, classical readability metrics—such as Flesch Reading Ease and Coleman-Liau—"
            "provide foundational lexical diagnostics but lack sensitivity to generative cadence. Shannon's information "
            "entropy [2] and Zipfian word frequency distributions provide theoretical foundations for detecting uniform "
            "token distributions characteristic of unconstrained autoregressive decoding.",
        ],
    ),
    (
        "3. Methodology & System Architecture",
        [
            "The proposed architecture is organized into four discrete processing layers: Document Ingestion, Token "
            "Preservation, Stylometric Cadence Analysis, and Provenance Verification. The ingestion engine operates "
            "without external server dependencies, utilizing native structural XML decompilation for OpenXML (.docx) "
            "containers and native font-stream extraction for Portable Document Format (.pdf) files.",
            "To prevent corruption of scientific artifacts during text rewriting or humanization, we enforce a strict "
            "Token Preservation Guard. Mathematical equations ($...$ and $$...$$), standard Digital Object Identifiers "
            "(10.1145/..., 10.1109/...), and bracketed numeric citations ([1], [2], [3]) are isolated via regular expression "
            "invariants before linguistic processing and restored verbatim upon completion.",
            "Stylometric cadence is quantified using sentence length variance and token burstiness. Let S = (l_1, l_2, ..., l_n) "
            "denote the sequence of sentence lengths in words. The mean sentence length mu and sample variance sigma^2 are given by:\n"
            "    mu = (1 / n) * sum(l_i)\n"
            "    sigma^2 = (1 / n) * sum((l_i - mu)^2)\n"
            "Burstiness B is defined as the normalized coefficient of variation B = sigma / mu. Natural scholarly manuscripts "
            "consistently exhibit dynamic cadence (B >= 0.38), alternating between succinct statements and multi-clause syntheses.",
        ],
    ),
    (
        "4. Experimental Results & Performance Evaluation",
        [
            "We evaluated our architecture on an evaluation suite comprising 10,000 academic publications from computer "
            "science, computational biology, and physics. Benchmarks were conducted on standard workstation hardware "
            "(AMD Ryzen 9 5900X, 64 GB RAM, NVIDIA RTX 3080) in fully disconnected offline mode.",
            "Retrieval efficacy was measured against traditional BM25, dense vector search, and a hybrid baseline. "
            "As detailed in Table 1, our proposed Infinity Engine architecture achieved superior Precision@10 (0.946) and "
            "Mean Average Precision (0.938) while keeping query latency under 23 milliseconds.",
        ],
    ),
    (
        "5. Discussion & Research Integrity Analysis",
        [
            "A critical consideration in automated integrity assessment is the danger of false positives. Rigorous "
            "experimental protocols, such as clinical trial methodologies or formal mathematical proofs, inherently require "
            "standardized, repetitive phraseology. Labeling such prose as artificially generated undermines scientific "
            "authorship and damages academic trust.",
            "Consequently, our diagnostic engine outputs calibrated uncertainty intervals and explicit contextual caveats "
            "rather than binary classification verdicts. We also incorporate automated compliance checks for mandatory "
            "scientific disclosures, including Institutional Review Board (IRB) ethical approvals, conflict-of-interest "
            "statements, and explicit data availability declarations.",
        ],
    ),
    (
        "6. Conclusion",
        [
            "We have presented a robust, offline-first research integrity and document processing framework. By integrating "
            "native format extraction, token preservation guards, and non-accusatory statistical cadence evaluation, our system "
            "empowers scholars and institutions to safeguard scientific rigor without compromising manuscript confidentiality. "
            "Future work will explore cross-lingual citation graph traversal and automated mathematical proof verification.",
        ],
    ),
]

TABLE_TITLE = "Table 1: Performance Benchmarks across Information Retrieval Models"
TABLE_HEADERS = ["Model Architecture", "Precision@10", "Recall@50", "MAP Score", "Latency (ms)", "RAM (MB)"]
TABLE_ROWS = [
    ["BM25 Baseline [4]", "0.684", "0.742", "0.612", "14.2", "48"],
    ["Dense HNSW Index [3]", "0.812", "0.887", "0.784", "28.6", "512"],
    ["Hybrid Sparse-Dense", "0.895", "0.941", "0.871", "36.4", "580"],
    ["Infinity Engine (Ours)", "0.946", "0.982", "0.938", "22.1", "128"],
]

REFERENCES = [
    (
        "[1] Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J., Jones, L., Gomez, A. N., Kaiser, L., & Polosukhin, I. "
        "(2017). Attention is all you need. Advances in Neural Information Processing Systems, 30, 5998-6008. "
        "https://doi.org/10.1145/3366423.3380099"
    ),
    (
        "[2] Shannon, C. E. (1948). A mathematical theory of communication. Bell System Technical Journal, 27(3), 379-423. "
        "https://doi.org/10.1109/TIT.1953.1188572"
    ),
    (
        "[3] Devlin, J., Chang, M. W., Lee, K., & Toutanova, K. (2019). BERT: Pre-training of deep bidirectional transformers "
        "for language understanding. In Proceedings of NAACL-HLT (pp. 4171-4186). "
        "https://doi.org/10.1145/3448016.3452812"
    ),
    (
        "[4] Robertson, S., & Zaragoza, H. (2009). The probabilistic relevance framework: BM25 and beyond. Foundations and "
        "Trends in Information Retrieval, 3(4), 333-389. "
        "https://doi.org/10.1109/TKDE.2010.222"
    ),
    (
        "[5] Knuth, D. E. (1984). Literate Programming. The Computer Journal, 27(2), 97-111. "
        "https://doi.org/10.1093/comjnl/27.2.97"
    ),
]


def build_plain_text() -> str:
    """Builds clean, structured academic plain text."""
    lines: List[str] = []
    lines.append(TITLE)
    lines.append("=" * len(TITLE))
    lines.append(AUTHORS)
    lines.append(AFFILIATION)
    lines.append(CORRESPONDENCE)
    lines.append("")
    lines.append("Abstract")
    lines.append("--------")
    lines.append(ABSTRACT)
    lines.append("")

    for sec_title, paragraphs in SECTIONS:
        lines.append(sec_title)
        lines.append("-" * len(sec_title))
        for p in paragraphs:
            lines.append(p)
            lines.append("")

        if "4. Experimental Results" in sec_title:
            lines.append(TABLE_TITLE)
            # Format markdown/ASCII table
            col_widths = [len(h) for h in TABLE_HEADERS]
            for row in TABLE_ROWS:
                for idx, cell in enumerate(row):
                    col_widths[idx] = max(col_widths[idx], len(cell))

            sep = "+-" + "-+-".join("-" * w for w in col_widths) + "-+"
            header_str = "| " + " | ".join(h.ljust(col_widths[i]) for i, h in enumerate(TABLE_HEADERS)) + " |"
            lines.append(sep)
            lines.append(header_str)
            lines.append(sep)
            for row in TABLE_ROWS:
                row_str = "| " + " | ".join(c.ljust(col_widths[i]) for i, c in enumerate(row)) + " |"
                lines.append(row_str)
            lines.append(sep)
            lines.append("")

    lines.append("References")
    lines.append("----------")
    for ref in REFERENCES:
        lines.append(ref)
        lines.append("")

    return "\n".join(lines)


def generate_txt_fixture(output_path: str) -> None:
    """Writes the plain text fixture."""
    text_content = build_plain_text()
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(text_content)
    print(f"Generated TXT fixture: {output_path} ({len(text_content)} chars)")


def generate_docx_fixture(output_path: str) -> None:
    """
    Generates a valid OpenXML (.docx) file using standard library zipfile and XML.
    Contains document.xml, core.xml, app.xml, and required relationship files.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # XML namespaces
    w_ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

    # Build word/document.xml content
    body_elements: List[str] = []

    def xml_escape(text: str) -> str:
        return (
            text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
            .replace("'", "&apos;")
        )

    def para(text: str, is_bold: bool = False, font_size: int = 22) -> str:
        bold_tag = "<w:b/>" if is_bold else ""
        escaped = xml_escape(text)
        return (
            f"<w:p>"
            f"<w:pPr><w:rPr>{bold_tag}<w:sz w:val=\"{font_size}\"/></w:rPr></w:pPr>"
            f"<w:r><w:rPr>{bold_tag}<w:sz w:val=\"{font_size}\"/></w:rPr><w:t xml:space=\"preserve\">{escaped}</w:t></w:r>"
            f"</w:p>"
        )

    body_elements.append(para(TITLE, is_bold=True, font_size=32))
    body_elements.append(para(AUTHORS, is_bold=True, font_size=24))
    body_elements.append(para(AFFILIATION, font_size=20))
    body_elements.append(para(CORRESPONDENCE, font_size=18))
    body_elements.append(para(""))
    body_elements.append(para("Abstract", is_bold=True, font_size=24))
    body_elements.append(para(ABSTRACT, font_size=22))
    body_elements.append(para(""))

    for sec_title, paragraphs in SECTIONS:
        body_elements.append(para(sec_title, is_bold=True, font_size=26))
        for p in paragraphs:
            body_elements.append(para(p, font_size=22))
        body_elements.append(para(""))

        if "4. Experimental Results" in sec_title:
            body_elements.append(para(TABLE_TITLE, is_bold=True, font_size=22))
            # OpenXML table
            tbl_xml = ["<w:tbl>"]
            tbl_xml.append("<w:tblPr><w:tblBorders><w:top w:val=\"single\" w:sz=\"4\"/><w:bottom w:val=\"single\" w:sz=\"4\"/><w:insideH w:val=\"single\" w:sz=\"4\"/></w:tblBorders></w:tblPr>")
            # Header row
            tbl_xml.append("<w:tr>")
            for h in TABLE_HEADERS:
                tbl_xml.append(f"<w:tc><w:tcPr><w:tcW w:w=\"1600\" w:type=\"dxa\"/></w:tcPr>{para(h, is_bold=True, font_size=20)}</w:tc>")
            tbl_xml.append("</w:tr>")
            # Data rows
            for row in TABLE_ROWS:
                tbl_xml.append("<w:tr>")
                for cell in row:
                    tbl_xml.append(f"<w:tc><w:tcPr><w:tcW w:w=\"1600\" w:type=\"dxa\"/></w:tcPr>{para(cell, font_size=20)}</w:tc>")
                tbl_xml.append("</w:tr>")
            tbl_xml.append("</w:tbl>")
            body_elements.append("".join(tbl_xml))
            body_elements.append(para(""))

    body_elements.append(para("References", is_bold=True, font_size=26))
    for ref in REFERENCES:
        body_elements.append(para(ref, font_size=20))

    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        f'<w:document xmlns:w="{w_ns}">\n'
        '<w:body>\n'
        + "\n".join(body_elements)
        + '\n<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>'
        '\n</w:body>\n</w:document>'
    )

    content_types_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n'
        '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n'
        '  <Default Extension="xml" ContentType="application/xml"/>\n'
        '  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>\n'
        '  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>\n'
        '  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>\n'
        '</Types>'
    )

    rels_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n'
        '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>\n'
        '  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>\n'
        '  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>\n'
        '</Relationships>'
    )

    core_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
        'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n'
        f'  <dc:title>{xml_escape(TITLE)}</dc:title>\n'
        f'  <dc:creator>{xml_escape(AUTHORS)}</dc:creator>\n'
        '</cp:coreProperties>'
    )

    app_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">\n'
        '  <Pages>3</Pages>\n'
        '  <Application>Infinity Researcher Fixture Generator</Application>\n'
        '</Properties>'
    )

    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types_xml)
        zf.writestr("_rels/.rels", rels_xml)
        zf.writestr("docProps/core.xml", core_xml)
        zf.writestr("docProps/app.xml", app_xml)
        zf.writestr("word/document.xml", document_xml)

    print(f"Generated DOCX fixture: {output_path} (size: {os.path.getsize(output_path)} bytes)")


def generate_pdf_fixture(output_path: str) -> None:
    """
    Generates a multi-page PDF academic research paper using PyMuPDF (fitz).
    Lays out Title, Abstract, 6 Sections, Table 1, and References.
    """
    try:
        import pymupdf as fitz
    except ImportError:
        import fitz

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    doc = fitz.open()

    margin_x = 54.0  # 0.75 inch
    margin_top = 54.0
    margin_bottom = 54.0
    page_width = 612.0  # Letter
    page_height = 792.0
    content_width = page_width - (2 * margin_x)

    current_page = doc.new_page(width=page_width, height=page_height)
    cursor_y = margin_top

    def check_new_page(needed_height: float):
        nonlocal current_page, cursor_y
        if cursor_y + needed_height > (page_height - margin_bottom):
            current_page = doc.new_page(width=page_width, height=page_height)
            cursor_y = margin_top

    def draw_heading(text: str, fontsize: float = 14.0, spacing_after: float = 8.0):
        nonlocal cursor_y
        check_new_page(fontsize + spacing_after + 8.0)
        current_page.insert_text((margin_x, cursor_y), text, fontsize=fontsize, fontname="helv", color=(0.1, 0.1, 0.2))
        cursor_y += fontsize + spacing_after

    def draw_paragraph(text: str, fontsize: float = 10.0, line_height: float = 14.0, spacing_after: float = 8.0):
        nonlocal cursor_y
        # Wrap text based on character width approximation
        max_chars_per_line = int(content_width / (fontsize * 0.52))
        lines = textwrap.wrap(text, width=max_chars_per_line)
        for line in lines:
            check_new_page(line_height)
            current_page.insert_text((margin_x, cursor_y), line, fontsize=fontsize, fontname="helv", color=(0.15, 0.15, 0.15))
            cursor_y += line_height
        cursor_y += spacing_after

    # Title & Metadata
    draw_heading(TITLE, fontsize=15.0, spacing_after=6.0)
    draw_paragraph(AUTHORS, fontsize=11.0, line_height=14.0, spacing_after=2.0)
    draw_paragraph(AFFILIATION, fontsize=9.0, line_height=12.0, spacing_after=2.0)
    draw_paragraph(CORRESPONDENCE, fontsize=8.5, line_height=11.0, spacing_after=10.0)

    # Abstract
    draw_heading("Abstract", fontsize=12.0, spacing_after=4.0)
    draw_paragraph(ABSTRACT, fontsize=9.5, line_height=13.0, spacing_after=12.0)

    # Sections
    for sec_title, paragraphs in SECTIONS:
        draw_heading(sec_title, fontsize=12.0, spacing_after=6.0)
        for p in paragraphs:
            draw_paragraph(p, fontsize=9.5, line_height=13.5, spacing_after=6.0)

        if "4. Experimental Results" in sec_title:
            check_new_page(120.0)
            draw_heading(TABLE_TITLE, fontsize=10.5, spacing_after=6.0)

            # Draw structured table text
            col_widths = [160.0, 70.0, 70.0, 70.0, 70.0, 60.0]
            header_y = cursor_y
            current_page.draw_line((margin_x, cursor_y - 2), (margin_x + content_width, cursor_y - 2), color=(0.3, 0.3, 0.3), width=0.8)
            cursor_x = margin_x
            for idx, h in enumerate(TABLE_HEADERS):
                current_page.insert_text((cursor_x, cursor_y + 9), h, fontsize=8.5, fontname="helv", color=(0.1, 0.1, 0.2))
                cursor_x += col_widths[idx]
            cursor_y += 14
            current_page.draw_line((margin_x, cursor_y), (margin_x + content_width, cursor_y), color=(0.5, 0.5, 0.5), width=0.5)

            for row in TABLE_ROWS:
                cursor_y += 3
                cursor_x = margin_x
                for idx, cell in enumerate(row):
                    current_page.insert_text((cursor_x, cursor_y + 9), cell, fontsize=8.5, fontname="helv", color=(0.2, 0.2, 0.2))
                    cursor_x += col_widths[idx]
                cursor_y += 12

            current_page.draw_line((margin_x, cursor_y + 2), (margin_x + content_width, cursor_y + 2), color=(0.3, 0.3, 0.3), width=0.8)
            cursor_y += 14

    # References
    draw_heading("References", fontsize=12.0, spacing_after=6.0)
    for ref in REFERENCES:
        draw_paragraph(ref, fontsize=8.5, line_height=11.5, spacing_after=5.0)

    # Add page numbers to all pages
    for page_num in range(len(doc)):
        p = doc[page_num]
        p.insert_text((page_width / 2 - 20, page_height - 30), f"Page {page_num + 1} of {len(doc)}", fontsize=8.0, fontname="helv", color=(0.5, 0.5, 0.5))

    doc.save(output_path)
    page_count = len(doc)
    doc.close()
    print(f"Generated PDF fixture: {output_path} ({page_count} pages, {os.path.getsize(output_path)} bytes)")


def main():
    parser = argparse.ArgumentParser(description="Generate synthetic academic research paper fixtures.")
    parser.add_argument(
        "--output-dir",
        default=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "fixtures", "documents"),
        help="Target directory for output fixtures",
    )
    args = parser.parse_args()

    out_dir = os.path.abspath(args.output_dir)
    print(f"Generating synthetic academic paper fixtures in: {out_dir}")

    txt_path = os.path.join(out_dir, "synthetic_paper.txt")
    docx_path = os.path.join(out_dir, "synthetic_paper.docx")
    pdf_path = os.path.join(out_dir, "synthetic_paper.pdf")

    generate_txt_fixture(txt_path)
    generate_docx_fixture(docx_path)
    generate_pdf_fixture(pdf_path)

    print("All fixtures generated successfully!")


if __name__ == "__main__":
    main()
