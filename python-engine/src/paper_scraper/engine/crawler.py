"""
Scrapy-based Crawl Orchestration and Lifecycle Engine.
Coordinates multi-source academic paper discovery with Scrapy,
pipelined deduplication, relevance scoring, SQLite persistence, and real-time streaming.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import subprocess
import sys
import threading
import time
from typing import Any, Callable, Dict, List, Optional

from paper_scraper.adapters.registry import SourceRegistry
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
        self.active_processes: Dict[str, subprocess.Popen] = {}
        self.cancelled_jobs: set[str] = set()

    def cancel_job(self, job_id: str) -> bool:
        """Cancel an in-progress search job immediately."""
        self.cancelled_jobs.add(job_id)
        proc = self.active_processes.get(job_id)
        if proc and proc.poll() is None:
            try:
                proc.terminate()
                try:
                    proc.wait(timeout=1.5)
                except subprocess.TimeoutExpired:
                    proc.kill()
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

        filter_dict = target_filter.model_dump()

        # Build isolated worker command
        if getattr(sys, "frozen", False):
            worker_cmd = [sys.executable, "--worker"]
        else:
            worker_cmd = [sys.executable, "-m", "paper_scraper", "--worker"]

        engine_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        env = dict(os.environ)
        if "PYTHONPATH" in env:
            env["PYTHONPATH"] = f"{engine_dir}{os.pathsep}{env['PYTHONPATH']}"
        else:
            env["PYTHONPATH"] = engine_dir

        try:
            worker_proc = subprocess.Popen(
                worker_cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=sys.stderr,
                text=True,
                encoding="utf-8",
                bufsize=1,
                cwd=engine_dir,
                env=env,
            )
        except Exception as spawn_err:
            logger.error("Failed to spawn worker subprocess: %s", spawn_err)
            total_duration = int((time.time() - start_time) * 1000)
            for s in target_source_ids:
                dispatch_event("source.failed", {
                    "source_id": s,
                    "status": "failed",
                    "message": f"Worker process spawn failure: {spawn_err}",
                    "elapsed_ms": total_duration,
                }, source_id=s)
            dispatch_event("job.failed", {
                "duration_ms": total_duration,
                "error": str(spawn_err),
            })
            return {
                "job_id": job_id,
                "results": [],
                "total_results": 0,
                "duration_ms": total_duration,
                "status": "failed",
            }

        self.active_processes[job_id] = worker_proc

        # Send worker configuration JSON line
        worker_cfg = {
            "job_id": job_id,
            "query": query,
            "source_ids": target_source_ids,
            "filter_dict": filter_dict,
            "db_path": self.storage.db_path,
        }
        try:
            worker_proc.stdin.write(json.dumps(worker_cfg) + "\n")
            worker_proc.stdin.flush()
        except Exception as e:
            logger.error("Failed writing config to worker process stdin: %s", e)

        discovered_papers: List[Dict[str, Any]] = []
        source_counts: Dict[str, int] = {s: 0 for s in target_source_ids}
        terminal_sources: set[str] = set()
        worker_finished = False
        timed_out = False

        loop = asyncio.get_running_loop()
        async_queue: asyncio.Queue = asyncio.Queue()

        def _reader_thread(pipe, l, q):
            try:
                for line in iter(pipe.readline, ""):
                    line = line.strip()
                    if line:
                        l.call_soon_threadsafe(q.put_nowait, line)
            except Exception:
                pass
            finally:
                l.call_soon_threadsafe(q.put_nowait, None)

        reader_t = threading.Thread(
            target=_reader_thread,
            args=(worker_proc.stdout, loop, async_queue),
            daemon=True,
        )
        reader_t.start()

        # Event polling loop - yields control to asyncio loop so stdin/other tasks are not blocked
        while True:
            if job_id in self.cancelled_jobs:
                break

            if (time.time() - start_time) > timeout_seconds:
                logger.warning("Scrapy search job %s exceeded timeout of %ss; terminating", job_id, timeout_seconds)
                timed_out = True
                break

            try:
                line = await asyncio.wait_for(async_queue.get(), timeout=0.1)
            except asyncio.TimeoutError:
                if worker_proc.poll() is not None and async_queue.empty():
                    break
                continue

            if line is None:
                # EOF reached from worker process
                break

            try:
                msg = json.loads(line)
            except Exception:
                continue

            ev_type = msg.get("event_type")
            pl = msg.get("payload", {})
            src = msg.get("source_id")

            if ev_type == "paper.discovered":
                p_data = pl.get("paper", {})
                discovered_papers.append(p_data)
                if src:
                    source_counts[src] = source_counts.get(src, 0) + 1
                dispatch_event(ev_type, pl, source_id=src)

            elif ev_type == "worker.finished":
                worker_finished = True
                break

            elif ev_type in ("source.completed", "source.failed", "source.blocked", "source.unsupported", "source.rate_limited"):
                if src:
                    terminal_sources.add(src)
                if ev_type == "source.completed":
                    if src and "count" not in pl:
                        pl["count"] = source_counts.get(src, 0)
                    if "elapsed_ms" not in pl:
                        pl["elapsed_ms"] = int((time.time() - start_time) * 1000)
                dispatch_event(ev_type, pl, source_id=src)

            else:
                dispatch_event(ev_type, pl, source_id=src)

        # Cleanup worker process safely
        if worker_proc.poll() is None:
            try:
                worker_proc.terminate()
                try:
                    worker_proc.wait(timeout=1.0)
                except subprocess.TimeoutExpired:
                    worker_proc.kill()
            except Exception as e:
                logger.warning("Error terminating worker process: %s", e)
        self.active_processes.pop(job_id, None)

        total_duration = int((time.time() - start_time) * 1000)

        # Guarantee every target source has a terminal status event
        for s in target_source_ids:
            if s not in terminal_sources:
                terminal_sources.add(s)
                c = source_counts.get(s, 0)
                dispatch_event("source.completed", {
                    "source_id": s,
                    "count": c,
                    "status": "completed" if c > 0 else "no_results",
                    "elapsed_ms": total_duration,
                }, source_id=s)

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
            source_statuses = [
                {
                    "source_id": s,
                    "source_name": s,
                    "status": "no_results" if source_counts.get(s, 0) == 0 else "completed",
                    "results_count": source_counts.get(s, 0),
                    "elapsed_ms": total_duration,
                }
                for s in target_source_ids
            ]
            dispatch_event("job.no_results", {
                "duration_ms": total_duration,
                "statuses": source_statuses,
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
