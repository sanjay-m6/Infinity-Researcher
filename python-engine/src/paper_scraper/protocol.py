"""
Versioned JSON Lines communication protocol.
Handles serializing and validating messages between the desktop shell (Tauri/Rust)
and the Python scraping engine over stdin/stdout.
"""

from __future__ import annotations

import datetime
import json
import sys
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

PROTOCOL_VERSION = "1.0.0"


class ProtocolEvent(BaseModel):
    schema_version: str = PROTOCOL_VERSION
    job_id: str
    type: str  # e.g. job.started, source.started, paper.discovered, ...
    source_id: Optional[str] = None
    timestamp: str = Field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
    )
    payload: Dict[str, Any] = Field(default_factory=dict)

    event: Optional[str] = None

    def to_json_line(self) -> str:
        d = self.model_dump()
        d["event"] = self.type
        return json.dumps(d, ensure_ascii=False)


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
    event_type: str,
    job_id: str,
    payload: Dict[str, Any],
    source_id: Optional[str] = None,
) -> None:
    """Emit a validated protocol event directly to stdout as a single JSON line."""
    event = ProtocolEvent(
        schema_version=PROTOCOL_VERSION,
        job_id=job_id,
        type=event_type,
        source_id=source_id,
        payload=payload,
    )
    line = event.to_json_line()
    try:
        sys.stdout.write(line + "\n")
    except UnicodeEncodeError:
        if hasattr(sys.stdout, "buffer"):
            sys.stdout.buffer.write((line + "\n").encode("utf-8", errors="replace"))
        else:
            sys.stdout.write(line.encode("ascii", "replace").decode("ascii") + "\n")
    sys.stdout.flush()


def emit_response(response_type: str, request_id: str, payload: Dict[str, Any]) -> None:
    """Emit a direct command response to stdout."""
    msg = {
        "schema_version": PROTOCOL_VERSION,
        "type": response_type,
        "request_id": request_id,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
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


def emit_log(level: str, message: str, **kwargs: Any) -> None:
    """Write structured diagnostics strictly to stderr to keep stdout clean."""
    log_entry = {
        "time": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "level": level.upper(),
        "msg": message,
        **kwargs,
    }
    line = json.dumps(log_entry, ensure_ascii=False)
    try:
        sys.stderr.write(line + "\n")
    except UnicodeEncodeError:
        if hasattr(sys.stderr, "buffer"):
            sys.stderr.buffer.write((line + "\n").encode("utf-8", errors="replace"))
        else:
            sys.stderr.write(line.encode("ascii", "replace").decode("ascii") + "\n")
    sys.stderr.flush()

