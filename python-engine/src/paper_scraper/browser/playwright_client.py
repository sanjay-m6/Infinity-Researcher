"""
Optional Playwright Browser Rendering Module.
Supports JavaScript-rendered scholarly pages on websites where automated browsing is permitted.
Enforces security, timeout bounds, and graceful fallbacks when Playwright is unavailable.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

# Check Playwright availability
try:
    from playwright.async_api import async_playwright  # type: ignore
    PLAYWRIGHT_AVAILABLE = True
except (ImportError, ModuleNotFoundError):
    async_playwright = None  # type: ignore
    PLAYWRIGHT_AVAILABLE = False


class BrowserRenderer:
    """Provides headless browser page rendering with SSRF checks and resource limits."""

    def __init__(self, headless: bool = True, timeout_ms: int = 15000) -> None:
        self.headless = headless
        self.timeout_ms = timeout_ms
        self._browser: Optional[Any] = None

    @classmethod
    def is_available(cls) -> bool:
        return PLAYWRIGHT_AVAILABLE

    async def render_page_html(self, url: str) -> Optional[str]:
        """
        Render JavaScript-heavy scholarly page and return populated HTML.
        Returns None if Playwright is unavailable or execution fails.
        """
        if not PLAYWRIGHT_AVAILABLE:
            logger.info("Playwright is not installed. Falling back to static HTTP retrieval for %s", url)
            return None

        from paper_scraper.security import validate_url, SecurityException
        try:
            validate_url(url, check_dns=True)
        except SecurityException as e:
            logger.warning("Browser renderer blocked unsafe URL %s: %s", url, e)
            return None

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=self.headless,
                    args=["--disable-dev-shm-usage", "--no-sandbox"],
                )
                context = await browser.new_context(
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
                )
                page = await context.new_page()
                await page.goto(url, wait_until="networkidle", timeout=self.timeout_ms)
                content = await page.content()
                await browser.close()
                return content
        except Exception as e:
            logger.warning("Playwright rendering failed for %s: %s", url, e)
            return None
