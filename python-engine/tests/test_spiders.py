"""
Unit tests for Scrapy spiders against deterministic local HTML fixtures.
"""

import os
import pytest
from scrapy.http import HtmlResponse, Request, TextResponse

from paper_scraper.spiders.arxiv import ArxivSpider
from paper_scraper.spiders.biorxiv import BiorxivSpider
from paper_scraper.spiders.plos import PlosSpider
from paper_scraper.spiders.pubmed import PubmedSpider

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")


def load_fixture(filename: str) -> str:
    path = os.path.join(FIXTURES_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def test_arxiv_spider_html_fixture():
    html_content = load_fixture("arxiv_search.html")
    spider = ArxivSpider(query="transformer", limit=5)
    request = Request(url="https://arxiv.org/search/?query=transformer")
    response = HtmlResponse(
        url="https://arxiv.org/search/?query=transformer",
        request=request,
        body=html_content.encode("utf-8"),
        encoding="utf-8",
    )

    items = list(spider.parse(response))
    assert len(items) == 2

    first = items[0]
    assert "Attention Is All You Need" in first.title
    assert "Ashish Vaswani" in first.authors
    assert first.arxiv_id == "2401.05432"
    assert first.pdf_url == "https://arxiv.org/pdf/2401.05432.pdf"
    assert first.publication_year == 2024


def test_biorxiv_spider_fixture():
    html_content = load_fixture("biorxiv_search.html")
    spider = BiorxivSpider(query="single cell genomics", limit=5)
    request = Request(url="https://www.biorxiv.org/search/single%20cell%20genomics")
    response = HtmlResponse(
        url="https://www.biorxiv.org/search/single%20cell%20genomics",
        request=request,
        body=html_content.encode("utf-8"),
        encoding="utf-8",
    )

    items = list(spider.parse(response))
    assert len(items) >= 1

    paper = items[0]
    assert "Single-cell Transcriptomic Atlas" in paper.title
    assert "10.1101/2024.03.15.585123" in paper.doi
    assert paper.venue == "bioRxiv"
    assert paper.pdf_url is not None


def test_pubmed_spider_fixture():
    html_content = load_fixture("pubmed_search.html")
    spider = PubmedSpider(query="cancer immunotherapy", limit=5)
    request = Request(url="https://pubmed.ncbi.nlm.nih.gov/?term=cancer+immunotherapy")
    response = HtmlResponse(
        url="https://pubmed.ncbi.nlm.nih.gov/?term=cancer+immunotherapy",
        request=request,
        body=html_content.encode("utf-8"),
        encoding="utf-8",
    )

    items = list(spider.parse(response))
    assert len(items) >= 1

    paper = items[0]
    assert "Mechanisms of CRISPR-Cas9" in paper.title
    assert "PMC10892341" in paper.pdf_url
    assert paper.pdf_access_status == "available"


def test_plos_spider_fixture():
    html_content = load_fixture("plos_search.html")
    spider = PlosSpider(query="crispr", limit=5)
    request = Request(url="https://journals.plos.org/plosone/search?q=crispr")
    response = HtmlResponse(
        url="https://journals.plos.org/plosone/search?q=crispr",
        request=request,
        body=html_content.encode("utf-8"),
        encoding="utf-8",
    )

    items = list(spider.parse(response))
    assert len(items) >= 1

    paper = items[0]
    assert "Automated Machine Learning" in paper.title
    assert "10.1371/journal.pone.0298765" in paper.doi
    assert paper.open_access_evidence is not None
    assert "printable" in paper.pdf_url
