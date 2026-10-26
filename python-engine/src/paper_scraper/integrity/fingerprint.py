"""
Winnowing fingerprinting algorithm for exact and near-exact document similarity.
Produces deterministic 64-bit signed integer hashes and character offsets.
Follows the Winnowing algorithm: Local Algorithms for Document Fingerprinting (Schleimer et al.).
"""

from __future__ import annotations

import hashlib
import re
from typing import List, Tuple


# Default parameters:
# k: noise threshold / k-gram length in tokens. Shorter means higher sensitivity.
# w: window size for winnowing. Guarantees that any match >= (w + k - 1) tokens will be detected.
DEFAULT_K = 16
DEFAULT_W = 4

# SQLite signed 64-bit integer bounds
INT64_MIN = -9223372036854775808
INT64_MAX = 9223372036854775807


def hash_kgram_to_i64(tokens: List[str]) -> int:
    """
    Hash a list of tokens deterministically into a signed 64-bit integer.
    Uses MD5 truncated to 8 bytes and converted to signed int64.
    """
    joined = " ".join(tokens).encode("utf-8")
    digest = hashlib.md5(joined).digest()
    val = int.from_bytes(digest[:8], byteorder="big", signed=True)
    return val


def tokenize_with_offsets(text: str) -> List[Tuple[str, int]]:
    """
    Tokenize text into lowercased alphanumeric words along with their start character offset.
    Preserves technical symbols and numbers.
    """
    tokens_with_offsets: List[Tuple[str, int]] = []
    # Match words including numbers, dots inside numbers, and standard hyphenated technical terms
    for match in re.finditer(r"\b[A-Za-z0-9_]+(?:[-.][A-Za-z0-9_]+)*\b", text):
        token = match.group(0).lower()
        tokens_with_offsets.append((token, match.start()))
    return tokens_with_offsets


def generate_winnowing_fingerprints(
    text: str, k: int = DEFAULT_K, w: int = DEFAULT_W
) -> List[Tuple[int, int]]:
    """
    Generate Winnowing fingerprints from text.
    Returns a list of (hash_value, char_offset) tuples.
    If the document has fewer than k tokens, returns empty list (insufficient tokens for k-gram).
    """
    tokens = tokenize_with_offsets(text)
    if len(tokens) < k:
        return []

    # 1. Generate k-gram hashes and their token character offsets
    kgrams: List[Tuple[int, int]] = []
    for i in range(len(tokens) - k + 1):
        window_tokens = [t[0] for t in tokens[i : i + k]]
        char_offset = tokens[i][1]
        h = hash_kgram_to_i64(window_tokens)
        kgrams.append((h, char_offset))

    # 2. Apply sliding window of size w to select minimum hash in each window
    fingerprints: List[Tuple[int, int]] = []
    min_idx = -1

    for i in range(len(kgrams) - w + 1):
        window = kgrams[i : i + w]
        # In each window of size w, select the minimum hash.
        # If there are duplicates, break tie by selecting the rightmost occurrence.
        current_min = window[0]
        current_min_abs_idx = i
        for offset, item in enumerate(window):
            if item[0] <= current_min[0]:
                current_min = item
                current_min_abs_idx = i + offset

        # Only add to fingerprint set if minimum position has shifted
        if current_min_abs_idx != min_idx:
            min_idx = current_min_abs_idx
            fingerprints.append(current_min)

    # De-duplicate identical consecutive fingerprints at same offset
    deduped: List[Tuple[int, int]] = []
    seen = set()
    for h, offset in fingerprints:
        key = (h, offset)
        if key not in seen:
            seen.add(key)
            deduped.append((h, offset))

    return deduped
