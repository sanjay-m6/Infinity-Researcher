# Phase 12: Multi-Signal Ranking & Deduplication Engine

## 1. Overview

Scholarly research discovery requires deterministic, explainable ranking and non-destructive record deduplication. Infinity Researcher Phase 12 introduces:
1. **Multi-Signal Academic Ranking Engine** (`src/lib/search/rankingEngine.ts`).
2. **Deterministic Academic Paper Deduplication Engine** (`src/lib/search/deduplicationEngine.ts`).

Together, these engines ensure that researchers see the most relevant, highest-quality papers at the top of their discovery feed while preserving complete provenance across multiple sources.

---

## 2. Multi-Signal Ranking Architecture

Rather than relying on opaque machine learning embeddings or arbitrary vendor relevance floats, Infinity Researcher calculates an **explainable, deterministic score** based on verified scholarly metadata signals:

### 2.1. Signal Scoring Hierarchy
| Match Signal | Score Points | Evaluation Criteria |
| :--- | :---: | :--- |
| **Exact DOI Match** | **1000** | Canonical or normalized DOI matches the query exactly. |
| **Partial DOI Match** | **750** | Normalized DOI contains query string. |
| **Exact Title Match** | **900** | Full title matches query exactly (case-insensitive). |
| **Title Prefix Match** | **800** | Paper title starts with query string. |
| **Title Token Overlap** | **Up to 650** | Ratio of query tokens present in title multiplied by 650. |
| **Exact Author Match** | **400** | Query author matches full name or surname of any co-author. |
| **Partial Author Match** | **250** | Author name contains author query substring. |
| **Abstract Token Overlap** | **Up to 250** | Ratio of query tokens present in abstract text multiplied by 250. |
| **Scholarly Venue Match** | **150** | Venue name contains venue query string. |

### 2.2. Deterministic Contextual Bonuses
When a baseline relevance match occurs ($\text{Base Score} > 0$), verified contextual quality bonuses are applied:
- **Recency Bonus**:
  - Publication year $\ge 2024$: **+30 points**
  - Publication year $2020 - 2023$: **+15 points**
- **Citation Impact Bonus**:
  - Calculated as $\min(40, \lfloor \text{citations} / 500 \rfloor)$, providing up to **+40 points** for highly cited foundational works.
- **Open Access Availability**: **+15 points** for unpaywalled, verified open-access literature.
- **Direct PDF Availability**: **+15 points** when a direct PDF URL or local PDF file is verified.

### 2.3. Deterministic Tie-Breaking
When two papers receive identical relevance scores, the engine breaks ties deterministically:
1. **Primary**: Relevance Score descending.
2. **Secondary**: Publication Year descending.
3. **Tertiary**: Citation Count descending.
4. **Quaternary**: Lexicographical Paper ID ascending.

---

## 3. Academic Paper Deduplication Engine

When harvesting papers from multiple repositories (e.g. arXiv and PubMed Central), duplicate records frequently emerge. Phase 12 implements strict cryptographic and metadata identity checks to merge records non-destructively:

### 3.1. Identity Signals
1. **Normalized Canonical DOI**:
   - Strips protocol headers (`https://doi.org/`, `dx.doi.org/`, `doi:`), lowercases, and removes trailing punctuation.
2. **Normalized Title + Publication Year**:
   - For records without registered DOIs, titles with $\ge 15$ characters are normalized (symbols removed, whitespace collapsed).
   - Records match if normalized titles are identical and publication years match within $\pm 1$ year (accommodating preprint vs journal publication lag).

### 3.2. Non-Destructive Merging Strategy
When duplicate records are identified, `mergeDuplicateRecords` preserves all metadata without loss:
- **Provenance URLs**: Combines all landing page URLs from both sources into `provenance_urls`.
- **Richest Abstract**: Retains the longer, more comprehensive abstract text.
- **Direct PDF Links**: Retains direct `.pdf` download links over landing pages.
- **Full Author Attribution**: Retains the more complete author list.
- **Highest Citation Count**: Adopts the higher citation count reported between the sources.
- **Open Access & Peer-Review Flags**: If either source confirms open access or peer review, the canonical record retains verified status.

