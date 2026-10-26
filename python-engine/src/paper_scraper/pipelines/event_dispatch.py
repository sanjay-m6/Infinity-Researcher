"""
Real-Time Event Dispatch Pipeline.
Streams paper.discovered events immediately to stdout / IPC sink as items are validated and scored.
"""

from __future__ import annotations

import logging
from paper_scraper.models import PaperResult

logger = logging.getLogger(__name__)


class EventDispatchPipeline:
    """Streams paper.discovered events in real-time as each item is finalized."""

    def process_item(self, item: PaperResult, spider) -> PaperResult:
        if hasattr(spider, "dispatch_event"):
            spider.dispatch_event("paper.discovered", {
                "paper": item.to_discovered_search_result(),
            })

        return item
