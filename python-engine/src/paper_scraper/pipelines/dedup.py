"""
In-Crawl Deduplication Pipeline.
Filters duplicate papers across sources using normalized identifiers and RapidFuzz matching.
"""

from __future__ import annotations

import logging
from scrapy.exceptions import DropItem

from paper_scraper.deduplication.dedup import Deduplicator
from paper_scraper.models import PaperResult

logger = logging.getLogger(__name__)


class DeduplicationPipeline:
    """Detects duplicates and drops redundant instances while dispatching duplicate events."""

    def __init__(self) -> None:
        self.deduplicator = Deduplicator()

    @classmethod
    def from_crawler(cls, crawler):
        return cls()

    def process_item(self, item: PaperResult, spider) -> PaperResult:
        is_dup, matched_id, conf, reason = self.deduplicator.check_and_register(item)

        if is_dup:
            # Emit duplicate event to spider event sink
            if hasattr(spider, "dispatch_event"):
                spider.dispatch_event("paper.duplicate_candidate", {
                    "paper_id": item.paper_id,
                    "matched_id": matched_id,
                    "confidence": conf,
                    "reason": reason,
                    "paper": item.to_discovered_search_result(),
                })

            # If exact duplicate (conf >= 0.98), drop from primary result stream
            if conf >= 0.98:
                raise DropItem(f"Duplicate paper dropped: {reason} (matched {matched_id})")

        return item
