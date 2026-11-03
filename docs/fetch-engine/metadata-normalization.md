# Scholarly Metadata Normalization & Cross-Source Deduplication

## 1. Unified Work Model (`NormalizedWork`)

Infinity Researcher unifies heterogeneous metadata formats across Crossref, OpenAlex, Semantic Scholar, arXiv, Europe PMC, and publisher landing pages into a standard domain representation:

```rust
pub struct NormalizedWork {
    pub id: String,
    pub canonical_doi: Option<String>,
    pub title: String,
    pub clean_title_key: String,
    pub abstract_text: Option<String>,
    pub publication_date: Option<String>,
    pub publication_year: Option<i32>,
    pub venue: Option<String>,
    pub venue_type: Option<String>,
    pub authors: Vec<NormalizedAuthor>,
    pub is_open_access: bool,
    pub landing_url: Option<String>,
    pub pdf_url: Option<String>,
    pub citation_count: Option<u32>,
    pub provider_id: ProviderId,
    pub provider_record_id: String,
    pub provenance: Vec<ProviderProvenance>,
    pub metadata_score: u8,
    pub completeness: MetadataCompleteness,
    pub version_type: Option<String>,
    pub pdf_status: Option<String>,
}
```

---

## 2. Normalization Rules

### 2.1 DOI Canonicalization
- Lowercase all characters.
- Trim leading URL prefixes:
  - `https://doi.org/`
  - `http://doi.org/`
  - `https://dx.doi.org/`
  - `doi:`
- Validate format matches standard prefix: `10.\d{4,9}/...`

### 2.2 Clean Title Key Generation
- Convert string to lowercase.
- Replace non-alphanumeric characters with spaces: `title.chars().map(|c| if c.is_alphanumeric() { c } else { ' ' })`.
- Collapse multiple whitespace characters into single space.
- Trim leading and trailing whitespace.
- Example: `"Attention Is All You Need!"` -> `"attention is all you need"`

### 2.3 Author Structuring
- Authors are normalized into structured records:
  ```rust
  pub struct NormalizedAuthor {
      pub name: String,
      pub orcid: Option<String>,
      pub affiliation: Option<String>,
  }
  ```
- ORCID identifiers are normalized to the canonical format `0000-0000-0000-0000`.

### 2.4 Metadata Completeness Scoring
Every record is evaluated against transparent completeness criteria (0 to 100):
- **Canonical DOI present**: +25 points
- **Non-empty Title**: +20 points
- **Abstract present**: +20 points
- **Structured Authors present**: +15 points
- **Publication Date / Year present**: +10 points
- **Venue / Journal name present**: +5 points
- **Direct PDF or Verified Open Access**: +5 points

---

## 3. Deduplication Architecture

1. **DOI Bucket Indexing**: All records with identical canonical DOIs are grouped together.
2. **Title Key Indexing**: For records lacking DOIs, the `clean_title_key` is matched against existing records. If title similarity exceeds 0.85 and either authors overlap or publication years match within +/- 1 year, records are merged.
3. **Conservative Merging**: Conflicting publication venues or differing abstracts are not overwritten blindly. Upstream record identifiers are preserved in `provenance`.

