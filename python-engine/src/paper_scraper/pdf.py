"""
PDF discovery, signature validation, Anti-SSRF streaming, and cache management.
"""

from __future__ import annotations

import os
import shutil
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
import httpx

from paper_scraper.security import (
    MAX_PDF_BYTES,
    MAX_REDIRECTS,
    SecurityException,
    sanitize_filename,
    validate_url,
)

PDF_MAGIC = b"%PDF-"


def verify_pdf_signature(header_bytes: bytes) -> Tuple[bool, Optional[str]]:
    """
    Check if the first bytes match a legitimate PDF (%PDF-).
    Returns (is_valid, error_reason).
    """
    if len(header_bytes) < 5:
        return False, "File is too small to be a valid PDF"

    if header_bytes.startswith(PDF_MAGIC):
        return True, None

    # Check for HTML masquerading as PDF
    lower = header_bytes[:200].lower()
    if lower.startswith(b"<!doc") or lower.startswith(b"<html") or b"<head" in lower:
        return (
            False,
            "Remote server returned an HTML webpage instead of a direct PDF. "
            "This paper may require an institutional login or subscription on the source website.",
        )

    return False, "Remote file did not contain a valid PDF signature (%PDF-)"


class PdfManager:
    """Manages temporary PDF previews, cache size limits, and access validation."""

    def __init__(self, cache_dir: Optional[Path] = None, max_cache_bytes: int = 200 * 1024 * 1024):
        self.cache_dir = cache_dir or Path(tempfile.gettempdir()) / "paper_scraper_pdf_cache"
        self.max_cache_bytes = max_cache_bytes
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def cleanup_old_cache(self) -> None:
        """Enforce maximum cache size by deleting oldest preview files."""
        try:
            files = list(self.cache_dir.glob("*.pdf"))
            total_size = sum(f.stat().st_size for f in files)
            if total_size <= self.max_cache_bytes:
                return

            # Sort by last access / modified time
            files.sort(key=lambda f: f.stat().st_mtime)
            for f in files:
                if total_size <= self.max_cache_bytes * 0.7:  # clear down to 70%
                    break
                sz = f.stat().st_size
                f.unlink(missing_ok=True)
                total_size -= sz
        except Exception:
            pass

    async def check_pdf_availability(self, url: str) -> Dict[str, Any]:
        """
        Check if a remote PDF is accessible without downloading the full document.
        Uses HEAD request with fallback to Range GET.
        """
        try:
            safe_url = validate_url(url, allow_http=False)
        except SecurityException as e:
            return {
                "available": False,
                "status": "restricted",
                "error": str(e),
                "is_ssrf_blocked": True,
            }

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
        }

        async with httpx.AsyncClient(
            follow_redirects=True,
            max_redirects=MAX_REDIRECTS,
            timeout=15.0,
        ) as client:
            try:
                # Try range request for first 1024 bytes to verify PDF header
                headers["Range"] = "bytes=0-1023"
                resp = await client.get(safe_url, headers=headers)
                
                if resp.status_code in (200, 206):
                    content = resp.content
                    is_valid, reason = verify_pdf_signature(content)
                    content_length = resp.headers.get("Content-Length")
                    content_range = resp.headers.get("Content-Range")
                    
                    # Parse total size if available
                    total_bytes = None
                    if content_range and "/" in content_range:
                        try:
                            total_bytes = int(content_range.split("/")[-1])
                        except ValueError:
                            pass
                    elif content_length and resp.status_code == 200:
                        try:
                            total_bytes = int(content_length)
                        except ValueError:
                            pass

                    return {
                        "available": is_valid,
                        "status": "available" if is_valid else "invalid",
                        "error": reason,
                        "size_bytes": total_bytes,
                        "supports_range": resp.status_code == 206 or "bytes" in resp.headers.get("Accept-Ranges", ""),
                        "content_type": resp.headers.get("Content-Type", ""),
                    }
                elif resp.status_code in (401, 403):
                    return {
                        "available": False,
                        "status": "restricted",
                        "error": f"Access restricted by source server (HTTP {resp.status_code})",
                    }
                elif resp.status_code == 404:
                    return {
                        "available": False,
                        "status": "not_found",
                        "error": "PDF not found (HTTP 404)",
                    }
                else:
                    return {
                        "available": False,
                        "status": "failed",
                        "error": f"Server responded with HTTP {resp.status_code}",
                    }
            except httpx.RequestError as e:
                return {
                    "available": False,
                    "status": "failed",
                    "error": f"Network error checking PDF: {e}",
                }
