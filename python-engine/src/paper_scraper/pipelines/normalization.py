"""
Item Normalization Pipeline.
Standardizes titles, abstracts, dates, and author lists across different scholarly sources.
"""

from __future__ import annotations

import re
from paper_scraper.models import PaperResult


class NormalizationPipeline:
    """Normalizes titles, DOI formats, abstracts, and publication dates."""

    def process_item(self, item: PaperResult, spider) -> PaperResult:
        # 1. Clean Title
        if item.title:
            cleaned = " ".join(item.title.split()).strip()
            # Remove trailing periods or quotes
            cleaned = re.sub(r'["\']+$', "", cleaned)
            item.title = cleaned

        # 2. Clean Abstract
        if item.abstract:
            clean_abs = " ".join(item.abstract.split()).strip()
            # Strip redundant prefix like "Abstract:" or "Abstract -"
            clean_abs = re.sub(r"^(abstract|summary)\s*[:\-\.]?\s*", "", clean_abs, flags=re.I)
            item.abstract = clean_abs

        # 3. Clean Authors
        if item.authors:
            cleaned_authors = []
            for a in item.authors:
                c = " ".join(a.split()).strip()
                if c and c not in cleaned_authors:
                    cleaned_authors.append(c)
            item.authors = cleaned_authors

        # 4. Normalize DOI
        if item.doi:
            item.doi = item.doi.lower().strip()
            item.doi = re.sub(r"^https?://(dx\.)?doi\.org/", "", item.doi)

        # 5. Extract year if missing
        if not item.publication_year and item.published_date:
            m = re.search(r"\b(19\d\d|20\d\d)\b", item.published_date)
            if m:
                item.publication_year = int(m.group(1))

        return item
