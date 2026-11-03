# Access & Scholarly Version Classification

## 1. Version Classification Taxonomy

Scholarly publications exist across multiple distinct stages of peer review and formal publication. Infinity Researcher strictly distinguishes between these versions to prevent scientific misinterpretation:

| Version Identifier | Standard Name | Description | Provenance & Evidence Sources |
| :--- | :--- | :--- | :--- |
| `published_version` | Version of Record (VoR) | The final peer-reviewed, copyedited, formatted, and citable paper published in the journal or proceedings. | Publisher landing page, Gold/Hybrid Open Access, Crossref, Unpaywall `publishedVersion`. |
| `accepted_manuscript` | Author Accepted Manuscript (AAM) / Post-print | The final author version incorporating all peer-review revisions, accepted by the journal before publisher typesetting. | PubMed Central, Europe PMC, institutional repositories, Unpaywall `acceptedVersion`. |
| `preprint` | Author Preprint / Working Paper | The original draft deposited by the authors prior to or during peer review; has not been formally peer-reviewed by the target venue. | arXiv, bioRxiv, medRxiv, OpenAlex `submittedVersion`. |
| `repository_version` | Institutional Repository Copy | Deposited copy in university digital commons, Zenodo, or research institution repository. | OpenAlex `oa_locations`, CORE, university repositories. |
| `unknown_version` | Version Unspecified | Source did not supply sufficient evidence to classify the manuscript stage. | Fallback when metadata is ambiguous. |

---

## 2. Automated Version Detection from Extracted PDF Text

When candidate metadata does not explicitly specify the version stage, `PdfProcessor::detect_version_type` inspects the initial 6,000 characters of the extracted document stream for definitive keywords:

```rust
pub fn detect_version_type(text: &str) -> String {
    let lower = text[..text.len().min(6000)].to_lowercase();
    if lower.contains("arxiv:")
        || lower.contains("biorxiv preprint")
        || lower.contains("medrxiv preprint")
        || lower.contains("this preprint")
        || lower.contains("not peer-reviewed")
        || lower.contains("under review")
        || lower.contains("working paper")
    {
        "preprint".to_string()
    } else if lower.contains("accepted manuscript")
        || lower.contains("author's accepted manuscript")
        || lower.contains("author accepted manuscript")
        || lower.contains("post-print")
        || lower.contains("postprint")
        || lower.contains("peer-reviewed and accepted")
    {
        "accepted_manuscript".to_string()
    } else if lower.contains("institutional repository")
        || lower.contains("deposited in")
        || lower.contains("etd collection")
        || lower.contains("handle.net")
        || lower.contains("dspace")
        || lower.contains("eprints")
    {
        "repository_version".to_string()
    } else if lower.contains("published by")
        || lower.contains("all rights reserved")
        || (lower.contains("volume") && lower.contains("issue"))
        || lower.contains("ieee transactions")
        || lower.contains("proceedings of")
        || lower.contains("nature publishing")
        || lower.contains("elsevier b.v.")
        || lower.contains("springer nature")
        || lower.contains("wiley periodicals")
    {
        "published_version".to_string()
    } else {
        "unknown_version".to_string()
    }
}
```

---

## 3. Persistent Storage and Presentation

1. **Database Persistence**: Stored in `pdf_candidates.version_type`, `download_jobs.version_type`, `paper_files.version_type`, and `papers.pdf_version_type`.
2. **Visual Badging**:
   - `Preprint`: Purple pill badge (`bg-purple-50 text-purple-700`).
   - `Accepted Manuscript`: Blue pill badge (`bg-blue-50 text-blue-700`).
   - `Published Version`: Emerald pill badge (`bg-emerald-50 text-emerald-700`).
   - `Repository Copy`: Teal pill badge (`bg-teal-50 text-teal-700`).

