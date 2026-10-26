"""
Scrapy-based Crawl Orchestration and Lifecycle Engine.
Coordinates multi-source academic paper discovery with Scrapy,
pipelined deduplication, relevance scoring, SQLite persistence, and real-time streaming.
"""

from __future__ import annotations

import asyncio
import logging
import multiprocessing
import os
import queue
import time
from typing import Any, Callable, Dict, List, Optional

from paper_scraper.adapters.registry import SourceRegistry
from paper_scraper.engine.worker import run_scrapy_worker
from paper_scraper.jobs.state import JobStorage
from paper_scraper.models import PaperResult, QueryFilter, SourceSearchStatus
from paper_scraper.protocol import emit_event, emit_log
from paper_scraper.spiders import SPIDER_REGISTRY

logger = logging.getLogger(__name__)


class ScrapySearchEngine:
    """Orchestrates multi-spider academic paper discovery with incremental streaming."""

    def __init__(self, registry: Optional[SourceRegistry] = None, db_path: Optional[str] = None) -> None:
        self.registry = registry or SourceRegistry()
        self.storage = JobStorage(db_path)
        self.active_processes: Dict[str, multiprocessing.Process] = {}
        self.cancelled_jobs: set[str] = set()

    def cancel_job(self, job_id: str) -> bool:
        """Cancel an in-progress search job immediately."""
        self.cancelled_jobs.add(job_id)
        proc = self.active_processes.get(job_id)
        if proc and proc.is_alive():
            try:
                proc.terminate()
                proc.join(timeout=2.0)
            except Exception as e:
                logger.warning("Error terminating worker process for %s: %s", job_id, e)

            self.active_processes.pop(job_id, None)
            self.storage.record_job_complete(job_id, 0, 0, status="cancelled")
            emit_log("info", f"Cancelled Scrapy search job {job_id}")
            return True
        return False

    async def execute_search(
        self,
        job_id: str,
        query: str,
        sources: Optional[List[str]] = None,
        filters: Optional[QueryFilter] = None,
        event_callback: Optional[Callable[[str, Dict[str, Any], Optional[str]], None]] = None,
        timeout_seconds: float = 25.0,
    ) -> Dict[str, Any]:
        """
        Execute parallel Scrapy crawl across configured sources and stream results.
        Guarantees bounded completion within timeout_seconds.
        """
        start_time = time.time()
        if job_id in self.cancelled_jobs:
            if event_callback:
                event_callback("job.cancelled", {"total_found": 0, "duration_ms": 0}, None)
            else:
                emit_event("job.cancelled", job_id, {"total_found": 0, "duration_ms": 0}, source_id=None)
            return {
                "job_id": job_id,
                "results": [],
                "total_results": 0,
                "duration_ms": 0,
                "status": "cancelled",
            }

        target_filter = filters or QueryFilter(query=query)
        available_descriptors = self.registry.list_descriptors()

        # Determine target source IDs
        if sources:
            target_source_ids = [
                s for s in sources if s in SPIDER_REGISTRY or any(d.id == s and d.status == "enabled" for d in available_descriptors)
            ]
        else:
            target_source_ids = [d.id for d in available_descriptors if d.status == "enabled" and d.id in SPIDER_REGISTRY]

        def dispatch_event(event_type: str, payload: Dict[str, Any], source_id: Optional[str] = None) -> None:
            if event_callback:
                event_callback(event_type, payload, source_id)
            else:
                emit_event(event_type, job_id, payload, source_id=source_id)

        # Emit job started event
        dispatch_event("job.started", {
            "query": query,
            "sources": target_source_ids,
        })

        # Inter-process queue for live streaming
        event_queue = multiprocessing.Queue()
        filter_dict = target_filter.model_dump()

        worker_proc = multiprocessing.Process(
            target=run_scrapy_worker,
            args=(job_id, query, target_source_ids, filter_dict, event_queue, self.storage.db_path),
            daemon=True,
        )
        self.active_processes[job_id] = worker_proc
        worker_proc.start()

        discovered_papers: List[Dict[str, Any]] = []
        source_counts: Dict[str, int] = {s: 0 for s in target_source_ids}
        worker_finished = False
        timed_out = False

        # Event polling loop - yields control to asyncio loop so stdin/other tasks are not blocked
        while True:
            if job_id in self.cancelled_jobs:
                break

            if (time.time() - start_time) > timeout_seconds:
                logger.warning("Scrapy search job %s exceeded timeout of %ss; terminating", job_id, timeout_seconds)
                timed_out = True
                break

            try:
                # Read from queue non-blocking
                while True:
                    try:
                        msg = event_queue.get_nowait()
                    except queue.Empty:
                        break

                    ev_type = msg["event_type"]
                    pl = msg["payload"]
                    src = msg.get("source_id")

                    if ev_type == "paper.discovered":
                        p_data = pl.get("paper", {})
                        discovered_papers.append(p_data)
                        if src:
                            source_counts[src] = source_counts.get(src, 0) + 1
                        dispatch_event(ev_type, pl, source_id=src)

                    elif ev_type == "worker.finished":
                        worker_finished = True

                    elif ev_type == "source.completed":
                        if src and "count" not in pl:
                            pl["count"] = source_counts.get(src, 0)
                        if "elapsed_ms" not in pl:
                            pl["elapsed_ms"] = int((time.time() - start_time) * 1000)
                        dispatch_event(ev_type, pl, source_id=src)

                    else:
                        dispatch_event(ev_type, pl, source_id=src)

            except Exception as e:
                logger.error("Error reading from crawl event queue: %s", e)

            if worker_finished or not worker_proc.is_alive():
                break

            await asyncio.sleep(0.05)

        # Drain any trailing items left in the queue
        try:
            while True:
                try:
                    msg = event_queue.get_nowait()
                except queue.Empty:
                    break
                ev_type = msg["event_type"]
                pl = msg["payload"]
                src = msg.get("source_id")
                if ev_type == "paper.discovered":
                    discovered_papers.append(pl.get("paper", {}))
                    if src:
                        source_counts[src] = source_counts.get(src, 0) + 1
                    dispatch_event(ev_type, pl, source_id=src)
        except Exception:
            pass

        # Cleanup process safely
        if worker_proc.is_alive():
            try:
                worker_proc.terminate()
                worker_proc.join(timeout=1.0)
            except Exception as e:
                logger.warning("Error terminating worker process: %s", e)
        self.active_processes.pop(job_id, None)

        total_duration = int((time.time() - start_time) * 1000)

        # Ensure every job reaches exactly one immutable terminal state
        if job_id in self.cancelled_jobs:
            self.storage.record_job_complete(job_id, len(discovered_papers), total_duration, status="cancelled")
            dispatch_event("job.cancelled", {
                "total_found": len(discovered_papers),
                "duration_ms": total_duration,
            })
        elif timed_out:
            self.storage.record_job_complete(job_id, len(discovered_papers), total_duration, status="timed_out")
            if discovered_papers:
                dispatch_event("job.completed_with_warnings", {
                    "total_unique": len(discovered_papers),
                    "duration_ms": total_duration,
                    "failed_sources": [s for s in target_source_ids if source_counts.get(s, 0) == 0],
                    "reason": "timed_out",
                })
            else:
                dispatch_event("job.timed_out", {
                    "total_found": 0,
                    "duration_ms": total_duration,
                    "reason": f"Search exceeded deadline of {timeout_seconds}s",
                })
        elif len(discovered_papers) == 0:
            self.storage.record_job_complete(job_id, 0, total_duration, status="no_results")
            dispatch_event("job.no_results", {
                "duration_ms": total_duration,
            })
        else:
            self.storage.record_job_complete(job_id, len(discovered_papers), total_duration, status="completed")
            source_statuses = [
                {
                    "source_id": s,
                    "source_name": s,
                    "status": "completed" if source_counts.get(s, 0) > 0 else "no_results",
                    "results_count": source_counts.get(s, 0),
                    "elapsed_ms": total_duration,
                }
                for s in target_source_ids
            ]
            dispatch_event("job.completed", {
                "total_unique": len(discovered_papers),
                "duration_ms": total_duration,
                "statuses": source_statuses,
            })

        return {
            "job_id": job_id,
            "results": discovered_papers,
            "total_results": len(discovered_papers),
            "duration_ms": total_duration,
            "status": "cancelled" if job_id in self.cancelled_jobs else ("timed_out" if timed_out else ("no_results" if len(discovered_papers) == 0 else "completed")),
        }


# Drop-in alias
SearchEngine = ScrapySearchEngine
