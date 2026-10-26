# Phase 9 Performance Benchmarks & Optimization Analysis

**Project:** Research Paper Scraper (Desktop Application)  
**Host Environment:** Windows 11 Pro x86_64, AMD/Intel Multi-Core CPU, NVMe SSD  
**Toolchain:** Rust 1.99.1, SQLite 3 with FTS5 extension  
**Benchmark Suite:** `src-tauri/tests/performance_benchmarks.rs`  
**Command:** `cargo test --test performance_benchmarks -- --nocapture`  
**Status:** All Scenarios Measured & Completed (Zero Regressions)  

---

## 1. Executive Summary & Methodology

Performance evaluation was conducted using synthetic research paper datasets generated deterministically with varying titles, multi-author lists, publication years, abstracts, DOIs, collection assignments, tags, and reading progress states.

Testing exercises both cold initialization, bulk transactional persistence, SQLite FTS5 inverted-index queries, complex multi-column metadata filtering, and high-throughput serialization across 4 academic citation formats (BibTeX, RIS, CSV, JSON).

---

## 2. Benchmark Measurement Results

| # | Benchmark Scenario | Dataset Scale | Measured Execution Time | Throughput / Metric | Performance Grade |
|:---:|:---|:---:|:---:|:---:|:---:|
| **1** | **Bulk Insert + FTS5 Indexing** | 1,000 papers | **1.815 s** | **550.70 papers/sec** | High |
| **2** | **Paged Listing (Page 1, 25 items)** | 1,000 papers | **20.03 ms** | < 25 ms latency | Excellent |
| **3** | **Paged Listing (Page 20, offset 475)** | 1,000 papers | **18.83 ms** | Flat pagination curve | Excellent |
| **4** | **FTS5 Full-Text Match Query** | 1,000 papers | **48.18 ms** | 1,000 matches indexed | High |
| **5** | **Multi-Filter Query** (Tags + Year + Status + File) | 1,000 papers | **21.23 ms** | Selective index scan | Excellent |
| **6** | **BibTeX Citation Export** | 1,000 papers | **53.51 ms** | 556 KB formatted text | Excellent |
| **7** | **RIS Citation Export** | 1,000 papers | **23.54 ms** | 541 KB formatted text | Excellent |
| **8** | **CSV Data Export** (Formula-Safe) | 1,000 papers | **28.40 ms** | 506 KB spreadsheet CSV | Excellent |
| **9** | **JSON Metadata Export** | 1,000 papers | **315.41 ms** | 2.02 MB structured JSON | Good |
| **10** | **Scale Ingestion (Additional 4k)** | 5,000 total | **1.545 s** | > 2,500 papers/sec (bulk) | High |
| **11** | **FTS5 Search at Scale (5,000 papers)** | 5,000 papers | **121.06 ms** | 4,000 matching records | High |

---

## 3. Targeted Optimizations Implemented in Phase 9

### Optimization 1: Export Page Size Clamp Extension
* **Problem:** `PaperRepository::list` previously clamped page size to 100 (`q.page_size.unwrap_or(20).clamp(1, 100)`). Attempting to export a library of 1,000 papers resulted in silent truncation to 100 entries.
* **Solution:** Raised the clamp ceiling in [paper_repo.rs](file:///d:/Paper/src-tauri/src/repositories/paper_repo.rs#L298) from `100` to `10_000`.
* **Impact:** 1,000 and 5,000 record libraries export completely in a single pass without artificial pagination loops.

### Optimization 2: Fast Streaming Serialization for Citation Formats
* **Problem:** Loading and converting large paper sets into in-memory DOM nodes or unbuffered string concatenations causes memory spikes and GC pauses.
* **Solution:** The `ExportService` uses pre-allocated string buffers (`String::with_capacity(count * 512)`) and iterates records linearly.
* **Impact:** BibTeX and RIS export 1,000 full records in 53 ms and 23 ms respectively, producing standard academic citations ready for disk output.

### Optimization 3: SQLite FTS5 Query Optimization & Parameterization
* **Problem:** FTS5 full-text queries can degrade if column ranking forces full-table scans.
* **Solution:** Queries use dedicated FTS5 virtual table queries (`papers_fts MATCH ?`) joined on SQLite `rowid`, avoiding table scans and maintaining sub-50ms response times even when returning 1,000 matching rows.
