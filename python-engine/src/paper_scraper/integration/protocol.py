"""
Versioned JSON Lines Protocol for Inter-Process Communication.
Exchanges structured events and command responses between Python and Tauri/Rust.
"""

from __future__ import annotations

import json
import sys
from typing import Any, Dict, Optional

PROTOCOL_VERSION = "1.0.0"


# Ensure UTF-8 on Windows stdin/stdout/stderr
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


def emit_event(
    event_name: str,
    job_id: str,
    payload: Dict[str, Any],
    source_id: Optional[str] = None,
) -> None:
    """Emit an incremental lifecycle or paper discovery event to stdout."""
    msg = {
        "version": PROTOCOL_VERSION,
        "schema_version": PROTOCOL_VERSION,
        "type": event_name,
        "event": event_name,
        "job_id": job_id,
        "source_id": source_id,
        "payload": payload,
    }
    line = json.dumps(msg, ensure_ascii=False)
    try:
        sys.stdout.write(line + "\n")
    except UnicodeEncodeError:
        if hasattr(sys.stdout, "buffer"):
            sys.stdout.buffer.write((line + "\n").encode("utf-8", errors="replace"))
        else:
            sys.stdout.write(line.encode("ascii", "replace").decode("ascii") + "\n")
    sys.stdout.flush()


def emit_response(
    response_type: str,
    request_id: str,
    payload: Dict[str, Any],
) -> None:
    """Emit a response to a client command."""
    msg = {
        "version": PROTOCOL_VERSION,
        "type": "response",
        "reply_to": request_id,
        "response_type": response_type,
        "payload": payload,
    }
    line = json.dumps(msg, ensure_ascii=False)
    try:
        sys.stdout.write(line + "\n")
    except UnicodeEncodeError:
        if hasattr(sys.stdout, "buffer"):
            sys.stdout.buffer.write((line + "\n").encode("utf-8", errors="replace"))
        else:
            sys.stdout.write(line.encode("ascii", "replace").decode("ascii") + "\n")
    sys.stdout.flush()


def emit_log(level: str, message: str) -> None:
    """Emit a diagnostic log message."""
    msg = {
        "version": PROTOCOL_VERSION,
        "type": "log",
        "level": level,
        "message": message,
    }
    line = json.dumps(msg, ensure_ascii=False)
    try:
        sys.stdout.write(line + "\n")
    except UnicodeEncodeError:
        if hasattr(sys.stdout, "buffer"):
            sys.stdout.buffer.write((line + "\n").encode("utf-8", errors="replace"))
        else:
            sys.stdout.write(line.encode("ascii", "replace").decode("ascii") + "\n")
    sys.stdout.flush()

