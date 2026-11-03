"""
Regression tests for Scrapy 2.19 spider lifecycle, robotstxt obey policy,
challenge detection, error classification, and multi-source terminal event guarantees.
"""

import os
import inspect
import pytest
from scrapy.http import HtmlResponse, Request, Response
from twisted.python.failure import Failure
from scrapy.spidermiddlewares.httperror import HttpError
from twisted.internet.error import TimeoutError, DNSLookupError

from paper_scraper.spiders.base import BasePaperSpider
from paper_scraper.spiders.arxiv import ArxivSpider
from paper_scraper.spiders.biorxiv import BiorxivSpider
from paper_scraper.spiders.medrxiv import MedrxivSpider
from paper_scraper.spiders.plos import PlosSpider
from paper_scraper.spiders.nature import NatureSpider
from paper_scraper.spiders.pubmed import PubmedSpider

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")


def load_fixture(filename: str) -> str:
    path = os.path.join(FIXTURES_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


@pytest.mark.asyncio
async def test_scrapy_2_19_start_generator_lifecycle():
    """
    CRITICAL REGRESSION: In Scrapy 2.19, ExecutionEngine.open_spider_async iterates
    over `spider.start()`. If start() is not overridden to bridge to start_requests(),
    Scrapy yields from empty start_urls and closes the spider with 0 requests scheduled!
    """
    spider = ArxivSpider(query="machine learning", limit=5)
    
    # Must have an async generator start method
    assert inspect.isasyncgenfunction(spider.start)
    
    requests = []
    async for req in spider.start():
        requests.append(req)
        
    assert len(requests) > 0
    assert any("arxiv.org/search" in r.url for r in requests)


def test_robotstxt_obey_disabled_for_public_search():
    """
    Verify that ROBOTSTXT_OBEY is explicitly False so search requests
    are not pre-emptively dropped by RobotsTxtMiddleware before network dispatch.
    """
    spider = ArxivSpider(query="test", limit=5)
    assert spider.custom_settings.get("ROBOTSTXT_OBEY") is False


def test_arxiv_spider_fixture_parsing():
    html_content = load_fixture("arxiv_search.html")
    spider = ArxivSpider(query="transformer", limit=5)
    request = Request(url="https://arxiv.org/search/?query=transformer")
    response = HtmlResponse(
        url="https://arxiv.org/search/?query=transformer",
        request=request,
        body=html_content.encode("utf-8"),
        encoding="utf-8",
        status=200,
    )

    items = list(spider.parse(response))
    assert len(items) == 2
    assert "Attention Is All You Need" in items[0].title
    assert items[0].arxiv_id == "2401.05432"
    assert items[0].pdf_url == "https://arxiv.org/pdf/2401.05432.pdf"
    spider.results_count = len(items)
    spider.spider_closed(spider, reason="finished")
    assert spider.terminal_status == "completed"


def test_biorxiv_spider_fixture_parsing():
    html_content = load_fixture("biorxiv_search.html")
    spider = BiorxivSpider(query="single cell", limit=5)
    request = Request(url="https://www.biorxiv.org/search/single%20cell")
    response = HtmlResponse(
        url="https://www.biorxiv.org/search/single%20cell",
        request=request,
        body=html_content.encode("utf-8"),
        encoding="utf-8",
        status=200,
    )

    items = list(spider.parse(response))
    assert len(items) >= 1
    assert "Single-cell Transcriptomic Atlas" in items[0].title
    spider.results_count = len(items)
    spider.spider_closed(spider, reason="finished")
    assert spider.terminal_status == "completed"


def test_plos_spider_fixture_parsing():
    html_content = load_fixture("plos_search.html")
    spider = PlosSpider(query="machine learning", limit=5)
    request = Request(url="https://journals.plos.org/plosone/search?q=machine+learning")
    response = HtmlResponse(
        url="https://journals.plos.org/plosone/search?q=machine+learning",
        request=request,
        body=html_content.encode("utf-8"),
        encoding="utf-8",
        status=200,
    )

    items = list(spider.parse(response))
    assert len(items) >= 1
    assert "Automated Machine Learning" in items[0].title
    spider.results_count = len(items)
    spider.spider_closed(spider, reason="finished")
    assert spider.terminal_status == "completed"


def test_pubmed_spider_fixture_parsing():
    html_content = load_fixture("pubmed_search.html")
    spider = PubmedSpider(query="cancer", limit=5)
    request = Request(url="https://pubmed.ncbi.nlm.nih.gov/?term=cancer")
    response = HtmlResponse(
        url="https://pubmed.ncbi.nlm.nih.gov/?term=cancer",
        request=request,
        body=html_content.encode("utf-8"),
        encoding="utf-8",
        status=200,
    )

    items = list(spider.parse(response))
    assert len(items) >= 1
    assert "Mechanisms of CRISPR-Cas9" in items[0].title
    spider.results_count = len(items)
    spider.spider_closed(spider, reason="finished")
    assert spider.terminal_status == "completed"


def test_nature_spider_europepmc_json_parsing():
    json_data = (
        '{"resultList":{"result":[{"id":"38291024","title":"Machine learning for medical imaging",'
        '"authorString":"Smith J, Doe A","pubYear":"2024","journalTitle":"Sci Rep",'
        '"doi":"10.1038/s41598-024-51234-x","isOpenAccess":"Y",'
        '"abstractText":"Deep learning methods have shown remarkable performance.",'
        '"fullTextUrlList":{"fullTextUrl":[{"documentStyle":"pdf","url":"https://europepmc.org/articles/PMC10828472?pdf=render"}]}}]}}'
    )
    spider = NatureSpider(query="medical imaging", limit=5)
    request = Request(url="https://www.ebi.ac.uk/europepmc/webservices/rest/search")
    response = Response(
        url="https://www.ebi.ac.uk/europepmc/webservices/rest/search",
        request=request,
        body=json_data.encode("utf-8"),
        status=200,
    )

    items = list(spider.parse(response))
    assert len(items) == 1
    assert items[0].title == "Machine learning for medical imaging"
    assert items[0].doi == "10.1038/s41598-024-51234-x"
    assert items[0].pdf_url == "https://europepmc.org/articles/PMC10828472?pdf=render"
    spider.results_count = len(items)
    spider.spider_closed(spider, reason="finished")
    assert spider.terminal_status == "completed"


def test_zero_results_terminal_classification():
    html_content = load_fixture("zero_results.html")
    spider = ArxivSpider(query="xyzunmatchedquery99999", limit=5)
    request = Request(url="https://arxiv.org/search/?query=xyzunmatchedquery99999")
    response = HtmlResponse(
        url="https://arxiv.org/search/?query=xyzunmatchedquery99999",
        request=request,
        body=html_content.encode("utf-8"),
        encoding="utf-8",
        status=200,
    )

    items = list(spider.parse(response))
    assert len(items) == 0
    spider.results_count = 0
    spider.spider_closed(spider, reason="finished")
    # On 0 items, closed spider must report truthful terminal status 'no_results'
    assert spider.terminal_status == "no_results"


def test_cloudflare_challenge_detection():
    challenge_html = "<html><head><title>Just a moment...</title></head><body>Verify you are human. Cloudflare Ray ID: 89324029</body></html>"
    spider = BiorxivSpider(query="test", limit=5)
    request = Request(url="https://www.biorxiv.org/search/test")
    response = HtmlResponse(
        url="https://www.biorxiv.org/search/test",
        request=request,
        body=challenge_html.encode("utf-8"),
        encoding="utf-8",
        status=403,
    )

    is_blocked, reason = spider.is_challenge_or_blocked_response(response)
    assert is_blocked is True
    items = list(spider.parse(response))
    assert len(items) == 0
    assert spider.terminal_status == "blocked"
    assert "403" in spider.error_message or "forbidden" in spider.error_message.lower()


def test_handle_error_classification():
    spider = ArxivSpider(query="test", limit=5)
    events = []
    spider.event_sink = lambda ev_type, pl, sid=None: events.append((ev_type, pl))

    # Test HTTP 403
    request = Request(url="https://arxiv.org")
    resp_403 = Response(url="https://arxiv.org", status=403, request=request)
    failure_403 = Failure(HttpError(resp_403, "Forbidden"))
    spider.handle_error(failure_403)
    assert spider.terminal_status == "blocked"
    assert any(ev[0] == "source.blocked" and ev[1].get("status") == "blocked" for ev in events)

    # Test Timeout
    events.clear()
    failure_timeout = Failure(TimeoutError("Connection timed out"))
    spider.handle_error(failure_timeout)
    assert spider.terminal_status == "timeout"
    assert any(ev[0] == "source.timeout" and ev[1].get("status") == "timeout" for ev in events)
