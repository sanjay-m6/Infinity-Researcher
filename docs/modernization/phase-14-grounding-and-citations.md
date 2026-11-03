# Phase 14 Grounding and Citation Verification

## 1. Traceable Page Citations

A core tenet of Infinity Researcher is that AI responses must never make unsubstantiated assertions. Every empirical claim, architectural specification, or limitation must trace back to concrete pages in the source PDF.

### 1.1 Citation Data Contract

Each passage retrieved and cited carries the following structure:

```typescript
export interface VerifiedEvidence {
  chunk_id: string;
  paper_id: string;
  page_number: number;
  section_heading?: string | null;
  snippet: string;
  is_verified: boolean;
  verification_method: "exact_match" | "token_overlap" | "backend_fts" | "unverified";
  confidence: number;
}
```

---

## 2. Verification Algorithms

### 2.1 Exact Substring Matching
- Normalizes both chunk content and citation snippet by removing punctuation, collapsing whitespace, and converting to lowercase.
- If normalized snippet length exceeds 10 characters and is an exact substring of the chunk content:
  - `is_verified`: `true`
  - `verification_method`: `"exact_match"`
  - `confidence`: `1.0`

### 2.2 Token Overlap Containment
When the LLM paraphrases slightly or excerpts non-contiguous clauses:
- Extracts significant tokens (length > 2) from snippet and source chunk.
- Calculates overlap ratio:
  $$\text{overlap} = \frac{|\text{Tokens}_{\text{snippet}} \cap \text{Tokens}_{\text{source}}|}{|\text{Tokens}_{\text{snippet}}|}$$
- If $\text{overlap} \ge 0.55$:
  - `is_verified`: `true`
  - `verification_method`: `"token_overlap"`
  - `confidence`: $\min(1.0, 0.6 + 0.4 \times \text{overlap})$
- If $\text{overlap} < 0.55$:
  - `is_verified`: `false`
  - `verification_method`: `"unverified"`
  - Flagged in UI with warning icon to alert user of potential hallucination.

---

## 3. Reader Integration

Citations rendered in the chat or analysis views are interactive buttons:
- Displays page number (`Page 3`) and verification status pill (`Exact Match`, `Token Overlap`).
- Clicking a citation activates `setReadingPaper(paper)` and jumps the embedded PDF reader directly to that page.
- Displays a toast indicating the navigated section and passage preview.

