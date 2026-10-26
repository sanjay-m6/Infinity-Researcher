"""
Tauri/Rust desktop integration and protocol.
"""

from paper_scraper.integration.protocol import (
    PROTOCOL_VERSION,
    emit_event,
    emit_response,
    emit_log,
)
from paper_scraper.integration.runner import run_sidecar, stdin_reader_loop

__all__ = [
    "PROTOCOL_VERSION",
    "emit_event",
    "emit_response",
    "emit_log",
    "run_sidecar",
    "stdin_reader_loop",
]
