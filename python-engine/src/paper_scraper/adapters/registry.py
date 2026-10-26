"""
Source adapter registry.
Tracks source configurations, health status, and runtime statistics.
"""

from __future__ import annotations

import datetime
from typing import Dict, List, Optional
import httpx

from paper_scraper.adapters.arxiv import ArxivAdapter
from paper_scraper.adapters.base import BaseAdapter
from paper_scraper.adapters.biorxiv import BiorxivAdapter
from paper_scraper.adapters.medrxiv import MedrxivAdapter
from paper_scraper.adapters.nature import NatureAdapter
from paper_scraper.adapters.plos import PlosAdapter
from paper_scraper.adapters.pubmed import PubmedAdapter
from paper_scraper.models import SourceDescriptor


class SourceRegistry:
    """Manages available source adapters and their operational status."""

    def __init__(self) -> None:
        self.adapters: Dict[str, BaseAdapter] = {}
        self.descriptors: Dict[str, SourceDescriptor] = {}
        self.stats: Dict[str, Dict[str, int]] = {}

        # Register default source adapters
        self.register(ArxivAdapter())
        self.register(BiorxivAdapter())
        self.register(MedrxivAdapter())
        self.register(PubmedAdapter())
        self.register(PlosAdapter())
        self.register(NatureAdapter())

    def register(self, adapter: BaseAdapter) -> None:
        self.adapters[adapter.id] = adapter
        self.descriptors[adapter.id] = SourceDescriptor(
            id=adapter.id,
            name=adapter.name,
            domain=adapter.domain,
            status="enabled",
            policy_url=adapter.policy_url,
            policy_notes=adapter.policy_notes,
            supports_native_years=adapter.supports_native_years,
            request_delay_ms=adapter.request_delay_ms,
            content_types=adapter.content_types,
            health_status="healthy",
            success_rate=1.0,
        )
        self.stats[adapter.id] = {"successes": 0, "failures": 0}

    def get(self, source_id: str) -> Optional[BaseAdapter]:
        if source_id in self.adapters:
            return self.adapters[source_id]
        # Alias mappings
        if source_id == "pmc":
            return self.adapters.get("pubmed")
        if source_id == "pubmed":
            return self.adapters.get("pubmed")
        if source_id == "nature":
            return self.adapters.get("nature_srep")
        if source_id == "nature_srep":
            return self.adapters.get("nature_srep")
        return None

    def list_descriptors(self) -> List[SourceDescriptor]:
        return list(self.descriptors.values())

    def record_outcome(
        self,
        source_id: str,
        success: bool,

        error_msg: Optional[str] = None,
    ) -> None:
        """Update runtime success rate and health metrics for a source."""
        if source_id not in self.stats or source_id not in self.descriptors:
            return

        stat = self.stats[source_id]
        if success:
            stat["successes"] += 1
        else:
            stat["failures"] += 1

        total = stat["successes"] + stat["failures"]
        desc = self.descriptors[source_id]
        desc.success_rate = round(stat["successes"] / total, 2) if total > 0 else 1.0
        desc.last_health_check = datetime.datetime.now(datetime.timezone.utc).isoformat()

        if not success and error_msg and ("429" in error_msg or "rate limit" in error_msg.lower()):
            desc.health_status = "degraded"
        elif not success and error_msg and ("403" in error_msg or "blocked" in error_msg.lower()):
            desc.health_status = "blocked"
        elif desc.success_rate < 0.5:
            desc.health_status = "degraded"
        else:
            desc.health_status = "healthy"

    async def run_health_checks(self, client: httpx.AsyncClient) -> Dict[str, Dict[str, Any]]:
        """Run health checks across all registered source adapters."""
        results = {}
        for source_id, adapter in self.adapters.items():
            check = await adapter.health_check(client)
            results[source_id] = check
            desc = self.descriptors[source_id]
            desc.last_health_check = datetime.datetime.now(datetime.timezone.utc).isoformat()
            desc.health_status = check.get("health", "healthy")
        return results
