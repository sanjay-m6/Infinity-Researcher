"""
Unit tests for Scrapy Downloader Middlewares (Anti-SSRF and Scholar Retry).
"""

import pytest
from scrapy.exceptions import IgnoreRequest
from scrapy.http import HtmlResponse, Request, Response

from paper_scraper.middleware.anti_ssrf import AntiSsrfDownloaderMiddleware
from paper_scraper.middleware.retry import ScholarRetryMiddleware
from paper_scraper.spiders.arxiv import ArxivSpider


def test_anti_ssrf_middleware_blocks_private_and_cloud_ips():
    middleware = AntiSsrfDownloaderMiddleware(check_dns=False)
    spider = ArxivSpider(query="test")

    # 1. Loopback IP
    req_loopback = Request("http://127.0.0.1:8000/internal")
    with pytest.raises(IgnoreRequest, match="Anti-SSRF"):
        middleware.process_request(req_loopback, spider)

    # 2. RFC1918 Private IP
    req_private = Request("http://192.168.1.1/admin")
    with pytest.raises(IgnoreRequest, match="Anti-SSRF"):
        middleware.process_request(req_private, spider)

    # 3. AWS Metadata Endpoint
    req_cloud = Request("http://169.254.169.254/latest/meta-data/")
    with pytest.raises(IgnoreRequest, match="Anti-SSRF"):
        middleware.process_request(req_cloud, spider)

    # 4. Dangerous scheme
    req_file = Request("file:///etc/passwd")
    with pytest.raises(IgnoreRequest, match="Anti-SSRF"):
        middleware.process_request(req_file, spider)

    # 5. Public safe URL should pass without raising
    req_safe = Request("https://arxiv.org/abs/2401.05432")
    res = middleware.process_request(req_safe, spider)
    assert res is None


def test_anti_ssrf_middleware_blocks_oversize_response():
    middleware = AntiSsrfDownloaderMiddleware(check_dns=False)
    spider = ArxivSpider(query="test")

    # 16MB payload (exceeds 15MB limit)
    big_body = b"A" * (16 * 1024 * 1024)
    req = Request("https://arxiv.org/search")
    resp = Response("https://arxiv.org/search", request=req, body=big_body)

    with pytest.raises(IgnoreRequest, match="Payload too large"):
        middleware.process_response(req, resp, spider)


def test_anti_ssrf_middleware_blocks_redirect_to_private_network():
    middleware = AntiSsrfDownloaderMiddleware(check_dns=False)
    spider = ArxivSpider(query="test")

    req = Request("https://example.org/landing")
    # Redirects to loopback
    resp = Response(
        "https://example.org/landing",
        status=302,
        headers={"Location": "http://127.0.0.1:8080/admin"},
        request=req,
    )

    with pytest.raises(IgnoreRequest, match="Anti-SSRF blocked redirect"):
        middleware.process_response(req, resp, spider)


def test_scholar_retry_middleware_handles_retry_after():
    from scrapy.crawler import Crawler
    from scrapy.spiders import Spider
    from scrapy.settings import Settings
    from scrapy.statscollectors import MemoryStatsCollector

    spider = ArxivSpider(query="test")
    s = Settings({"RETRY_HTTP_CODES": [500, 502, 503, 504]})
    crawler = Crawler(Spider, s)
    crawler.stats = MemoryStatsCollector(crawler)
    crawler.spider = spider
    spider.crawler = crawler
    middleware = ScholarRetryMiddleware.from_crawler(crawler)

    # HTTP 429 with Retry-After header
    req = Request("https://arxiv.org/search")
    resp = Response("https://arxiv.org/search", status=429, headers={"Retry-After": "10"}, request=req)

    retried_req = middleware.process_response(req, resp, spider)
    assert spider.status == "rate_limited"
    assert retried_req is not None
    assert retried_req.meta.get("download_delay") == 10.0


def test_scholar_retry_middleware_does_not_evade_403_forbidden():
    from scrapy.crawler import Crawler
    from scrapy.spiders import Spider
    from scrapy.settings import Settings
    from scrapy.statscollectors import MemoryStatsCollector

    spider = ArxivSpider(query="test")
    s = Settings({"RETRY_HTTP_CODES": [500, 502, 503, 504]})
    crawler = Crawler(Spider, s)
    crawler.stats = MemoryStatsCollector(crawler)
    crawler.spider = spider
    spider.crawler = crawler
    middleware = ScholarRetryMiddleware.from_crawler(crawler)

    # HTTP 403 Forbidden
    req = Request("https://arxiv.org/restricted")
    resp = Response("https://arxiv.org/restricted", status=403, request=req)

    # Should NOT retry; should record blocked status
    out_resp = middleware.process_response(req, resp, spider)
    assert out_resp.status == 403
    assert spider.status == "blocked"
