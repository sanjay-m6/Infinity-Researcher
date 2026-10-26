# Similarity Scoring Rules, Denominators & Mathematical Foundations

## 1. Ethical Principle: Similarity $\ne$ Plagiarism

A text-similarity score measures **character and token overlap** between a query document and an indexed corpus. A high similarity score often reflects:
- Correctly attributed quotations
- Standard scientific equations and chemical nomenclature
- Common methodology phrasing (e.g., standard laboratory protocols)
- Institutional boilerplate (e.g., funding acknowledgments, ethics committee declarations)
- Extensive bibliographies and citation lists

Conversely, a low or zero similarity score simply means that **no matching passages were found within the indexed local corpus**. It does **not** prove that the work is original or plagiarism-free, because the corpus may not contain the unindexed source.

The application strictly displays:
> *"No matching passages found in the indexed corpus"*
instead of misleading terms like *"Plagiarism-Free"* or *"Original"*.

---

## 2. Denominator Definition & Section Exclusions

### 2.1 The Document Denominator ($D_{\text{total}}$)
The primary denominator is the **total character length of the query document's analyzed content**:

$$D_{\text{total}} = \sum_{s \in \text{AnalyzedSegments}} \text{len}(s.\text{content})$$

By default, the engine segments the document into:
1. `body` (Included in $D_{\text{total}}$)
2. `abstract` (Included in $D_{\text{total}}$)
3. `references` / `bibliography` (Excluded from default denominator when user toggles "Exclude References")
4. `boilerplate` (Institutional headers, publisher disclaimers; excludable upon review)

When references are excluded:
$$D_{\text{effective}} = D_{\text{total}} - \sum_{s \in \text{ReferencesSegments}} \text{len}(s.\text{content})$$

---

## 3. Span De-Duplication & Union Math

When multiple source documents match identical or overlapping passages in the query document, naive summation results in double-counting (where similarity could theoretically exceed 100%).

### 3.1 Interval Union Algorithm
To compute mathematically sound overlap:
1. Every candidate match between query document $Q$ and any source $S_j$ produces a query interval:
   $$I_k = [q_{\text{start}}^{(k)}, q_{\text{end}}^{(k)}]$$
2. The complete collection of intervals $\mathcal{I} = \{ I_1, I_2, \dots, I_m \}$ is sorted in ascending order of start offset:
   $$q_{\text{start}}^{(1)} \le q_{\text{start}}^{(2)} \le \dots \le q_{\text{start}}^{(m)}$$
3. Overlapping or contiguous intervals are merged:
   $$\text{If } q_{\text{start}}^{(k+1)} \le \max_{j \le k}(q_{\text{end}}^{(j)}), \quad \text{merge } [q_{\text{start}}^{(k)}, \max(q_{\text{end}}^{(k)}, q_{\text{end}}^{(k+1)})]$$
4. The **Net De-duplicated Matched Length** is the sum of disjoint merged intervals:
   $$L_{\text{net}} = \sum_{J \in \text{Merged}(\mathcal{I})} (J_{\text{end}} - J_{\text{start}})$$

### 3.2 Overall Similarity Ratio Formula
$$\text{Similarity Ratio} = \frac{L_{\text{net}}}{D_{\text{effective}}} \times 100\%$$

---

## 4. Per-Source Contribution Metric

While the overall ratio is de-duplicated across all sources, researchers also require a breakdown of how much each individual source contributed.

For each indexed source $S_j$:
1. Merge query intervals matched specifically against source $S_j$:
   $$L(S_j) = \sum_{K \in \text{Merged}(\mathcal{I}_{S_j})} (K_{\text{end}} - K_{\text{start}})$$
2. Compute source-specific overlap ratio:
   $$\text{Source Ratio}(S_j) = \frac{L(S_j)}{D_{\text{effective}}} \times 100\%$$

Note that:
$$\sum_{j} \text{Source Ratio}(S_j) \ge \text{Overall Similarity Ratio}$$
The sum of individual source ratios may exceed the overall ratio if multiple sources share identical boilerplate or verbatim citations. The UI clearly visualizes both metrics side-by-side to prevent confusion.

---

## 5. Match Classification & Review Workflow

Each individual matched span is assigned a review state:

| Review State | Description | Impact on Effective Score |
| :--- | :--- | :--- |
| `pending` | Initial unreviewed automated finding | Counted in preliminary score |
| `confirmed_match` | User verified identical passage without attribution | Counted in effective score |
| `quoted_with_citation` | Passage is inside quotation marks with valid citation | Deducted / separated from uncredited score |
| `boilerplate_excluded` | Standard institutional or methodological phrasing | Deducted from numerator and denominator |
| `not_a_match` | False-positive overlap (e.g., common idiom or formula) | Completely removed from score calculation |

### 5.1 Match Types
- `exact`: 100% verbatim character match exceeding Winnowing threshold ($k=16$ tokens).
- `fingerprint`: Shared sequence of Winnowing hash shingles with minor whitespace or punctuation variations.
- `fuzzy`: High token overlap with minor edits, word swaps, or synonym replacements.
- `semantic_candidate`: High embedding vector proximity ($\cos \theta \ge 0.85$) indicating thematic or paraphrase resemblance. Labeled strictly as *"Potentially Related Passage — Review Needed"*.
