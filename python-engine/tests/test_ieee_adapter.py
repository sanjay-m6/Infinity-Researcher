import pytest
import respx
import httpx

from paper_scraper.adapters.ieee import IeeeAdapter
from paper_scraper.adapters.registry import SourceRegistry
from paper_scraper.models import QueryFilter
from paper_scraper.spiders import SPIDER_REGISTRY
from paper_scraper.spiders.ieee import IeeeSpider


@pytest.mark.asyncio
@respx.mock
async def test_ieee_adapter_rest_extraction():
    respx.post("https://ieeexplore.ieee.org/rest/search").respond(
        status_code=200,
        json={
            "records": [
                {
                    "articleTitle": "Deep Residual Learning for Image Recognition",
                    "authors": [
                        {"preferredName": "Kaiming He"},
                        {"preferredName": "Xiangyu Zhang"},
                    ],
                    "publicationYear": "2016",
                    "publicationTitle": "IEEE Conference on Computer Vision and Pattern Recognition",
                    "doi": "10.1109/CVPR.2016.90",
                    "documentLink": "/document/7780459",
                    "pdfLink": "/stamp/stamp.jsp?tp=&arnumber=7780459",
                    "isOpenAccess": True,
                    "abstract": "Deeper neural networks are more difficult to train.",
                    "contentType": "conference_paper",
                }
            ]
        },
    )

    adapter = IeeeAdapter()
    filter_req = QueryFilter(query="deep residual learning")

    papers = []
    async with httpx.AsyncClient() as client:
        async for paper in adapter.search("deep residual learning", filter_req, client):
            papers.append(paper)

    assert len(papers) == 1
    p = papers[0]
    assert p.title == "Deep Residual Learning for Image Recognition"
    assert "Kaiming He" in p.authors
    assert "Xiangyu Zhang" in p.authors
    assert p.publication_year == 2016
    assert p.doi == "10.1109/CVPR.2016.90"
    assert p.venue == "IEEE Conference on Computer Vision and Pattern Recognition"
    assert p.source_id == "ieee_xplore"
    assert p.landing_page_url == "https://ieeexplore.ieee.org/document/7780459"
    assert p.pdf_url == "https://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=7780459"
    assert p.pdf_access_status == "available"
    assert p.metadata_confidence >= 0.85


@pytest.mark.asyncio
@respx.mock
async def test_ieee_adapter_locked_paper_has_no_pdf_url():
    respx.post("https://ieeexplore.ieee.org/rest/search").respond(
        status_code=200,
        json={
            "records": [
                {
                    "articleTitle": "IoT-Enabled Big-Data Framework for Renewable Energy Forecasting",
                    "authors": [{"preferredName": "John Doe"}],
                    "publicationYear": "2026",
                    "publicationTitle": "IEEE TIC 2026",
                    "doi": "10.1109/TIC.2026.11703016",
                    "documentLink": "/document/11703016",
                    "pdfLink": "/stamp/stamp.jsp?tp=&arnumber=11703016",
                    "accessType": {"type": "locked", "message": "Full text access may be available."},
                    "isOpenAccess": False,
                    "abstract": "Locked conference paper.",
                    "contentType": "conference_paper",
                }
            ]
        },
    )

    adapter = IeeeAdapter()
    filter_req = QueryFilter(query="renewable energy forecasting")

    papers = []
    async with httpx.AsyncClient() as client:
        async for paper in adapter.search("renewable energy forecasting", filter_req, client):
            papers.append(paper)

    assert len(papers) == 1
    p = papers[0]
    assert p.title == "IoT-Enabled Big-Data Framework for Renewable Energy Forecasting"
    assert p.pdf_url is None
    assert p.pdf_access_status == "paywalled"


@pytest.mark.asyncio
@respx.mock
async def test_ieee_adapter_crossref_fallback():

    # Make IEEE REST search fail
    respx.post("https://ieeexplore.ieee.org/rest/search").respond(status_code=403)
    # Mock Crossref prefix response
    respx.get(url__regex=r"https://api\.crossref\.org/works.*prefix:10\.1109.*").respond(
        status_code=200,
        json={
            "message": {
                "items": [
                    {
                        "title": ["Robust Object Detection via Deep Convolutional Networks"],
                        "author": [
                            {"given": "Jane", "family": "Doe"}
                        ],
                        "published-print": {"date-parts": [[2021, 5, 12]]},
                        "container-title": ["IEEE Transactions on Pattern Analysis and Machine Intelligence"],
                        "DOI": "10.1109/TPAMI.2021.1234567",
                        "URL": "https://doi.org/10.1109/TPAMI.2021.1234567",
                        "abstract": "We present a unified object detection model.",
                        "license": [{"URL": "http://creativecommons.org/licenses/by/4.0/"}],
                        "type": "journal_article",
                    }
                ]
            }
        },
    )

    adapter = IeeeAdapter()
    filter_req = QueryFilter(query="robust object detection")

    papers = []
    async with httpx.AsyncClient() as client:
        async for paper in adapter.search("robust object detection", filter_req, client):
            papers.append(paper)

    assert len(papers) == 1
    p = papers[0]
    assert p.title == "Robust Object Detection via Deep Convolutional Networks"
    assert "Jane Doe" in p.authors
    assert p.publication_year == 2021
    assert p.doi == "10.1109/TPAMI.2021.1234567"
    assert p.venue == "IEEE Transactions on Pattern Analysis and Machine Intelligence"
    assert p.source_id == "ieee_xplore"
    assert p.landing_page_url == "https://doi.org/10.1109/TPAMI.2021.1234567"
    assert p.pdf_access_status == "open_access"


def test_ieee_registered_in_both_registries():
    # Verify in SourceRegistry
    registry = SourceRegistry()
    assert "ieee_xplore" in registry.adapters
    desc = registry.descriptors["ieee_xplore"]
    assert desc.status == "enabled"
    assert desc.domain == "ieeexplore.ieee.org"
    assert registry.get("ieee") is not None
    assert registry.get("ieee_xplore") is not None

    # Verify in SPIDER_REGISTRY
    assert "ieee" in SPIDER_REGISTRY
    assert "ieee_xplore" in SPIDER_REGISTRY
    assert SPIDER_REGISTRY["ieee_xplore"] is IeeeSpider
