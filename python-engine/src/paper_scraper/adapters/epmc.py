"""
Europe PMC Open Access Academic Search Helper.
Queries the official, free, open Europe PMC REST API for peer-reviewed papers
and preprints (bioRxiv, medRxiv, PLOS, Nature Sci Rep, PubMed Central).
"""

from __future__ import annotations

import re
from typing import AsyncGenerator, Dict, List, Optional
from urllib.parse import quote_plus
import httpx

from paper_scraper.models import ConfidenceBreakdown, PaperResult, QueryFilter
from paper_scraper.security import validate_url


def strip_html_tags(text: str) -> str:
    cleaned = re.sub(r"<[^>]+>", "", text)
    return (
        cleaned.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .strip()
    )


async def search_europe_pmc(
    epmc_query: str,
    source_id: str,
    source_name: str,
    default_venue: str,
    is_preprint: bool,
    filters: QueryFilter,
    client: httpx.AsyncClient,
) -> AsyncGenerator[PaperResult, None]:
    limit = filters.limit_per_source or 50
    url = (
        f"https://www.ebi.ac.uk/europepmc/webservices/rest/search"
        f"?query={quote_plus(epmc_query)}&resultType=core&format=json&pageSize={limit}"
    )
    validate_url(url)

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json",
    }

    resp = await client.get(url, headers=headers)
    if resp.status_code == 429:
        raise RuntimeError("Europe PMC rate limit reached (HTTP 429).")
    if resp.status_code != 200:
        raise RuntimeError(f"Europe PMC returned HTTP {resp.status_code}")

    data = resp.json()
    items = data.get("resultList", {}).get("result", [])

    yielded_count = 0
    for item in items:
        if yielded_count >= limit:
            break

        raw_title = item.get("title", "")
        title = strip_html_tags(raw_title).rstrip(".").strip()
        if not title:
            continue

        # Authors
        authors: List[str] = []
        author_list = item.get("authorList", {}).get("author", [])
        if isinstance(author_list, list) and author_list:
            for a in author_list:
                name = a.get("fullName") or ""
                if name.strip():
                    authors.append(name.strip())
        elif item.get("authorString"):
            for part in item["authorString"].split(","):
                if part.strip():
                    authors.append(part.strip())

        # Publication Year
        pub_year_str = item.get("pubYear")
        pub_year = None
        if pub_year_str:
            try:
                pub_year = int(pub_year_str)
            except ValueError:
                pass

        if filters.year_start and pub_year and pub_year < filters.year_start:
            continue
        if filters.year_end and pub_year and pub_year > filters.year_end:
            continue

        if filters.author and authors:
            if not any(filters.author.lower() in a.lower() for a in authors):
                continue

        doi = item.get("doi")
        if doi:
            doi = doi.strip()
        pmcid = item.get("pmcid")
        if pmcid:
            pmcid = pmcid.strip()

        abstract_raw = item.get("abstractText")
        abstract = strip_html_tags(abstract_raw) if abstract_raw else None

        # Landing URL
        if doi:
            landing_url = f"https://doi.org/{doi}"
        elif pmcid:
            landing_url = f"https://europepmc.org/article/PMC/{pmcid}"
        else:
            src = item.get("source", "MED")
            ext_id = item.get("id", "")
            landing_url = f"https://europepmc.org/article/{src}/{ext_id}"

        # PDF URL
        pdf_url = None
        full_text_list = item.get("fullTextUrlList", {}).get("fullTextUrl", [])
        if isinstance(full_text_list, list):
            for ft in full_text_list:
                doc_style = (ft.get("documentStyle") or "").lower()
                u = ft.get("url") or ""
                if doc_style == "pdf" or u.lower().endswith(".pdf") or "pdf=render" in u.lower():
                    pdf_url = u
                    break

        if not pdf_url and doi:
            if source_id == "biorxiv":
                pdf_url = f"https://www.biorxiv.org/content/{doi}.full.pdf"
            elif source_id == "medrxiv":
                pdf_url = f"https://www.medrxiv.org/content/{doi}.full.pdf"
            elif source_id == "plos":
                pdf_url = f"https://journals.plos.org/plosone/article/file?id={doi}&type=printable"

        if not pdf_url and pmcid:
            pdf_url = f"https://europepmc.org/articles/{pmcid}?pdf=render"

        is_oa = (
            is_preprint
            or source_id in ("plos", "nature_srep", "nature")
            or item.get("isOpenAccess") == "Y"
        )
        venue = item.get("journalTitle") or default_venue

        doc_type = "preprint" if is_preprint else "journal_article"
        paper_id = PaperResult.generate_id(source_id, title, doi)

        conf = ConfidenceBreakdown(
            title=1.0,
            authors=0.9 if authors else 0.0,
            doi=1.0 if doi else 0.0,
            pdf=0.9 if pdf_url else 0.0,
            abstract=0.9 if abstract else 0.0,
        )

        paper = PaperResult(
            paper_id=paper_id,
            title=title,
            authors=authors,
            abstract=abstract,
            publication_year=pub_year,
            published_date=f"{pub_year}-01-01" if pub_year else None,
            venue=venue,
            publisher=item.get("bookOrReportDetails", {}).get("publisher") or source_name,
            doi=doi,
            source_id=source_id,
            source_name=source_name,
            source_page_url=landing_url,
            landing_page_url=landing_url,
            pdf_url=pdf_url,
            pdf_access_status="available" if pdf_url else "unknown",
            open_access_evidence="Europe PMC Open Access" if is_oa else None,
            license_text="Creative Commons (CC-BY)" if is_oa else None,
            document_type=doc_type,
            metadata_confidence=conf.compute_composite(),
            confidence_breakdown=conf,
            keywords=["open_access"] if is_oa else [],
        )

        yielded_count += 1
        yield paper
