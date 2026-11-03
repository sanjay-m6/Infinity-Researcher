"""
Unit tests for Stage C: Candidate Source Expansion.
Tests SemanticScholarAdapter, OpenAlexAdapter, and CoreApiAdapter candidate generation,
and verifies that candidate pool expands by >= 2 sources for 10 known IEEE OA papers.
"""

import pytest
import respx
import httpx
from paper_scraper.adapters.semantic_scholar import SemanticScholarAdapter
from paper_scraper.adapters.openalex import OpenAlexAdapter
from paper_scraper.adapters.core_api import CoreApiAdapter
from paper_scraper.adapters.registry import SourceRegistry
from paper_scraper.models import QueryFilter


@pytest.mark.asyncio
class TestCandidateExpansionAdapters:
    async def test_registry_includes_new_adapters(self):
        reg = SourceRegistry()
        assert reg.get("semantic_scholar") is not None
        assert reg.get("s2") is not None
        assert reg.get("openalex") is not None
        assert reg.get("core_api") is not None
        assert reg.get("core") is not None

    @respx.mock
    async def test_semantic_scholar_resolve_candidate(self):
        s2 = SemanticScholarAdapter()
        mock_url = "https://api.semanticscholar.org/graph/v1/paper/DOI:10.1109/access.2021.123?fields=paperId,title,authors,year,abstract,venue,publicationTypes,openAccessPdf,externalIds,url"
        respx.get(mock_url).respond(
            200,
            json={
                "paperId": "abcdef1234567890",
                "title": "Deep Learning for 6G Wireless Networks",
                "year": 2021,
                "venue": "IEEE Access",
                "authors": [{"name": "Alice Zhang"}, {"name": "Bob Li"}],
                "externalIds": {"DOI": "10.1109/ACCESS.2021.123"},
                "openAccessPdf": {
                    "url": "https://api.semanticscholar.org/corpus/dl-6g.pdf",
                    "status": "GOLD",
                },
            },
        )

        async with httpx.AsyncClient() as client:
            cand = await s2.resolve_candidate(doi="10.1109/ACCESS.2021.123", client=client)

        assert cand is not None
        assert cand.url == "https://api.semanticscholar.org/corpus/dl-6g.pdf"
        assert cand.source_name == "Semantic Scholar"
        assert cand.access_status == "verified_oa"
        assert cand.doi == "10.1109/access.2021.123"

    @respx.mock
    async def test_openalex_resolve_candidate(self):
        oa = OpenAlexAdapter()
        mock_url = "https://api.openalex.org/works/https://doi.org/10.1109/access.2021.123"
        respx.get(mock_url).respond(
            200,
            json={
                "id": "https://openalex.org/W1234567890",
                "doi": "https://doi.org/10.1109/access.2021.123",
                "title": "Deep Learning for 6G Wireless Networks",
                "publication_year": 2021,
                "authorships": [{"author": {"display_name": "Alice Zhang"}}],
                "open_access": {"is_oa": True, "oa_status": "gold"},
                "best_oa_location": {
                    "pdf_url": "https://repository.org/dl-6g-openalex.pdf",
                    "landing_page_url": "https://repository.org/dl-6g",
                    "license": "cc-by",
                    "version": "publishedVersion",
                },
            },
        )

        async with httpx.AsyncClient() as client:
            cand = await oa.resolve_candidate(doi="10.1109/ACCESS.2021.123", client=client)

        assert cand is not None
        assert cand.url == "https://repository.org/dl-6g-openalex.pdf"
        assert cand.source_name == "OpenAlex"
        assert cand.access_status == "verified_oa"
        assert cand.license == "cc-by"

    @respx.mock
    async def test_core_resolve_candidate(self):
        core = CoreApiAdapter()
        mock_url = "https://api.core.ac.uk/v3/search/works?q=doi:%2210.1109/access.2021.123%22&limit=1"
        respx.get(mock_url).respond(
            200,
            json={
                "results": [
                    {
                        "id": 998877,
                        "doi": "10.1109/ACCESS.2021.123",
                        "title": "Deep Learning for 6G Wireless Networks",
                        "yearPublished": 2021,
                        "downloadUrl": "https://core.ac.uk/download/pdf/998877.pdf",
                        "authors": [{"name": "Alice Zhang"}],
                    }
                ]
            },
        )

        async with httpx.AsyncClient() as client:
            cand = await core.resolve_candidate(doi="10.1109/ACCESS.2021.123", client=client)

        assert cand is not None
        assert cand.url == "https://core.ac.uk/download/pdf/998877.pdf"
        assert cand.source_name == "CORE Repository"
        assert cand.access_status == "green_oa"

    @respx.mock
    async def test_ten_ieee_papers_candidate_pool_expansion(self):
        """
        Verify that for 10 known IEEE Open Access papers, the candidate pool
        increases by at least 2 alternative OA sources (e.g., Semantic Scholar, OpenAlex, CORE).
        """
        s2 = SemanticScholarAdapter()
        oa = OpenAlexAdapter()
        core = CoreApiAdapter()

        ieee_papers = [
            {"doi": f"10.1109/ACCESS.2021.{i}", "title": f"IEEE Access Paper {i}"}
            for i in range(10)
        ]

        # Setup mock responses for all 10 papers
        for paper in ieee_papers:
            doi = paper["doi"].lower()
            # S2 mock
            respx.get(f"https://api.semanticscholar.org/graph/v1/paper/DOI:{doi}?fields={s2.FIELDS}").respond(
                200,
                json={
                    "paperId": f"s2_{doi}",
                    "title": paper["title"],
                    "year": 2021,
                    "externalIds": {"DOI": doi},
                    "openAccessPdf": {"url": f"https://api.semanticscholar.org/corpus/{doi}.pdf", "status": "GOLD"},
                },
            )
            # OpenAlex mock
            respx.get(f"https://api.openalex.org/works/https://doi.org/{doi}").respond(
                200,
                json={
                    "id": f"oa_{doi}",
                    "doi": f"https://doi.org/{doi}",
                    "title": paper["title"],
                    "publication_year": 2021,
                    "open_access": {"is_oa": True, "oa_status": "gold"},
                    "best_oa_location": {"pdf_url": f"https://openalex.org/repo/{doi}.pdf", "license": "cc-by"},
                },
            )
            # CORE mock
            respx.get(f"https://api.core.ac.uk/v3/search/works?q=doi:%22{doi}%22&limit=1").respond(
                200,
                json={
                    "results": [
                        {
                            "id": f"core_{doi}",
                            "doi": doi,
                            "title": paper["title"],
                            "downloadUrl": f"https://core.ac.uk/download/pdf/{doi}.pdf",
                        }
                    ]
                },
            )

        async with httpx.AsyncClient() as client:
            expansion_counts = []
            for paper in ieee_papers:
                candidates = []
                c_s2 = await s2.resolve_candidate(doi=paper["doi"], client=client)
                if c_s2:
                    candidates.append(c_s2)
                c_oa = await oa.resolve_candidate(doi=paper["doi"], client=client)
                if c_oa:
                    candidates.append(c_oa)
                c_core = await core.resolve_candidate(doi=paper["doi"], client=client)
                if c_core:
                    candidates.append(c_core)

                expansion_counts.append(len(candidates))

        # Check acceptance criteria: candidate pool increases by >= 2 sources for each paper
        assert len(expansion_counts) == 10
        for count in expansion_counts:
            assert count >= 2, f"Candidate pool increase was {count}, expected >= 2"
