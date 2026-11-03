import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "python-engine", "src")))

from paper_scraper.ai.signals import extract_document_file, compute_statistical_ai_signals

repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
fixtures_dir = os.path.join(repo_root, "fixtures", "documents")
files = ["synthetic_paper.txt", "synthetic_paper.docx", "synthetic_paper.pdf"]

required_elements = [
    ("Title", "Scalable Retrieval-Augmented Architectures"),
    ("Authors", "Elena Rostova"),
    ("Abstract", "Abstract"),
    ("Section 1", "1. Introduction"),
    ("Section 2", "2. Related Work"),
    ("Section 3", "3. Methodology"),
    ("Section 4", "4. Experimental Results"),
    ("Section 5", "5. Discussion"),
    ("Section 6", "6. Conclusion"),
    ("Citation [1]", "[1]"),
    ("Citation [2]", "[2]"),
    ("Citation [3]", "[3]"),
    ("Citation [4]", "[4]"),
    ("Citation [5]", "[5]"),
    ("Table 1 Title", "Table 1: Performance Benchmarks"),
    ("Table 1 Content", "Infinity Engine (Ours)"),
    ("References Section", "References"),
    ("Real DOI 1", "10.1145/3366423.3380099"),
    ("Real DOI 2", "10.1109/TIT.1953.1188572"),
    ("Real DOI 3", "10.1145/3448016.3452812"),
    ("Real DOI 4", "10.1109/TKDE.2010.222"),
    ("Real DOI 5", "10.1093/comjnl/27.2.97"),
]

all_passed = True
for fname in files:
    fpath = os.path.join(fixtures_dir, fname)
    if not os.path.exists(fpath):
        print(f"MISSING: {fpath}")
        all_passed = False
        continue
    doc = extract_document_file(fpath)
    text = doc["raw_text"]
    print(f"\n--- Validating {fname} (chars: {len(text)}, words: {doc['word_count']}, pages: {doc['page_count']}) ---")
    for label, pattern in required_elements:
        if pattern in text:
            print(f"  [PASS] {label}")
        else:
            print(f"  [FAIL] {label} (pattern: '{pattern}' not found)")
            all_passed = False

if all_passed:
    print("\nALL REQUIRED ACADEMIC ELEMENTS FULLY CONFIRMED ACROSS ALL 3 FIXTURES!")
    sys.exit(0)
else:
    print("\nSOME CHECKS FAILED!")
    sys.exit(1)
