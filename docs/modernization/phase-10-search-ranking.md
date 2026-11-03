# Phase 10: Search Ranking & Scoring Specification

## 1. Overview

Search ranking in Infinity Researcher is deterministic, predictable, and requires zero external AI dependencies for basic querying. The ranking engine (`src/lib/search/rankingEngine.ts`) applies weighted heuristics to prioritize exact canonical identifiers (such as DOIs) and exact title matches over fuzzy partial hits.

---

## 2. Multi-Signal Scoring Formulas

### 2.1. Paper Scoring Weights

| Match Signal | Condition | Base Score |
| :--- | :--- | :--- |
| **Exact Canonical DOI** | `doi === cleanQuery` | **1000** |
| **Exact Title Match** | `title === cleanQuery` | **900** |
| **Title Prefix Match** | `title.startsWith(cleanQuery)` | **800** |
| **DOI Substring Match** | `doi.includes(cleanQuery)` | **700** |
| **Title Word / Substring** | `title.includes(cleanQuery)` | **650** |
| **Exact Author Match** | `authors.some(a === cleanQuery)` | **600** |
| **Author Prefix Match** | `authors.some(a.startsWith(cleanQuery))` | **550** |
| **Author Substring Match** | `authors.some(a.includes(cleanQuery))` | **500** |
| **Venue Match** | `venue.includes(cleanQuery)` | **400** |

#### Dynamic Contextual Boosts (Applied if Base Score > 0):
- **Saved in Library**: $+20\text{ points}$
- **Citation Velocity**: $+\min\left(50, \left\lfloor\frac{\text{citations}}{2000}\right\rfloor\right)$
- **Recent Publication**: $+\min(10, \text{year} - 2019)$ for papers published in 2020 or later.

---

### 2.2. Collection Scoring Weights

| Match Signal | Condition | Score |
| :--- | :--- | :--- |
| **Exact Collection Name** | `name === cleanQuery` | **850** |
| **Name Prefix Match** | `name.startsWith(cleanQuery)` | **750** |
| **Name Substring Match** | `name.includes(cleanQuery)` | **600** |
| **Description Substring** | `description.includes(cleanQuery)` | **350** |

---

### 2.3. Command & Tool Scoring Weights

| Match Signal | Condition | Score |
| :--- | :--- | :--- |
| **Exact Command Title** | `title === cleanQuery` | **920** |
| **Title Prefix Match** | `title.startsWith(cleanQuery)` | **820** |
| **Exact Keyword Match** | `keywords.includes(cleanQuery)` | **760** |
| **Title Substring Match** | `title.includes(cleanQuery)` | **680** |
| **Keyword Prefix Match** | `keywords.some(k.startsWith(cleanQuery))` | **620** |
| **Keyword Substring Match** | `keywords.some(k.includes(cleanQuery))` | **520** |
| **Description Match** | `description.includes(cleanQuery)` | **420** |

---

## 3. Deterministic Tie-Breaking & Bounding

1. **Category Quotas**:
   - Papers: Maximum 5 items.
   - Collections: Maximum 4 items.
   - Tools: Maximum 4 items.
   - Navigation: Maximum 4 items.
   - Actions: Maximum 3 items.
2. **Tie-Breaking Order**:
   - Higher calculated score $\to$ Newer publication year $\to$ Higher citation count $\to$ Alphabetical title order.

