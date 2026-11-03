"""
Adversarial stress test harness for Python Signals and Document Extraction.
Empirical verification script for challenger_m2_2.
"""

import os
import sys
import tempfile
import traceback

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "python-engine", "src")))
from paper_scraper.ai.signals import extract_document_file, compute_statistical_ai_signals

def run_tests():
    print("=" * 60)
    print("STARTING EMPIRICAL ADVERSARIAL STRESS TESTS")
    print("=" * 60)

    results = []

    def record(name, status, details=""):
        results.append((name, status, details))
        print(f"[{status}] {name}: {details}")

    with tempfile.TemporaryDirectory() as td:
        # ---------------------------------------------------------
        # SECTION 1: extract_document_file
        # ---------------------------------------------------------
        print("\n--- SECTION 1: extract_document_file ---")

        # 1.1 Non-existent file
        missing_path = os.path.join(td, "non_existent_file.pdf")
        try:
            extract_document_file(missing_path)
            record("1.1 Non-existent file", "FAIL", "Did not raise FileNotFoundError")
        except FileNotFoundError as e:
            record("1.1 Non-existent file", "PASS", f"Gracefully raised FileNotFoundError: {e}")
        except Exception as e:
            record("1.1 Non-existent file", "FAIL", f"Raised unexpected exception: {type(e).__name__}: {e}")

        # 1.2 Empty text file
        empty_txt = os.path.join(td, "empty.txt")
        with open(empty_txt, "w", encoding="utf-8") as f:
            pass
        try:
            res = extract_document_file(empty_txt)
            if res["word_count"] == 0 and res["char_count"] == 0 and res["raw_text"] == "":
                record("1.2 Empty TXT file", "PASS", "Extracted empty string, word_count=0, char_count=0")
            else:
                record("1.2 Empty TXT file", "FAIL", f"Unexpected result: {res}")
        except Exception as e:
            record("1.2 Empty TXT file", "FAIL", f"Raised exception: {type(e).__name__}: {e}")

        # 1.3 Empty DOCX file (0 bytes)
        empty_docx = os.path.join(td, "empty.docx")
        with open(empty_docx, "wb") as f:
            pass
        try:
            res = extract_document_file(empty_docx)
            record("1.3 Empty DOCX file (0 bytes)", "FAIL", f"Did not raise ValueError: {res}")
        except ValueError as e:
            record("1.3 Empty DOCX file (0 bytes)", "PASS", f"Gracefully caught BadZipFile and raised ValueError: {e}")
        except Exception as e:
            record("1.3 Empty DOCX file (0 bytes)", "FAIL", f"Raised unexpected exception: {type(e).__name__}: {e}")

        # 1.4 Corrupted/truncated DOCX files
        corrupt_docx = os.path.join(td, "corrupt.docx")
        with open(corrupt_docx, "wb") as f:
            f.write(b"PK\x03\x04truncated_docx_header_without_xml")
        try:
            res = extract_document_file(corrupt_docx)
            record("1.4 Corrupted/truncated DOCX", "FAIL", f"Did not raise ValueError: {res}")
        except ValueError as e:
            record("1.4 Corrupted/truncated DOCX", "PASS", f"Gracefully caught bad zip and raised ValueError: {e}")
        except Exception as e:
            record("1.4 Corrupted/truncated DOCX", "FAIL", f"Raised unexpected exception: {type(e).__name__}: {e}")

        # 1.4b Valid zip but missing word/document.xml
        import zipfile
        missing_xml_docx = os.path.join(td, "missing_doc_xml.docx")
        with zipfile.ZipFile(missing_xml_docx, "w") as zf:
            zf.writestr("some_other_file.txt", "content")
        try:
            res = extract_document_file(missing_xml_docx)
            record("1.4b DOCX without word/document.xml", "FAIL", f"Did not raise ValueError: {res}")
        except ValueError as e:
            record("1.4b DOCX without word/document.xml", "PASS", f"Gracefully identified missing document.xml: {e}")
        except Exception as e:
            record("1.4b DOCX without word/document.xml", "FAIL", f"Raised unexpected exception: {type(e).__name__}: {e}")

        # 1.4c Corrupted XML in word/document.xml
        bad_xml_docx = os.path.join(td, "bad_xml.docx")
        with zipfile.ZipFile(bad_xml_docx, "w") as zf:
            zf.writestr("word/document.xml", "<w:document><unclosed_tag>")
        try:
            res = extract_document_file(bad_xml_docx)
            record("1.4c DOCX with malformed XML", "FAIL", f"Did not raise ValueError: {res}")
        except ValueError as e:
            record("1.4c DOCX with malformed XML", "PASS", f"Gracefully caught ParseError: {e}")
        except Exception as e:
            record("1.4c DOCX with malformed XML", "FAIL", f"Raised unexpected exception: {type(e).__name__}: {e}")

        # 1.5 Empty PDF file (0 bytes)
        empty_pdf = os.path.join(td, "empty.pdf")
        with open(empty_pdf, "wb") as f:
            pass
        try:
            res = extract_document_file(empty_pdf)
            record("1.5 Empty PDF file (0 bytes)", "FAIL", f"Returned without error: {res}")
        except (ValueError, Exception) as e:
            record("1.5 Empty PDF file (0 bytes)", "OBSERVE", f"Exception raised: {type(e).__name__}: {e}")

        # 1.6 Corrupted/truncated PDF files
        corrupt_pdf = os.path.join(td, "corrupt.pdf")
        with open(corrupt_pdf, "wb") as f:
            f.write(b"%PDF-1.5\n%malformed data\nstream\ncorrupted")
        try:
            res = extract_document_file(corrupt_pdf)
            record("1.6 Corrupted PDF file", "FAIL", f"Returned without error: {res}")
        except Exception as e:
            record("1.6 Corrupted PDF file", "OBSERVE", f"Exception raised: {type(e).__name__}: {e}")

        # 1.7 Non-UTF8 text files
        # 1.7a Latin-1 encoded text
        latin1_path = os.path.join(td, "latin1.txt")
        with open(latin1_path, "wb") as f:
            f.write("H\xe9l\xe8ne wrote a na\xefve r\xe9sum\xe9 with \xa3500 cost.".encode("latin1"))
        try:
            res = extract_document_file(latin1_path)
            record("1.7a Latin-1 encoded TXT", "PASS", f"Decoded successfully: {res['text']}")
        except Exception as e:
            record("1.7a Latin-1 encoded TXT", "FAIL", f"Raised exception: {type(e).__name__}: {e}")

        # 1.7b Windows-1252 with special curly quotes and em-dash
        cp1252_path = os.path.join(td, "cp1252.txt")
        # In cp1252, 0x93 is left double quote, 0x94 right double quote, 0x97 em-dash
        with open(cp1252_path, "wb") as f:
            f.write(b"\x93Smart quotes\x94 and an em\x97dash")
        try:
            res = extract_document_file(cp1252_path)
            record("1.7b CP1252 with curly quotes", "PASS", f"Decoded successfully: {res['text']}")
        except Exception as e:
            record("1.7b CP1252 with curly quotes", "FAIL", f"Raised exception: {type(e).__name__}: {e}")

        # 1.7c Raw binary file treated as text
        bin_path = os.path.join(td, "random_binary.txt")
        with open(bin_path, "wb") as f:
            f.write(bytes(range(256)) * 4)
        try:
            res = extract_document_file(bin_path)
            record("1.7c Raw binary file", "PASS", f"Decoded with fallback, is_clean={res['is_clean_encoding']}, warning={res['warning']}")
        except Exception as e:
            record("1.7c Raw binary file", "FAIL", f"Raised exception: {type(e).__name__}: {e}")

        # 1.8 LaTeX and Markdown files
        md_path = os.path.join(td, "test.md")
        with open(md_path, "w", encoding="utf-8") as f:
            f.write("# Header\n\nThis is a **markdown** file.")
        res = extract_document_file(md_path)
        record("1.8 Markdown file", "PASS", f"Format={res['file_format']}, word_count={res['word_count']}")

        tex_path = os.path.join(td, "test.tex")
        with open(tex_path, "w", encoding="utf-8") as f:
            f.write(r"\documentclass{article}\begin{document}Hello world\end{document}")
        res = extract_document_file(tex_path)
        record("1.8b LaTeX file", "PASS", f"Format={res['file_format']}, word_count={res['word_count']}")

        # ---------------------------------------------------------
        # SECTION 2: compute_statistical_ai_signals
        # ---------------------------------------------------------
        print("\n--- SECTION 2: compute_statistical_ai_signals ---")

        # 2.1 Empty strings and whitespace
        for case, val in [("empty string", ""), ("only spaces", "   \t\n  "), ("newlines", "\n\n\r\n")]:
            try:
                res = compute_statistical_ai_signals(val)
                if res["status"] == "insufficient_text" and res["overall_signal_score"] == 0.0:
                    record(f"2.1 Empty input ({case})", "PASS", f"status={res['status']}")
                else:
                    record(f"2.1 Empty input ({case})", "FAIL", f"Unexpected output: {res}")
            except Exception as e:
                record(f"2.1 Empty input ({case})", "FAIL", f"Raised exception: {type(e).__name__}: {e}")

        # 2.2 Single-word inputs
        for word in ["Hello", "Unprecedented", "Supercalifragilisticexpialidocious"]:
            try:
                res = compute_statistical_ai_signals(word)
                if res["status"] == "insufficient_text" and res["sentence_count"] == 0:
                    record(f"2.2 Single-word ({word})", "PASS", f"status={res['status']}, sentence_count={res['sentence_count']}")
                else:
                    record(f"2.2 Single-word ({word})", "FAIL", f"Unexpected output: {res}")
            except Exception as e:
                record(f"2.2 Single-word ({word})", "FAIL", f"Raised exception: {type(e).__name__}: {e}")

        # 2.3 Short text with 1 to 3 words / short sentences
        for short in ["One two", "Three blind mice.", "One sentence. Two sentences. Three."]:
            try:
                res = compute_statistical_ai_signals(short)
                if res["status"] == "insufficient_text":
                    record(f"2.3 Short text ('{short[:20]}...')", "PASS", f"status={res['status']}")
                else:
                    record(f"2.3 Short text ('{short[:20]}...')", "FAIL", f"Unexpected output: {res}")
            except Exception as e:
                record(f"2.3 Short text ('{short[:20]}...')", "FAIL", f"Raised exception: {type(e).__name__}: {e}")

        # 2.4 Very long text (100,000 words / 10,000 sentences)
        print("Testing very long text (10,000 sentences)...")
        long_sentence = "This is a representative scholarly sentence exploring neural representations in deep architectures. "
        long_text = long_sentence * 5000  # 5,000 sentences, ~55,000 words
        try:
            import time
            t0 = time.time()
            res = compute_statistical_ai_signals(long_text)
            dt = time.time() - t0
            if res["status"] == "completed" and res["sentence_count"] == 5000:
                record("2.4 Very long text (5,000 sentences)", "PASS", f"Completed in {dt:.3f}s, sentence_count={res['sentence_count']}, burstiness={res['burstiness']}")
            else:
                record("2.4 Very long text", "FAIL", f"Unexpected output: {res['status']}")
        except Exception as e:
            record("2.4 Very long text", "FAIL", f"Raised exception: {type(e).__name__}: {e}")

        # 2.5 Texts with zero punctuation
        no_punct = "this is a text that has absolutely no punctuation whatsoever it just keeps going with words and words across many lines without any periods or question marks or commas"
        try:
            res = compute_statistical_ai_signals(no_punct)
            # Since there is no punctuation delimiter [.!?:], split creates 1 sentence with 28 words
            # Sentence count < 4, so it should be insufficient_text
            if res["status"] == "insufficient_text":
                record("2.5 Zero punctuation text", "PASS", f"status={res['status']}, sentence_count={res['sentence_count']}, mean_len={res['mean_sentence_length']}")
            else:
                record("2.5 Zero punctuation text", "FAIL", f"Unexpected output: {res}")
        except Exception as e:
            record("2.5 Zero punctuation text", "FAIL", f"Raised exception: {type(e).__name__}: {e}")

        # 2.6 Texts with repeated characters
        # e.g., "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" or ".........." or "???!!!"
        for rep_case, rep_text in [
            ("Repeated letters", "a" * 10000),
            ("Repeated punctuation", ".!? " * 500),
            ("Repeated dashes and symbols", "---___===---*** " * 200),
            ("Repeated emojis", "🤖🧠🚀" * 500),
        ]:
            try:
                res = compute_statistical_ai_signals(rep_text)
                record(f"2.6 Repeated chars ({rep_case})", "PASS", f"status={res['status']}, sentence_count={res['sentence_count']}")
            except Exception as e:
                record(f"2.6 Repeated chars ({rep_case})", "FAIL", f"Raised exception: {type(e).__name__}: {e}")

        # 2.7 Degenerate sentences (e.g. only numbers, only math symbols)
        math_text = "$E = mc^2$. $a^2 + b^2 = c^2$. $\\int_0^\\infty e^{-x} dx = 1$. $\\sum_{i=1}^n x_i = S$."
        try:
            res = compute_statistical_ai_signals(math_text)
            record("2.7 Math notation", "PASS", f"status={res['status']}, sentence_count={res['sentence_count']}")
        except Exception as e:
            record("2.7 Math notation", "FAIL", f"Raised exception: {type(e).__name__}: {e}")

        # 2.8 Extreme burstiness scenarios:
        # All sentences identical length vs extreme variance
        ident_text = " ".join(["One two three four five six seven eight nine ten." for _ in range(20)])
        res_ident = compute_statistical_ai_signals(ident_text)
        record("2.8a Identical sentence lengths", "PASS", f"burstiness={res_ident['burstiness']}, variance={res_ident['variance']}")

        extreme_var_text = (
            "One two three. "
            + ("word " * 100) + ". "
            + "Four five six. "
            + ("term " * 80) + ". "
            + "Seven eight nine. "
        )
        res_var = compute_statistical_ai_signals(extreme_var_text)
        record("2.8b Extreme sentence variance", "PASS", f"burstiness={res_var['burstiness']}, variance={res_var['variance']}")

        # 2.9 Multilingual texts
        multilingual = {
            "Chinese": "这是第一句话关于学术研究。这是第二句话关于文献检索系统。这是第三句话关于自然语言处理。这是第四句话关于模型评估指标。",
            "Russian": "Это первое предложение на русском языке для анализа. Это второе предложение для научной проверки. Это третье предложение академического стиля. Это четвертое предложение проверки.",
            "Arabic": "هذه هي الجملة الأولى في التحليل الأكاديمي. هذه هي الجملة الثانية للبحث العلمي المنهجي. هذه هي الجملة الثالثة في هذا الاختبار الدقيق. هذه هي الجملة الرابعة للدراسة الأكاديمية المقارنة.",
            "Hindi": "यह विश्लेषण का पहला वाक्य है जो अकादमिक है। यह वैज्ञानिक शोध का दूसरा वाक्य प्रस्तुत करता है। यह इस परीक्षण का तीसरा वाक्य समझाता है। यह अकादमिक अध्ययन का चौथा वाक्य पूरा करता है।"
        }
        for lang, ml_text in multilingual.items():
            try:
                res_ml = compute_statistical_ai_signals(ml_text)
                record(f"2.9 Multilingual ({lang})", "PASS", f"status={res_ml['status']}, sentences={res_ml['sentence_count']}, burstiness={res_ml['burstiness']}")
            except Exception as e:
                record(f"2.9 Multilingual ({lang})", "FAIL", f"Raised exception: {type(e).__name__}: {e}")

        # 2.10 Null bytes and control characters in text
        ctrl_text = "Sentence one with \x00 null bytes here.\x00\x00 Sentence two with \x07 bell and \x1b escape.\x1b Sentence three has \t tabs and \r\n newlines. Sentence four completes this text."
        try:
            res_ctrl = compute_statistical_ai_signals(ctrl_text)
            record("2.10 Control chars and null bytes", "PASS", f"status={res_ctrl['status']}, sentences={res_ctrl['sentence_count']}")
        except Exception as e:
            record("2.10 Control chars and null bytes", "FAIL", f"Raised exception: {type(e).__name__}: {e}")


    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    passes = sum(1 for _, s, _ in results if s == "PASS")
    fails = sum(1 for _, s, _ in results if s == "FAIL")
    observes = sum(1 for _, s, _ in results if s == "OBSERVE")
    print(f"Total Tests: {len(results)} | PASS: {passes} | FAIL: {fails} | OBSERVE: {observes}")

if __name__ == "__main__":
    run_tests()
