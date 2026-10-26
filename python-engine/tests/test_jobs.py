"""
Unit tests for persistent SQLite job state and paper records.
"""

import os
import tempfile
import pytest

from paper_scraper.jobs.state import JobStorage
from paper_scraper.models import PaperResult


def test_job_storage_lifecycle():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name

    try:
        storage = JobStorage(db_path)

        # 1. Start job
        storage.record_job_start(
            job_id="job_abc",
            query="Deep learning transformers",
            sources=["arxiv", "biorxiv"],
        )

        job = storage.get_job("job_abc")
        assert job is not None
        assert job["query"] == "Deep learning transformers"
        assert job["status"] == "started"
        assert job["sources"] == ["arxiv", "biorxiv"]

        # 2. Record papers
        p1 = PaperResult(
            paper_id="paper_1",
            title="Transformer Scaling Laws",
            authors=["John Doe"],
            venue="arXiv",
            doi="10.48550/arXiv.2401.0001",
            source_id="arxiv",
            source_name="arXiv",
            source_page_url="https://arxiv.org/abs/2401.0001",
            landing_page_url="https://arxiv.org/abs/2401.0001",
            pdf_url="https://arxiv.org/pdf/2401.0001.pdf",
            relevance_score=0.95,
        )
        storage.record_paper("job_abc", p1)

        papers = storage.get_job_papers("job_abc")
        assert len(papers) == 1
        assert papers[0]["title"] == "Transformer Scaling Laws"
        assert papers[0]["canonical_doi"] == "10.48550/arXiv.2401.0001"

        # 3. Complete job
        storage.record_job_complete("job_abc", total_results=1, duration_ms=450, status="completed")
        updated_job = storage.get_job("job_abc")
        assert updated_job["status"] == "completed"
        assert updated_job["total_results"] == 1
        assert updated_job["duration_ms"] == 450

        # 4. List jobs
        jobs = storage.list_jobs(limit=10)
        assert len(jobs) >= 1
        assert jobs[0]["job_id"] == "job_abc"

    finally:
        import gc
        gc.collect()
        try:
            if os.path.exists(db_path):
                os.remove(db_path)
        except OSError:
            pass
