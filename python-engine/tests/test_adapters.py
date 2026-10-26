import pytest
import respx
import httpx
from bs4 import BeautifulSoup

from paper_scraper.adapters.arxiv import ArxivAdapter
from paper_scraper.adapters.biorxiv import BiorxivAdapter
from paper_scraper.adapters.pubmed import PubmedAdapter
from paper_scraper.adapters.plos import PlosAdapter
from paper_scraper.models import QueryFilter


@pytest.mark.asyncio
@respx.mock
async def test_arxiv_adapter_extraction(arxiv_html):
    respx.get("https://arxiv.org/search/").respond(status_code=200, text=arxiv_html)

    adapter = ArxivAdapter()
    filter_req = QueryFilter(query="transformers")

    papers = []
    async with httpx.AsyncClient() as client:
        async for paper in adapter.search("transformers", filter_req, client):
            papers.append(paper)

    assert len(papers) == 2

    p1 = papers[0]
    assert "Attention Is All You Need" in p1.title
    assert "Ashish Vaswani" in p1.authors
    assert p1.publication_year == 2024
    assert p1.arxiv_id == "2401.05432"
    assert p1.pdf_url == "https://arxiv.org/pdf/2401.05432.pdf"
    assert p1.doi == "10.48550/arXiv.2401.05432"
    assert p1.metadata_confidence >= 0.8
    assert p1.source_id == "arxiv"

    p2 = papers[1]
    assert "Deep Learning for Graph Neural Networks" in p2.title
    assert "Jane Smith" in p2.authors
    assert p2.publication_year == 2023


@pytest.mark.asyncio
@respx.mock
async def test_biorxiv_adapter_extraction(biorxiv_html):
    respx.get("https://www.biorxiv.org/search/transcriptomic").respond(
        status_code=200, text=biorxiv_html
    )

    adapter = BiorxivAdapter()
    filter_req = QueryFilter(query="transcriptomic")

    papers = []
    async with httpx.AsyncClient() as client:
        async for paper in adapter.search("transcriptomic", filter_req, client):
            papers.append(paper)

    assert len(papers) == 1
    p = papers[0]
    assert "Single-cell Transcriptomic Atlas" in p.title
    assert "John Doe" in p.authors
    assert p.doi == "10.1101/2024.03.15.585123"
    assert p.pdf_url.endswith(".pdf")
    assert p.source_id == "biorxiv"


@pytest.mark.asyncio
@respx.mock
async def test_pubmed_adapter_extraction(pubmed_html):
    respx.get("https://pubmed.ncbi.nlm.nih.gov/").respond(
        status_code=200, text=pubmed_html
    )

    adapter = PubmedAdapter()
    filter_req = QueryFilter(query="crispr")

    papers = []
    async with httpx.AsyncClient() as client:
        async for paper in adapter.search("crispr", filter_req, client):
            papers.append(paper)

    assert len(papers) == 2
    p1 = papers[0]
    assert "CRISPR-Cas9 Specificity" in p1.title
    assert "Doudna JA" in p1.authors
    assert p1.publication_year == 2024
    assert p1.open_access_evidence == "Free PMC Article"
    assert p1.pdf_url == "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10892341/pdf/"


@pytest.mark.asyncio
@respx.mock
async def test_plos_adapter_extraction(plos_html):
    respx.get("https://journals.plos.org/plosone/search").respond(
        status_code=200, text=plos_html
    )

    adapter = PlosAdapter()
    filter_req = QueryFilter(query="machine learning")

    papers = []
    async with httpx.AsyncClient() as client:
        async for paper in adapter.search("machine learning", filter_req, client):
            papers.append(paper)

    assert len(papers) == 1
    p = papers[0]
    assert "Automated Machine Learning" in p.title
    assert "Elena Rostova" in p.authors
    assert p.doi == "10.1371/journal.pone.0298765"
    assert "CC BY 4.0" in p.open_access_evidence
    assert "type=printable" in p.pdf_url


@pytest.mark.asyncio
@respx.mock
async def test_zero_results_handling(zero_results_html):
    respx.get("https://arxiv.org/search/").respond(status_code=200, text=zero_results_html)

    adapter = ArxivAdapter()
    filter_req = QueryFilter(query="xyz999unobtainium")

    papers = []
    async with httpx.AsyncClient() as client:
        async for paper in adapter.search("xyz999unobtainium", filter_req, client):
            papers.append(paper)

    assert len(papers) == 0


@pytest.mark.asyncio
@respx.mock
async def test_malformed_html_handling(malformed_html):
    respx.get("https://arxiv.org/search/").respond(status_code=200, text=malformed_html)

    adapter = ArxivAdapter()
    filter_req = QueryFilter(query="corrupt")

    papers = []
    async with httpx.AsyncClient() as client:
        async for paper in adapter.search("corrupt", filter_req, client):
            papers.append(paper)

    # Malformed cards without titles should be gracefully skipped
    assert len(papers) == 0
