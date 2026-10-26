"""
Asynchronous HTTP Adapter-Based Search Orchestrator Engine.
Coordinates parallel source searches using registered site adapters,
relevance scoring, deduplication, and streaming events.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any, Callable, Dict, List, Optional
import httpx

from paper_scraper.adapters.registry import SourceRegistry
from paper_scraper.dedup import Deduplicator
from paper_scraper.models import PaperResult, QueryFilter, SourceSearchStatus
from paper_scraper.protocol import emit_event, emit_log
from paper_scraper.relevance import RelevanceScorer


class AdapterSearchEngine:
    """Orchestrates multi-source academic paper discovery with incremental streaming via HTTP adapters."""

    def __init__(self, registry: Optional[SourceRegistry] = None) -> None:
        self.registry = registry or SourceRegistry()
        self.relevance_scorer = RelevanceScorer()
        self.active_cancellations: Dict[str, asyncio.Event] = {}

    def cancel_job(self, job_id: str) -> bool:
        """Cancel an in-progress search job."""
        if job_id in self.active_cancellations:
            self.active_cancellations[job_id].set()
            emit_log("info", f"Cancelled search job {job_id}")
            return True
        return False

    async def execute_search(
        self,
        job_id: str,
        query: str,
        sources: Optional[List[str]] = None,
        filters: Optional[QueryFilter] = None,
        event_callback: Optional[Callable[[str, Dict[str, Any], Optional[str]], None]] = None,
    ) -> Dict[str, Any]:
        """
        Execute parallel search across configured sources and stream results.
        """
        start_time = time.time()
        cancel_event = asyncio.Event()
        self.active_cancellations[job_id] = cancel_event

        target_filter = filters or QueryFilter(query=query)
        available_descriptors = self.registry.list_descriptors()

        # Determine target source IDs
        if sources:
            target_source_ids = [
                s for s in sources if self.registry.get(s) is not None
            ]
        else:
            target_source_ids = [d.id for d in available_descriptors if d.status == "enabled"]

        deduplicator = Deduplicator()
        discovered_papers: List[PaperResult] = []

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

        async with httpx.AsyncClient(
            timeout=25.0,
            follow_redirects=True,
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=40),
        ) as client:

            async def search_single_source(source_id: str) -> SourceSearchStatus:
                adapter = self.registry.get(source_id)
                if not adapter:
                    return SourceSearchStatus(
                        source_id=source_id,
                        source_name=source_id,
                        status="unsupported",
                        message=f"No adapter registered for source '{source_id}'",
                    )

                source_start = time.time()
                dispatch_event("source.started", {
                    "source_name": adapter.name,
                    "status": "searching",
                }, source_id=source_id)

                count = 0
                status_str = "completed"
                error_msg = None

                try:
                    async for paper in adapter.search(query, target_filter, client):
                        if cancel_event.is_set():
                            status_str = "cancelled"
                            break

                        # Calculate relevance score with explanation
                        rel_score, rel_exp = self.relevance_scorer.score(
                            query=query,
                            title=paper.title,
                            abstract=paper.abstract,
                            authors=paper.authors,
                            publication_year=paper.publication_year,
                            has_pdf=paper.pdf_url is not None,
                            metadata_confidence=paper.metadata_confidence,
                            year_start=target_filter.year_start,
                            year_end=target_filter.year_end,
                        )
                        paper.relevance_score = rel_score
                        paper.relevance_explanation = rel_exp

                        # Deduplication check
                        is_dup, matched_id, dup_conf, dup_reason = deduplicator.check_and_register(paper)
                        if is_dup:
                            dispatch_event("paper.duplicate_candidate", {
                                "paper_id": paper.paper_id,
                                "matched_id": matched_id,
                                "confidence": dup_conf,
                                "reason": dup_reason,
                                "paper": paper.to_discovered_search_result(),
                            }, source_id=source_id)
                            # If exact match (1.0), skip emitting as new card
                            if dup_conf >= 0.99:
                                continue

                        count += 1
                        discovered_papers.append(paper)

                        # Emit paper discovered immediately!
                        dispatch_event("paper.discovered", {
                            "paper": paper.to_discovered_search_result(),
                        }, source_id=source_id)

                    if count == 0 and status_str != "cancelled":
                        status_str = "no_results"

                except Exception as e:
                    err_str = str(e)
                    error_msg = err_str
                    if "429" in err_str or "rate limit" in err_str.lower():
                        status_str = "rate_limited"
                    elif "403" in err_str or "forbidden" in err_str.lower() or "blocked" in err_str.lower():
                        status_str = "blocked"
                    else:
                        status_str = "failed"
                    emit_log("warn", f"Source {source_id} failed: {err_str}")

                elapsed = int((time.time() - source_start) * 1000)
                self.registry.record_outcome(
                    source_id,
                    success=(status_str in ("completed", "no_results")),
                    error_msg=error_msg,
                )

                if status_str == "blocked":
                    dispatch_event("source.blocked", {
                        "message": error_msg or "Access blocked by source restrictions",
                        "elapsed_ms": elapsed,
                    }, source_id=source_id)
                elif status_str in ("failed", "rate_limited"):
                    dispatch_event("source.failed", {
                        "status": status_str,
                        "message": error_msg or "Search failed",
                        "elapsed_ms": elapsed,
                    }, source_id=source_id)
                elif status_str != "cancelled":
                    dispatch_event("source.completed", {
                        "count": count,
                        "status": status_str,
                        "elapsed_ms": elapsed,
                    }, source_id=source_id)

                return SourceSearchStatus(
                    source_id=source_id,
                    source_name=adapter.name,
                    status=status_str,
                    message=error_msg,
                    results_count=count,
                    elapsed_ms=elapsed,
                )

            async def bounded_search_single_source(sid: str) -> SourceSearchStatus:
                try:
                    return await asyncio.wait_for(search_single_source(sid), timeout=18.0)
                except asyncio.TimeoutError:
                    elapsed = int((time.time() - start_time) * 1000)
                    dispatch_event("source.timed_out", {
                        "source_id": sid,
                        "message": "Source search timed out after 18s",
                        "elapsed_ms": elapsed,
                    }, source_id=sid)
                    return SourceSearchStatus(
                        source_id=sid,
                        source_name=sid,
                        status="timeout",
                        message="Source search timed out after 18s",
                        results_count=0,
                        elapsed_ms=elapsed,
                    )
                except Exception as exc:
                    elapsed = int((time.time() - start_time) * 1000)
                    dispatch_event("source.failed", {
                        "source_id": sid,
                        "message": str(exc),
                        "status": "failed",
                        "elapsed_ms": elapsed,
                    }, source_id=sid)
                    return SourceSearchStatus(
                        source_id=sid,
                        source_name=sid,
                        status="failed",
                        message=str(exc),
                        results_count=0,
                        elapsed_ms=elapsed,
                    )

            # Run all selected sources concurrently with bounded timeouts and exception shields
            tasks = [bounded_search_single_source(sid) for sid in target_source_ids]
            raw_statuses = await asyncio.gather(*tasks, return_exceptions=True)

            statuses: List[SourceSearchStatus] = []
            for idx, res in enumerate(raw_statuses):
                if isinstance(res, SourceSearchStatus):
                    statuses.append(res)
                elif isinstance(res, Exception):
                    sid = target_source_ids[idx] if idx < len(target_source_ids) else "unknown"
                    statuses.append(SourceSearchStatus(
                        source_id=sid,
                        source_name=sid,
                        status="failed",
                        message=str(res),
                        results_count=0,
                        elapsed_ms=int((time.time() - start_time) * 1000),
                    ))

        total_duration = int((time.time() - start_time) * 1000)

        # Cleanup cancellation handle
        self.active_cancellations.pop(job_id, None)

        # Emit exactly one immutable terminal event
        if cancel_event.is_set():
            dispatch_event("job.cancelled", {
                "total_found": len(discovered_papers),
                "duration_ms": total_duration,
            })
        elif len(discovered_papers) == 0:
            dispatch_event("job.no_results", {
                "duration_ms": total_duration,
            })
        elif any(s.status in ("failed", "timeout", "blocked", "rate_limited") for s in statuses):
            dispatch_event("job.completed_with_warnings", {
                "total_unique": len(discovered_papers),
                "duration_ms": total_duration,
                "failed_sources": [s.source_id for s in statuses if s.status != "completed"],
                "statuses": [s.model_dump() for s in statuses],
            })
        else:
            dispatch_event("job.completed", {
                "total_unique": len(discovered_papers),
                "duration_ms": total_duration,
                "statuses": [s.model_dump() for s in statuses],
            })

        return {
            "job_id": job_id,
            "results": [p.to_discovered_search_result() for p in discovered_papers],
            "source_statuses": [s.model_dump() for s in statuses],
            "total_results": len(discovered_papers),
            "duration_ms": total_duration,
            "status": "cancelled" if cancel_event.is_set() else ("no_results" if len(discovered_papers) == 0 else "completed"),
        }
