import os
import sys
import tempfile
import zipfile

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "python-engine", "src")))

from paper_scraper.ai.signals import compute_statistical_ai_signals, extract_document_file

print("Starting Adversarial Stress Testing on signals.py...")

# Test 1: Zero-length string to compute_statistical_ai_signals
res_empty = compute_statistical_ai_signals("")
assert res_empty["status"] == "insufficient_text"
assert res_empty["burstiness"] == 0.0
assert res_empty["variance"] == 0.0

# Test 2: Whitespace only
res_ws = compute_statistical_ai_signals("   \t\n   \r\n   ")
assert res_ws["status"] == "insufficient_text"

# Test 3: Less than 4 sentences
res_short = compute_statistical_ai_signals("Sentence one here. Sentence two here. Sentence three here.")
assert res_short["status"] == "insufficient_text"
assert res_short["sentence_count"] == 3
assert res_short["burstiness"] == 0.0

# Test 4: Sentences with less than 3 words (filtered out)
res_tiny_words = compute_statistical_ai_signals("Hi. Ok. Yes. No. Bye. Thanks.")
assert res_tiny_words["status"] == "insufficient_text"
assert res_tiny_words["sentence_count"] == 0

# Test 5: Exactly 4 valid sentences, zero variance (identical length)
res_zero_var = compute_statistical_ai_signals(
    "Alpha beta gamma. Delta epsilon zeta. Eta theta iota. Kappa lambda mu."
)
assert res_zero_var["status"] == "completed"
assert res_zero_var["sentence_count"] == 4
assert res_zero_var["variance"] == 0.0
assert res_zero_var["burstiness"] == 0.0
assert res_zero_var["classification"] == "mixed_signals"
assert res_zero_var["overall_signal_score"] == 0.45

# Test 6: Highly uniform cadence in elevated AI zone (18 <= mean <= 28, burstiness < 0.28)
uniform_ai_prose = " ".join([
    f"This is a strictly engineered synthetic sentence number {i} containing exactly twenty words in length for rigorous mathematical verification tests."
    for i in range(10)
])
res_uniform = compute_statistical_ai_signals(uniform_ai_prose)
assert res_uniform["status"] == "completed"
assert res_uniform["classification"] == "elevated_ai_signal"
assert res_uniform["overall_signal_score"] == 0.68

# Test 7: Natural academic dynamic cadence (burstiness >= 0.38)
dynamic_prose = (
    "Machine learning models require validation. "
    "However, empirical evaluation across heterogeneous benchmark distributions often reveals unexpected systemic vulnerabilities, particularly when distribution shifts or out-of-domain instances degrade generalizability across diverse deployment environments. "
    "We test this rigorously. "
    "Our findings demonstrate marked variability across models, highlighting the critical necessity of multi-faceted evaluation protocols and robust provenance tracking architectures."
)
res_dynamic = compute_statistical_ai_signals(dynamic_prose)
assert res_dynamic["status"] == "completed"
assert res_dynamic["burstiness"] >= 0.38
assert res_dynamic["classification"] == "low_ai_signal"
assert res_dynamic["overall_signal_score"] == 0.18

# Test 8: File extraction - 0-byte file
with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as f:
    f.write(b"")
    empty_txt = f.name
try:
    res_empty_file = extract_document_file(empty_txt)
    assert res_empty_file["word_count"] == 0
    assert res_empty_file["char_count"] == 0
    assert res_empty_file["is_clean_encoding"] is True
finally:
    os.unlink(empty_txt)

# Test 9: File extraction - File with unicode replacement character (\ufffd)
with tempfile.NamedTemporaryFile(suffix=".txt", delete=False, mode="w", encoding="utf-8") as f:
    f.write("Corrupted text with \ufffd \ufffd \ufffd \ufffd \ufffd \ufffd many bad characters.")
    corrupt_txt = f.name
try:
    res_corrupt = extract_document_file(corrupt_txt)
    assert res_corrupt["is_clean_encoding"] is False
    assert res_corrupt["warning"] is not None
finally:
    os.unlink(corrupt_txt)

# Test 10: File extraction - Malformed DOCX without word/document.xml
with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as f:
    with zipfile.ZipFile(f, "w") as z:
        z.writestr("some_other_file.txt", "hello")
    missing_xml_docx = f.name
try:
    extract_document_file(missing_xml_docx)
    assert False, "Should have raised ValueError"
except ValueError as e:
    assert "word/document.xml missing" in str(e)
finally:
    os.unlink(missing_xml_docx)

# Test 11: File extraction - Corrupt zip archive
with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as f:
    f.write(b"NOT_A_ZIP_ARCHIVE")
    bad_zip_docx = f.name
try:
    extract_document_file(bad_zip_docx)
    assert False, "Should have raised ValueError"
except ValueError as e:
    assert "not a valid zip archive" in str(e)
finally:
    os.unlink(bad_zip_docx)

print("All 11 stress tests passed with flying colors!")
