# Phase 17 — Metadata Normalization & Quality Scoring Specification

**Subsystem**: Scholarly Metadata Pipeline  
**Module**: `src-tauri/src/services/metadata_normalizer.rs` & `academic_sources/types.rs`  
**Phase**: Phase 17 Modernization  

---

## 1. Executive Summary

Discovered academic papers originate from diverse protocols: XML Atom feeds (arXiv), JSON-LD (OpenAlex), REST JSON (Semantic Scholar, Europe PMC, Crossref), and scraped HTML meta tags. Phase 17 enforces strict normalization rules and introduces an objective 100-point metadata completeness scoring engine to assess record richness.

---

## 2. Canonical DOI Normalization Standard

Per ISO 26324 (Digital Object Identifier System), DOIs are case-insensitive character strings beginning with directory indicator `10.` followed by registrant code and suffix separator `/`.

### 2.1 Normalization Algorithm (`MetadataNormalizer::normalize_doi`)
```rust
pub fn normalize_doi(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() { return None; }

    // 1. Strip all known resolver and scheme prefixes
    let stripped = trimmed
        .strip_prefix("https://doi.org/")
        .or_else(|| trimmed.strip_prefix("http://doi.org/"))
        .or_else(|| trimmed.strip_prefix("https://dx.doi.org/"))
        .or_else(|| trimmed.strip_prefix("http://dx.doi.org/"))
        .or_else(|| trimmed.strip_prefix("doi:"))
        .or_else(|| trimmed.strip_prefix("DOI:"))
        .unwrap_or(trimmed)
        .trim();

    // 2. Validate standard prefix and suffix delimiter
    if stripped.starts_with("10.") && stripped.contains('/') {
        // 3. Trim trailing punctuation often introduced by bibliographic citations
        let cleaned = stripped.trim_end_matches(['.', ',', ';', ')', ']']);
        Some(cleaned.to_lowercase())
    } else {
        None
    }
}
```

### 2.2 Test Verification Cases
| Input String | Normalized Result | Note |
| :--- | :--- | :--- |
| `10.1038/s41586-020-2649-2` | `10.1038/s41586-020-2649-2` | Bare DOI |
| `https://doi.org/10.1145/3318464.3389700` | `10.1145/3318464.3389700` | HTTPS prefix stripped |
| `http://dx.doi.org/10.1016/j.cell.2020.08.001` | `10.1016/j.cell.2020.08.001` | Legacy DX prefix stripped |
| `DOI: 10.1109/CVPR.2016.90` | `10.1109/cvpr.2016.90` | Scheme stripped & lowercased |
| `https://doi.org/10.1038/s41586-020-2649-2.` | `10.1038/s41586-020-2649-2` | Trailing citation dot removed |
| `https://arxiv.org/abs/2104.12345` | `None` | Rejected (not a DOI) |

---

## 3. Title Normalization & Comparison Keys

To detect duplicates across minor formatting discrepancies:
1. **Display Title**: `MetadataNormalizer::normalize_display_title` collapses multiple whitespace runs while preserving mathematical notation, Greek letters, and punctuation.
2. **Clean Title Key**: `MetadataNormalizer::compute_title_key` converts title to lowercase and filters only alphanumeric characters (`[a-z0-9]`), removing spacing and punctuation:
   ```rust
   pub fn compute_clean_title_key(title: &str) -> String {
       title.to_lowercase().chars().filter(|c| c.is_alphanumeric()).collect()
   }
   ```

---

## 4. Author Name Normalization & Surname Extraction

Author representation handles both `"Family, Given"` and `"Given Family"` styles:
```rust
pub fn extract_family_name(full_name: &str) -> String {
    let cleaned = full_name.trim();
    if cleaned.contains(',') {
        cleaned.split(',').next().unwrap_or("").trim().to_lowercase()
    } else {
        cleaned.split_whitespace().last().unwrap_or("").to_lowercase()
    }
}
```
This enables robust cross-style matching between arXiv (`"Vaswani, Ashish"`) and Semantic Scholar (`"Ashish Vaswani"`).

---

## 5. Metadata Completeness Scoring Model

Each `NormalizedWork` carries an objective completeness score (0–100) calculated by `compute_completeness`:

| Metadata Attribute | Points Assigned | Criteria |
| :--- | :--- | :--- |
| **Canonical DOI** | 25 points | Non-empty valid canonical DOI present |
| **Title** | 20 points | Non-empty sanitized title |
| **Abstract** | 20 points | Non-empty abstract text (minimum 20 chars) |
| **Authors** | 15 points | At least one normalized author entry |
| **Publication Date / Year** | 10 points | Parsed ISO date or publication year |
| **Publication Venue** | 5 points | Journal, conference, or repository venue name |
| **Direct PDF / OA Link** | 5 points | Verified direct PDF URL or confirmed OA status |
| **Total Maximum** | **100 points** | Complete academic record |

The resulting `MetadataCompleteness` struct is returned to the frontend and enables researchers to identify papers needing enrichment or verification.

