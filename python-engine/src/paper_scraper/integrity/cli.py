"""
Command-line interface and dispatch handler for the Python Integrity & Writing Engine.
Supports JSON-line input/output for IPC with Tauri/Rust desktop shell.
"""

from __future__ import annotations

import json
import sys
from typing import Any, Dict

from paper_scraper.integrity.ingest import ingest_document
from paper_scraper.integrity.fingerprint import generate_winnowing_fingerprints
from paper_scraper.integrity.similarity import compute_similarity
from paper_scraper.integrity.ai_signal import StatisticalBaselineOriginModel
from paper_scraper.integrity.writing import generate_revision


def handle_integrity_request(command: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Route integrity commands to the respective engine handler."""
    if command == "ingest":
        content = payload.get("content")
        file_name = payload.get("file_name", "document.txt")
        file_format = payload.get("file_format")
        source_type = payload.get("source_type", "pasted_text")
        source_ref = payload.get("source_reference")
        
        result = ingest_document(
            content=content,
            file_name=file_name,
            file_format=file_format,
            source_type=source_type,
            source_reference=source_ref,
        )
        return result.model_dump()

    elif command == "fingerprint":
        text = payload.get("text", "")
        k = payload.get("k", 16)
        w = payload.get("w", 4)
        fps = generate_winnowing_fingerprints(text, k=k, w=w)
        return {"fingerprints": [{"hash_value": h, "char_offset": off} for h, off in fps]}

    elif command == "similarity":
        doc_id = payload.get("document_id", "doc_1")
        target_text = payload.get("target_text", "")
        corpus_sources = payload.get("corpus_sources", {})
        fingerprint_hits = payload.get("fingerprint_hits", [])
        min_chars = payload.get("min_match_chars", 40)
        
        sim_res = compute_similarity(
            document_id=doc_id,
            target_text=target_text,
            corpus_sources=corpus_sources,
            fingerprint_hits=fingerprint_hits,
            min_match_chars=min_chars,
        )
        return sim_res.model_dump()

    elif command == "ai_signal":
        doc_id = payload.get("document_id", "doc_1")
        paragraphs = payload.get("paragraphs", [])
        model = StatisticalBaselineOriginModel()
        ai_res = model.analyze(doc_id, paragraphs)
        return ai_res.model_dump()

    elif command == "writing_assist":
        session_id = payload.get("session_id", "session_1")
        rev_num = payload.get("revision_number", 1)
        original_text = payload.get("original_text", "")
        action_type = payload.get("action_type", "clarity")
        custom_text = payload.get("custom_revised_text")
        
        rev_res = generate_revision(
            session_id=session_id,
            revision_number=rev_num,
            original_text=original_text,
            action_type=action_type,
            custom_revised_text=custom_text,
        )
        return rev_res.model_dump()

    else:
        return {"error": f"Unknown integrity command: {command}"}


def main():
    """Read a JSON line from stdin and write JSON response to stdout."""
    line = sys.stdin.readline()
    if not line:
        return
    try:
        req = json.loads(line)
        cmd = req.get("command", "")
        payload = req.get("payload", {})
        res = handle_integrity_request(cmd, payload)
        sys.stdout.write(json.dumps({"success": True, "data": res}, ensure_ascii=False) + "\n")
        sys.stdout.flush()
    except Exception as exc:
        sys.stdout.write(json.dumps({"success": False, "error": str(exc)}) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
