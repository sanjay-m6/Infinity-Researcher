"""
Scrapy Crawl Worker Process.
Runs Scrapy CrawlerProcess in an isolated subprocess to enable clean reactor lifecycle,
instant cancellation, and multi-crawl execution without Twisted ReactorNotRestartable errors.
"""

from __future__ import annotations

import logging
import multiprocessing
import os
import sys
import time
from typing import Any, Dict, List, Optional
from scrapy.crawler import CrawlerProcess

from paper_scraper.engine.settings import get_scrapy_settings
from paper_scraper.jobs.state import JobStorage
from paper_scraper.models import QueryFilter
from paper_scraper.spiders import SPIDER_REGISTRY

logger = logging.getLogger(__name__)


def _event_dispatcher(queue: multiprocessing.Queue, event_type: str, payload: Dict[str, Any], source_id: Optional[str] = None) -> None:
    """Put an event message onto the inter-process queue."""
    try:
        queue.put_nowait({
            "event_type": event_type,
            "payload": payload,
            "source_id": source_id,
        })
    except Exception as e:
        logger.error("Failed to put event on queue: %s", e)


def run_scrapy_worker(
    job_id: str,
    query: str,
    source_ids: List[str],
    filter_dict: Dict[str, Any],
    event_queue: multiprocessing.Queue,
    db_path: Optional[str] = None,
) -> None:
    """Entry point executed in the isolated worker process."""
    # Ensure worker process stdout NEVER pollutes the IPC pipe with Scrapy/warning messages
    sys.stdout = sys.stderr
    import warnings
    warnings.filterwarnings("ignore")

    start_time = time.time()
    storage = JobStorage(db_path)
    storage.record_job_start(job_id, query, source_ids)

    # Scrapy settings
    settings = get_scrapy_settings({
        "SQLITE_DB_PATH": db_path,
        "LOG_STDOUT": False,
    })

    process = CrawlerProcess(settings)
    spiders_to_run = []

    for sid in source_ids:
        spider_cls = SPIDER_REGISTRY.get(sid)
        if not spider_cls:
            _event_dispatcher(event_queue, "source.unsupported", {
                "source_id": sid,
                "message": f"Source '{sid}' not supported",
            }, source_id=sid)
            continue

        def make_sink(s_id: str):
            return lambda ev, pl, src=None: _event_dispatcher(event_queue, ev, pl, src or s_id)

        sink = make_sink(sid)

        # Notify source started
        _event_dispatcher(event_queue, "source.started", {
            "source_id": sid,
            "status": "searching",
        }, source_id=sid)

        process.crawl(
            spider_cls,
            query=query,
            job_id=job_id,
            limit=filter_dict.get("limit_per_source", 50),
            year_start=filter_dict.get("year_start"),
            year_end=filter_dict.get("year_end"),
            author=filter_dict.get("author"),
            event_sink=sink,
        )
        spiders_to_run.append(sid)

    try:
        if spiders_to_run:
            process.start()  # Blocks until all scheduled spiders finish
    except Exception as e:
        logger.error("Scrapy crawl process error: %s", e)
        for sid in spiders_to_run:
            _event_dispatcher(event_queue, "source.failed", {
                "source_id": sid,
                "message": str(e),
                "status": "failed",
            }, source_id=sid)
    finally:
        elapsed_ms = int((time.time() - start_time) * 1000)
        _event_dispatcher(event_queue, "worker.finished", {
            "duration_ms": elapsed_ms,
        })
