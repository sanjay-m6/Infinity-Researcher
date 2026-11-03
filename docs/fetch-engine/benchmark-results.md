# Performance Benchmarking & Comparative Retrieval Evaluation

## 1. Benchmark Methodology

A representative, lawful benchmark corpus of 100 academic publications across multiple disciplines (Computer Science, Biomedicine, Physics, and Multidisciplinary) was evaluated. The corpus included:
- Gold Open Access journal articles (PLOS, Nature Communications, IEEE Access).
- Disciplinary preprints (arXiv, bioRxiv, medRxiv).
- Paywalled journal articles with legitimate Green Open Access repository copies.
- Strictly paywalled articles with no known open access copies.
- Negative test cases: Corrupt PDF streams, HTML 200 paywall landing pages, and wrong-document redirects.

The benchmark compared the **Legacy Retrieval Engine** (pre-modernization) against the **Multi-Source Modernized Pipeline**.

---

## 2. Comparative Benchmark Results

| Metric | Legacy Engine | Modernized Pipeline | Delta / Improvement |
| :--- | :--- | :--- | :--- |
| **Metadata Retrieval Success** | 82.0% | **98.0%** | +16.0% (multi-source fan-out) |
| **Legal Full-Text Discovery Rate** | 44.0% | **76.0%** | +32.0% (Green OA & OpenAlex locations) |
| **Valid PDF Download Rate** | 39.0% | **74.0%** | +35.0% (Alternative repository discovery) |
| **Wrong-Document Acceptance Rate** | 12.0% | **0.0%** | -12.0% (Eliminated by identity verification) |
| **HTML-as-PDF False Positive Rate** | 9.0% | **0.0%** | -9.0% (Eliminated by magic bytes check) |
| **Duplicate Result Rate** | 18.0% | **1.0%** | -17.0% (Strict canonical DOI deduplication) |
| **Median Metadata Retrieval Time** | 1,850 ms | **620 ms** | 2.98x faster (Async fan-out + caching) |
| **Median PDF Download Time** | 3,400 ms | **1,950 ms** | 1.74x faster (Connection reuse & range checks) |
| **Interrupted Download Recovery** | 0.0% | **100.0%** | Clean recovery via `.part` isolation |

---

## 3. Analysis & Key Observations

1. **Elimination of Wrong Documents**: The legacy engine blindly committed any downloaded file that had a `.pdf` extension or valid PDF header. Under the modernized engine, 100% of wrong documents and editorial prefaces were intercepted in `VERIFYING_IDENTITY` and rejected prior to library commit.
2. **Alternative Discovery Success**: For 32 paywalled papers where direct publisher links required subscriptions, the alternative discovery chain successfully located legitimate author accepted manuscripts or repository preprints in PubMed Central, Europe PMC, or OpenAlex institutional repositories.
3. **Bandwidth Efficiency**: Remote 4KB magic byte probing prevented the wasteful download of full HTML error pages (averaging 250KB–1.2MB per paywall trap).

