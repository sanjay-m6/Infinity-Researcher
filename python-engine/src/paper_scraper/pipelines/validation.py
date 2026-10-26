"""
Item Validation Pipeline.
Ensures every extracted item conforms to data model requirements.
Drops malformed items missing essential scholarly identifiers or titles.
"""

from __future__ import annotations

import logging
from scrapy.exceptions import DropItem

from paper_scraper.models import PaperResult

logger = logging.getLogger(__name__)


class ValidationPipeline:
    """Validates raw extracted paper dictionaries or PaperResult items."""

    def process_item(self, item, spider):
        # Can accept dict or PaperResult
        if isinstance(item, PaperResult):
            paper_obj = item
        elif isinstance(item, dict):
            try:
                # Generate paper_id if missing
                if not item.get("paper_id"):
                    item["paper_id"] = PaperResult.generate_id(
                        item.get("source_id", "unknown"),
                        item.get("title", ""),
                        item.get("doi"),
                    )
                paper_obj = PaperResult(**item)
            except Exception as e:
                logger.warning("Dropping malformed paper item from %s: %s", getattr(spider, "name", "unknown"), e)
                raise DropItem(f"Validation failed: {e}")
        else:
            raise DropItem("Unknown item type yielded to ValidationPipeline")

        if not paper_obj.title or len(paper_obj.title.strip()) < 3:
            raise DropItem(f"Paper title too short or empty: {paper_obj.title}")

        return paper_obj
