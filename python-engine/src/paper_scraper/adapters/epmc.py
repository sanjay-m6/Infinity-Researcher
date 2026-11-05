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


async def _search_crossref_fallback(
    source_id: str,
    source_name: str,
    default_venue: str,
    is_preprint: bool,
    filters: QueryFilter,
    client: httpx.AsyncClient,
) -> AsyncGenerator[PaperResult, None]:
    """Resilient fallback querying Crossref works index when Europe PMC is unavailable."""
    limit = filters.limit_per_source or 50
    clean_query = filters.query.strip() if (filters and filters.query) else "academic research"

    # Select appropriate Crossref filter parameter by source
    if source_id == "biorxiv":
        filter_param = "prefix:10.1101"
        fallback_venue = "bioRxiv Preprints"
    elif source_id == "medrxiv":
        filter_param = "prefix:10.1101"
        fallback_venue = "medRxiv Preprints"
    elif source_id in ("nature", "nature_srep"):
        filter_param = "prefix:10.1038"
        fallback_venue = "Nature Scientific Reports"
    else:
        filter_param = "type:journal-article"
        fallback_venue = default_venue or "PubMed Central"

    crossref_url = (
        f"https://api.crossref.org/works?query={quote_plus(clean_query)}"
        f"&filter={filter_param}&rows={limit}"
    )

    try:
        validate_url(crossref_url)
        cr_resp = await client.get(
            crossref_url,
            headers={"User-Agent": "InfinityResearcher/1.0 (mailto:dev@infinityresearcher.org)"},
            timeout=15.0,
        )
        if cr_resp.status_code != 200:
            return

        cr_data = cr_resp.json()
        cr_items = cr_data.get("message", {}).get("items", [])
        yielded = 0

        for item in cr_items:
            if yielded >= limit:
                break

            raw_title = (item.get("title") or [""])[0]
            title = strip_html_tags(raw_title).rstrip(".").strip()
            if not title:
                continue

            authors: List[str] = []
            for a in item.get("author", []):
                given = a.get("given", "").strip()
                family = a.get("family", "").strip()
                if given and family:
                    authors.append(f"{given} {family}")
                elif family:
                    authors.append(family)
                elif a.get("name"):
                    authors.append(a["name"].strip())
            if not authors:
                authors.append(f"{source_name} Author")

            pub_year = None
            date_parts = (
                (item.get("published-print") or {}).get("date-parts")
                or (item.get("published-online") or {}).get("date-parts")
                or (item.get("created") or {}).get("date-parts")
            )
            if date_parts and date_parts[0]:
                try:
                    pub_year = int(date_parts[0][0])
                except (ValueError, TypeError):
                    pass

            if filters.year_start and pub_year and pub_year < filters.year_start:
                continue
            if filters.year_end and pub_year and pub_year > filters.year_end:
                continue
            if filters.author and authors:
                if not any(filters.author.lower() in a.lower() for a in authors):
                    continue

            venue_list = item.get("container-title") or []
            venue = venue_list[0] if venue_list else fallback_venue
            doi = item.get("DOI", "").strip() or None
            landing_url = item.get("URL") or (f"https://doi.org/{doi}" if doi else "https://doi.org")
            abstract = strip_html_tags(item.get("abstract")) if item.get("abstract") else None

            pdf_url = None
            is_oa = is_preprint
            if source_id == "biorxiv" and doi:
                pdf_url = f"https://www.biorxiv.org/content/{doi}.full.pdf"
                is_oa = True
            elif source_id == "medrxiv" and doi:
                pdf_url = f"https://www.medrxiv.org/content/{doi}.full.pdf"
                is_oa = True
            elif source_id in ("nature", "nature_srep"):
                if doi and "10.1038/" in doi:
                    art_id = doi.split("10.1038/")[1]
                    pdf_url = f"https://www.nature.com/articles/{art_id}.pdf"
                is_oa = True
            else:
                for link_entry in item.get("link", []):
                    raw_u = link_entry.get("URL", "")
                    c_type = (link_entry.get("content-type") or "").lower()
                    if "pdf" in c_type or raw_u.endswith(".pdf"):
                        pdf_url = raw_u.replace("http://", "https://")
                        is_oa = True
                        break

            licenses = item.get("license") or []
            if not is_oa:
                is_oa = any(
                    "creativecommons.org" in (lic.get("URL") or "").lower()
                    or "/open-access" in (lic.get("URL") or "").lower()
                    or "/oa/" in (lic.get("URL") or "").lower()
                    for lic in licenses
                )

            if filters.open_access_only and not is_oa:
                continue

            breakdown = ConfidenceBreakdown(
                title=1.0,
                authors=0.9 if authors else 0.5,
                abstract=0.9 if abstract else 0.0,
                doi=1.0 if doi else 0.0,
                pdf=0.9 if pdf_url else 0.0,
            )
            paper_id = PaperResult.generate_id(source_id, title, doi)

            yield PaperResult(
                paper_id=paper_id,
                title=title,
                authors=authors,
                abstract=abstract,
                publication_year=pub_year,
                published_date=str(pub_year) if pub_year else None,
                venue=venue,
                publisher=source_name,
                doi=doi,
                source_id=source_id,
                source_name=source_name,
                source_page_url=landing_url,
                landing_page_url=landing_url,
                pdf_url=pdf_url,
                pdf_access_status="available" if pdf_url else ("open_access" if is_oa else "paywalled"),
                open_access_evidence="Open Access" if is_oa else None,
                license_text=f"{source_name} Open Access" if is_oa else "All Rights Reserved",
                document_type="Preprint" if is_preprint else "Journal Article",
                language="en",
                keywords=[source_name],
                metadata_confidence=breakdown.compute_composite(),
                confidence_breakdown=breakdown,
                extraction_method=f"crossref_{source_id}_fallback",
            )
            yielded += 1
    except Exception:
        pass


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

    items = []
    epmc_error: Optional[Exception] = None
    try:
        validate_url(url)
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json",
        }
        resp = await client.get(url, headers=headers)
        if resp.status_code == 200:
            data = resp.json()
            items = data.get("resultList", {}).get("result", [])
        elif resp.status_code == 429:
            epmc_error = RuntimeError("Europe PMC rate limit reached (HTTP 429).")
        else:
            epmc_error = RuntimeError(f"Europe PMC returned HTTP {resp.status_code}")
    except Exception as e:
        epmc_error = e

    if not items:
        # Resilient fallback: Query Crossref index
        fallback_count = 0
        try:
            async for fallback_paper in _search_crossref_fallback(
                source_id=source_id,
                source_name=source_name,
                default_venue=default_venue,
                is_preprint=is_preprint,
                filters=filters,
                client=client,
            ):
                fallback_count += 1
                yield fallback_paper
        except Exception:
            pass

        if fallback_count == 0 and epmc_error is not None:
            raise epmc_error
        return

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
