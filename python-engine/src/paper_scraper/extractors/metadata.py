"""
Layered Scholarly Metadata Extractor.
Extracts title, authors, affiliations, abstract, publication date, DOI,
journal/conference, publisher, and keywords using a multi-layer strategy:
1. JSON-LD structured data
2. Highwire Press / Citation meta tags
3. Dublin Core metadata tags
4. OpenGraph / Twitter Cards
5. Semantic HTML headings and article bodies
Tracks extraction provenance and calculates metadata confidence.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional, Tuple
from bs4 import BeautifulSoup


class LayeredMetadataExtractor:
    """Extracts scholarly article metadata across standardized and semantic layers."""

    @staticmethod
    def extract_all(html: str, base_url: str = "") -> Dict[str, Any]:
        """
        Execute all extraction layers in order of authority.
        Returns a dictionary of normalized fields, provenance, and confidence breakdown.
        """
        soup = BeautifulSoup(html, "html.parser")
        provenance: Dict[str, str] = {}
        data: Dict[str, Any] = {
            "title": None,
            "authors": [],
            "affiliations": [],
            "abstract": None,
            "publication_date": None,
            "publication_year": None,
            "journal": None,
            "conference": None,
            "doi": None,
            "publisher": None,
            "keywords": [],
            "canonical_url": None,
            "pdf_url": None,
            "license": None,
        }

        # 1. JSON-LD Layer
        json_ld_data = LayeredMetadataExtractor._extract_json_ld(soup)
        for k, v in json_ld_data.items():
            if v and not data[k]:
                data[k] = v
                provenance[k] = "json_ld"

        # 2. Citation / Highwire Press Meta Tags Layer
        citation_data = LayeredMetadataExtractor._extract_citation_meta(soup)
        for k, v in citation_data.items():
            if v and not data[k]:
                data[k] = v
                provenance[k] = "citation_meta"

        # 3. Dublin Core Layer
        dc_data = LayeredMetadataExtractor._extract_dublin_core(soup)
        for k, v in dc_data.items():
            if v and not data[k]:
                data[k] = v
                provenance[k] = "dublin_core"

        # 4. OpenGraph / Twitter Layer
        og_data = LayeredMetadataExtractor._extract_open_graph(soup)
        for k, v in og_data.items():
            if v and not data[k]:
                data[k] = v
                provenance[k] = "open_graph"

        # 5. Semantic HTML Fallback Layer
        html_fallback = LayeredMetadataExtractor._extract_html_fallback(soup)
        for k, v in html_fallback.items():
            if v and not data[k]:
                data[k] = v
                provenance[k] = "semantic_html"

        # Extract Canonical & License Links
        canonical_tag = soup.find("link", rel=lambda r: r and "canonical" in r.lower())
        if canonical_tag and canonical_tag.get("href"):
            data["canonical_url"] = canonical_tag["href"].strip()
            provenance["canonical_url"] = "link_canonical"

        license_tag = soup.find("link", rel=lambda r: r and "license" in r.lower())
        if license_tag and license_tag.get("href"):
            data["license"] = license_tag["href"].strip()
            provenance["license"] = "link_license"

        # Clean year from date if publication_year is missing
        if data["publication_date"] and not data["publication_year"]:
            year_match = re.search(r"\b(19\d\d|20\d\d)\b", str(data["publication_date"]))
            if year_match:
                data["publication_year"] = int(year_match.group(1))

        # Confidence calculation
        confidence, breakdown = LayeredMetadataExtractor._compute_confidence(data)

        return {
            "fields": data,
            "provenance": provenance,
            "confidence": confidence,
            "confidence_breakdown": breakdown,
        }

    @staticmethod
    def _extract_json_ld(soup: BeautifulSoup) -> Dict[str, Any]:
        """Extract metadata from JSON-LD schema blocks."""
        results: Dict[str, Any] = {
            "title": None,
            "authors": [],
            "affiliations": [],
            "abstract": None,
            "publication_date": None,
            "publication_year": None,
            "journal": None,
            "conference": None,
            "doi": None,
            "publisher": None,
            "keywords": [],
            "pdf_url": None,
            "license": None,
        }

        for script in soup.find_all("script", type="application/ld+json"):
            try:
                raw_text = script.string or script.text
                if not raw_text:
                    continue
                parsed = json.loads(raw_text)
                items = parsed if isinstance(parsed, list) else [parsed]

                for item in items:
                    if not isinstance(item, dict):
                        continue

                    # Support @graph
                    graph_items = item.get("@graph", [item])
                    for entity in graph_items:
                        if not isinstance(entity, dict):
                            continue
                        entity_type = entity.get("@type", "")
                        if isinstance(entity_type, list):
                            entity_type = " ".join(entity_type)
                        
                        # Match ScholarlyArticle, Article, MedicalScholarlyArticle, TechArticle
                        if any(t in entity_type for t in ("Article", "ScholarlyArticle", "Publication", "Report")):
                            if not results["title"] and "headline" in entity:
                                results["title"] = entity["headline"]
                            elif not results["title"] and "name" in entity:
                                results["title"] = entity["name"]

                            if not results["abstract"] and "description" in entity:
                                results["abstract"] = entity["description"]

                            # Authors
                            authors_val = entity.get("author") or entity.get("creator")
                            if authors_val:
                                auth_list = authors_val if isinstance(authors_val, list) else [authors_val]
                                for a in auth_list:
                                    if isinstance(a, dict):
                                        name = a.get("name")
                                        if name and name not in results["authors"]:
                                            results["authors"].append(name)
                                        # Affiliation
                                        affil = a.get("affiliation")
                                        if isinstance(affil, dict) and "name" in affil:
                                            results["affiliations"].append(affil["name"])
                                        elif isinstance(affil, str) and affil:
                                            results["affiliations"].append(affil)
                                    elif isinstance(a, str) and a not in results["authors"]:
                                        results["authors"].append(a)

                            # Date
                            date_val = entity.get("datePublished") or entity.get("dateCreated")
                            if date_val and not results["publication_date"]:
                                results["publication_date"] = str(date_val)

                            # DOI or identifiers
                            doi_val = entity.get("doi") or entity.get("sameAs")
                            if doi_val and isinstance(doi_val, str) and "10." in doi_val:
                                m = re.search(r"10\.\d{4,9}/[-._;()/:A-Za-z0-9]+", doi_val)
                                if m:
                                    results["doi"] = m.group(0)

                            # Publisher
                            pub = entity.get("publisher")
                            if isinstance(pub, dict) and "name" in pub:
                                results["publisher"] = pub["name"]
                            elif isinstance(pub, str):
                                results["publisher"] = pub

                            # License
                            if "license" in entity and not results["license"]:
                                results["license"] = str(entity["license"])

            except Exception:
                continue

        return results

    @staticmethod
    def _extract_citation_meta(soup: BeautifulSoup) -> Dict[str, Any]:
        """Extract citation meta tags (Google Scholar / Highwire Press standards)."""
        res: Dict[str, Any] = {
            "title": None,
            "authors": [],
            "affiliations": [],
            "abstract": None,
            "publication_date": None,
            "publication_year": None,
            "journal": None,
            "conference": None,
            "doi": None,
            "publisher": None,
            "keywords": [],
            "pdf_url": None,
        }

        # Meta tags
        for meta in soup.find_all("meta"):
            name = (meta.get("name") or meta.get("property") or "").lower()
            content = meta.get("content", "").strip()
            if not content:
                continue

            if name == "citation_title" and not res["title"]:
                res["title"] = content
            elif name in ("citation_author", "citation_authors"):
                if content not in res["authors"]:
                    res["authors"].append(content)
            elif name in ("citation_author_institution", "citation_author_affiliation"):
                if content not in res["affiliations"]:
                    res["affiliations"].append(content)
            elif name in ("citation_publication_date", "citation_date", "citation_online_date"):
                if not res["publication_date"]:
                    res["publication_date"] = content
            elif name == "citation_journal_title" and not res["journal"]:
                res["journal"] = content
            elif name == "citation_conference_title" and not res["conference"]:
                res["conference"] = content
            elif name == "citation_doi" and not res["doi"]:
                # Normalize DOI
                m = re.search(r"10\.\d{4,9}/[-._;()/:A-Za-z0-9]+", content)
                res["doi"] = m.group(0) if m else content
            elif name == "citation_publisher" and not res["publisher"]:
                res["publisher"] = content
            elif name in ("citation_pdf_url", "citation_fulltext_html_url"):
                if name == "citation_pdf_url" and not res["pdf_url"]:
                    res["pdf_url"] = content
            elif name in ("citation_keywords", "keywords"):
                parts = [p.strip() for p in re.split(r"[,;]", content) if p.strip()]
                for p in parts:
                    if p not in res["keywords"]:
                        res["keywords"].append(p)

        return res

    @staticmethod
    def _extract_dublin_core(soup: BeautifulSoup) -> Dict[str, Any]:
        """Extract Dublin Core (DC and DCTERMS) tags."""
        res: Dict[str, Any] = {
            "title": None,
            "authors": [],
            "affiliations": [],
            "abstract": None,
            "publication_date": None,
            "publication_year": None,
            "journal": None,
            "conference": None,
            "doi": None,
            "publisher": None,
            "keywords": [],
            "pdf_url": None,
        }

        for meta in soup.find_all("meta"):
            name = (meta.get("name") or meta.get("property") or "").lower()
            content = meta.get("content", "").strip()
            if not content:
                continue

            if name in ("dc.title", "dcterms.title") and not res["title"]:
                res["title"] = content
            elif name in ("dc.creator", "dcterms.creator", "dc.contributor"):
                if content not in res["authors"]:
                    res["authors"].append(content)
            elif name in ("dc.description", "dcterms.abstract", "dc.description.abstract") and not res["abstract"]:
                res["abstract"] = content
            elif name in ("dc.date", "dcterms.date", "dcterms.issued") and not res["publication_date"]:
                res["publication_date"] = content
            elif name in ("dc.publisher", "dcterms.publisher") and not res["publisher"]:
                res["publisher"] = content
            elif name in ("dc.identifier", "dcterms.identifier"):
                if "10." in content and not res["doi"]:
                    m = re.search(r"10\.\d{4,9}/[-._;()/:A-Za-z0-9]+", content)
                    if m:
                        res["doi"] = m.group(0)
            elif name in ("dc.subject", "dcterms.subject"):
                if content not in res["keywords"]:
                    res["keywords"].append(content)

        return res

    @staticmethod
    def _extract_open_graph(soup: BeautifulSoup) -> Dict[str, Any]:
        """Extract OpenGraph and Twitter card fallbacks."""
        res: Dict[str, Any] = {
            "title": None,
            "abstract": None,
            "canonical_url": None,
        }
        og_title = soup.find("meta", property="og:title") or soup.find("meta", attrs={"name": "twitter:title"})
        if og_title and og_title.get("content"):
            res["title"] = og_title["content"].strip()

        og_desc = soup.find("meta", property="og:description") or soup.find("meta", attrs={"name": "twitter:description"})
        if og_desc and og_desc.get("content"):
            res["abstract"] = og_desc["content"].strip()

        og_url = soup.find("meta", property="og:url")
        if og_url and og_url.get("content"):
            res["canonical_url"] = og_url["content"].strip()

        return res

    @staticmethod
    def _extract_html_fallback(soup: BeautifulSoup) -> Dict[str, Any]:
        """Extract title and abstract using semantic HTML heuristics."""
        res: Dict[str, Any] = {
            "title": None,
            "abstract": None,
        }
        # Title heuristic: h1 within article, main, or with class containing title
        h1 = soup.select_one("article h1, main h1, h1.article-title, h1.title, h1#title")
        if h1 and h1.text.strip():
            res["title"] = " ".join(h1.text.split())

        # Abstract heuristic: class or id containing abstract
        abs_elem = soup.select_one(".abstract, #abstract, .abstract-content, .article-abstract, section.abstract")
        if abs_elem and abs_elem.text.strip():
            cleaned = " ".join(abs_elem.text.split())
            if cleaned.lower().startswith("abstract"):
                cleaned = re.sub(r"^abstract\s*[:\-\.]?\s*", "", cleaned, flags=re.I)
            res["abstract"] = cleaned

        return res

    @staticmethod
    def _compute_confidence(data: Dict[str, Any]) -> Tuple[float, Dict[str, float]]:
        """Calculate weighted confidence based on metadata completeness."""
        breakdown = {
            "title": 1.0 if data.get("title") else 0.0,
            "authors": 1.0 if (data.get("authors") and len(data["authors"]) > 0) else 0.0,
            "doi": 1.0 if data.get("doi") else 0.0,
            "pdf": 1.0 if data.get("pdf_url") else 0.0,
            "abstract": 1.0 if (data.get("abstract") and len(data["abstract"]) > 50) else 0.0,
        }
        score = (
            breakdown["title"] * 0.35
            + breakdown["authors"] * 0.25
            + breakdown["doi"] * 0.15
            + breakdown["pdf"] * 0.15
            + breakdown["abstract"] * 0.10
        )
        return round(score, 2), breakdown
