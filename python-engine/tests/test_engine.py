import pytest
import respx
import httpx
from typing import List, Tuple

from paper_scraper.adapters.registry import SourceRegistry
from paper_scraper.engine import SearchEngine
from paper_scraper.models import QueryFilter


@pytest.mark.asyncio
@respx.mock
async def test_search_engine_parallel_streaming(arxiv_html, pubmed_html):
    respx.get("https://arxiv.org/search/").respond(status_code=200, text=arxiv_html)
    respx.get("https://pubmed.ncbi.nlm.nih.gov/").respond(status_code=200, text=pubmed_html)

    engine = SearchEngine()
    emitted_events: List[Tuple[str, dict]] = []

    def on_event(event_type: str, payload: dict, source_id: str | None = None):
        emitted_events.append((event_type, payload))

    res = await engine.execute_search(
        job_id="job_test_stream",
        query="CRISPR transformer",
        sources=["arxiv", "pubmed"],
        event_callback=on_event,
    )

    assert res["total_results"] == 4
    event_types = [e[0] for e in emitted_events]
    assert "job.started" in event_types
    assert "source.started" in event_types
    assert "paper.discovered" in event_types
    assert "source.completed" in event_types
    assert "job.completed" in event_types

    # Ensure papers appear before job completion
    paper_events = [e for e in emitted_events if e[0] == "paper.discovered"]
    assert len(paper_events) == 4


@pytest.mark.asyncio
@respx.mock
async def test_search_engine_rate_limit_classification():
    # Simulate arXiv returning 429
    respx.get("https://arxiv.org/search/").respond(status_code=429)

    engine = SearchEngine()
    emitted_events = []

    res = await engine.execute_search(
        job_id="job_rate_limit",
        query="deep learning",
        sources=["arxiv"],
        event_callback=lambda et, pl, sid: emitted_events.append((et, pl, sid)),
    )

    statuses = res["source_statuses"]
    assert len(statuses) == 1
    assert statuses[0]["status"] == "rate_limited"
    assert "429" in statuses[0]["message"]

    failed_event = next(e for e in emitted_events if e[0] == "source.failed")
    assert failed_event[1]["status"] == "rate_limited"


@pytest.mark.asyncio
@respx.mock
async def test_search_engine_cancellation(arxiv_html):
    respx.get("https://arxiv.org/search/").respond(status_code=200, text=arxiv_html)

    engine = SearchEngine()
    # Cancel immediately
    engine.cancel_job("job_cancelled_1")

    res = await engine.execute_search(
        job_id="job_cancelled_1",
        query="physics",
        sources=["arxiv"],
    )

    # If job is cancelled before/during, it finishes cleanly
    assert res["job_id"] == "job_cancelled_1"


@pytest.mark.asyncio
@respx.mock
async def test_search_engine_no_results():
    # Return empty HTML for arxiv
    respx.get("https://arxiv.org/search/").respond(status_code=200, text="<html><body>No results found</body></html>")

    engine = SearchEngine()
    events = []

    res = await engine.execute_search(
        job_id="job_empty_test",
        query="nonexistent_xyz_query_12345",
        sources=["arxiv"],
        event_callback=lambda et, pl, sid: events.append((et, pl)),
    )

    assert res["status"] == "no_results"
    assert res["total_results"] == 0
    ev_types = [e[0] for e in events]
    assert "job.no_results" in ev_types


@pytest.mark.asyncio
@respx.mock
async def test_search_engine_partial_failure_continues(arxiv_html):
    # Arxiv succeeds, pubmed fails with 500 error
    respx.get("https://arxiv.org/search/").respond(status_code=200, text=arxiv_html)
    respx.get("https://pubmed.ncbi.nlm.nih.gov/").respond(status_code=500)

    engine = SearchEngine()
    events = []

    res = await engine.execute_search(
        job_id="job_partial_test",
        query="crispr",
        sources=["arxiv", "pubmed"],
        event_callback=lambda et, pl, sid: events.append((et, pl)),
    )

    # Arxiv papers are retained despite pubmed failure
    assert res["total_results"] == 2
    ev_types = [e[0] for e in events]
    assert "paper.discovered" in ev_types
    assert "source.failed" in ev_types
    assert "job.completed_with_warnings" in ev_types
