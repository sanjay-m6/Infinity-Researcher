# Phase 17 — PDF Discovery & Open-Access Retrieval Integration

**Subsystem**: Open-Access PDF Acquisition Subsystem  
**Module**: `src-tauri/src/academic_sources/` & `services/pdf_resolver_service.rs`  
**Phase**: Phase 17 Modernization  

---

## 1. Architectural Strategy

A core objective of Infinity Researcher is delivering frictionless transition from academic search discovery directly to full-text PDF reading. 

However, academic publishers frequently deploy deceptive landing pages:
- Links ending in `.pdf` that return HTML paywalls or login redirects.
- Cloudflare bot challenges and CAPTCHA interception on direct PDF endpoints.
- Ambiguous open-access licenses (e.g. green self-archived preprints vs gold publisher PDFs).

Phase 17 integrates authoritative PDF discovery directly into connector normalization and ties into the Phase 16 PDF acquisition pipeline.

---

## 2. Direct PDF Resolution by Provider

### 2.1 arXiv Adapter
- arXiv guarantees direct public PDF distribution.
- For every arXiv paper with identifier `YYMM.NNNNN`, the adapter deterministically resolves:
  $$\text{pdf\_url} = \text{"https://arxiv.org/pdf/"} + \text{record\_id} + \text{".pdf"}$$
- Open access is marked `true` with verified status.

### 2.2 OpenAlex Adapter
- OpenAlex tracks open-access host locations across institutional repositories, arXiv, PubMed Central, and publisher platforms.
- The adapter inspects `item.primary_location.pdf_url` and `item.open_access.is_oa`.
- When a verified direct PDF URL is present, it is extracted into `work.pdf_url`.

### 2.3 Semantic Scholar Adapter
- Semantic Scholar tracks open-access PDFs via its `openAccessPdf` graph field:
  $$\text{open\_access\_pdf.url} \longrightarrow \text{work.pdf\_url}$$
- The adapter extracts external identifiers (PubMed, arXiv, DOI) to provide fallback resolution paths.

### 2.4 Europe PMC Adapter
- Europe PMC differentiates open-access full-text records (`isOpenAccess == "Y"`).
- For PMC-indexed articles, direct PDF download links are constructed using the PMC identifier:
  $$\text{pdf\_url} = \text{"https://europepmc.org/backend/ptpmcrender.fcgi?accid="} + \text{pmcid} + \text{"&blobtype=pdf"}$$

---

## 3. Safe Metadata Merging for PDF Availability

When deduplicating search results across multiple providers:
- If Provider A (Crossref) indexes the formal publisher record with a DOI but no direct PDF link, and Provider B (arXiv or OpenAlex) indexes the preprint with a verified PDF link:
  1. The two works are merged into one.
  2. The unified work retains the authoritative DOI from Crossref.
  3. The unified work adopts the verified `pdf_url` from arXiv / OpenAlex.
  4. The unified work sets `is_open_access = true`.

This provides researchers with the best of both worlds: authoritative publisher citation metadata combined with immediate one-click PDF reading access.

