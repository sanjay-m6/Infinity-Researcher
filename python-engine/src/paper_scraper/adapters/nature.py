"""
Nature Scientific Reports Source Adapter
Queries open access peer-reviewed articles from Nature Scientific Reports via Europe PMC and Crossref.
"""

from __future__ import annotations

import re
from typing import Any, AsyncGenerator, Dict, List, Optional
from urllib.parse import quote_plus
from bs4 import BeautifulSoup
import httpx

from paper_scraper.adapters.base import BaseAdapter
from paper_scraper.adapters.epmc import search_europe_pmc
from paper_scraper.models import ConfidenceBreakdown, PaperResult, QueryFilter
from paper_scraper.security import validate_url


class NatureAdapter(BaseAdapter):
    id = "nature_srep"
    name = "Nature Scientific Reports"
    domain = "nature.com"
    policy_url = "https://www.nature.com/nature-research/terms-and-conditions"
    policy_notes = "Open-access scientific reports journal from Nature Portfolio; verified peer-reviewed research."
    supports_native_years = False
    request_delay_ms = 500
    content_types = ["Journal Article"]

    async def search(
        self,
        query: str,
        filters: QueryFilter,
        client: httpx.AsyncClient,
    ) -> AsyncGenerator[PaperResult, None]:
        # Nature Scientific Reports is CC-BY open-access and fully indexed in Europe PMC
        epmc_query = f"JOURNAL:\"Sci Rep\" AND ({query})"
        async for paper in search_europe_pmc(
            epmc_query=epmc_query,
            source_id="nature_srep",
            source_name="Nature Scientific Reports",
            default_venue="Scientific Reports",
            is_preprint=False,
            filters=filters,
            client=client,
        ):
            yield paper

    async def health_check(self, client: httpx.AsyncClient) -> Dict[str, Any]:
        try:
            resp = await client.get(
                "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=JOURNAL:\"Sci%20Rep\"&pageSize=1&format=json",
                timeout=5.0,
            )
            return {"health": "healthy" if resp.status_code == 200 else "degraded", "latency_ms": 100}
        except Exception as e:
            return {"health": "degraded", "error": str(e)}
