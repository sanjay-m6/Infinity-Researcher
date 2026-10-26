"""
Unit tests for layered metadata and PDF link extractors.
"""

import pytest
from paper_scraper.extractors.metadata import LayeredMetadataExtractor
from paper_scraper.extractors.pdf import PdfDiscoveryExtractor


SAMPLE_SCHOLARLY_HTML = """
<!DOCTYPE html>
<html>
<head>
    <title>Sample Paper</title>
    <meta name="citation_title" content="Transformers for Medical Image Segmentation">
    <meta name="citation_author" content="Alice Smith">
    <meta name="citation_author" content="Bob Jones">
    <meta name="citation_publication_date" content="2023-05-12">
    <meta name="citation_journal_title" content="Nature Biomedical Engineering">
    <meta name="citation_doi" content="10.1038/s41551-023-0001">
    <meta name="citation_pdf_url" content="https://nature.com/articles/s41551-023-0001.pdf">
    <meta name="citation_keywords" content="transformers, medical imaging, deep learning">
    <link rel="canonical" href="https://nature.com/articles/s41551-023-0001">
    <link rel="license" href="https://creativecommons.org/licenses/by/4.0/">
</head>
<body>
    <div class="abstract">
        Abstract: This paper presents an extensive study of transformer networks for 3D medical volume segmentation.
    </div>
</body>
</html>
"""

SAMPLE_JSON_LD_HTML = """
<!DOCTYPE html>
<html>
<head>
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "ScholarlyArticle",
        "headline": "Diffusion Models for Scientific Discovery",
        "author": [
            {"@type": "Person", "name": "Charlie Brown", "affiliation": {"name": "Stanford University"}}
        ],
        "datePublished": "2024-02-10",
        "doi": "10.1016/j.cell.2024.01.001",
        "description": "Comprehensive analysis of diffusion models applied to protein folding.",
        "publisher": {"@type": "Organization", "name": "Cell Press"}
    }
    </script>
</head>
<body></body>
</html>
"""

SAMPLE_DUBLIN_CORE_HTML = """
<!DOCTYPE html>
<html>
<head>
    <meta name="dc.title" content="Dublin Core Scholarly Document">
    <meta name="dc.creator" content="David Miller">
    <meta name="dc.description" content="A paper described using Dublin Core metadata vocabulary.">
    <meta name="dc.date" content="2022-11-20">
    <meta name="dc.identifier" content="doi:10.1145/3544548.3581234">
</head>
<body></body>
</html>
"""


def test_layered_citation_meta_extraction():
    res = LayeredMetadataExtractor.extract_all(SAMPLE_SCHOLARLY_HTML, base_url="https://nature.com")
    fields = res["fields"]
    provenance = res["provenance"]

    assert fields["title"] == "Transformers for Medical Image Segmentation"
    assert "Alice Smith" in fields["authors"]
    assert "Bob Jones" in fields["authors"]
    assert fields["doi"] == "10.1038/s41551-023-0001"
    assert fields["publication_year"] == 2023
    assert fields["pdf_url"] == "https://nature.com/articles/s41551-023-0001.pdf"
    assert fields["canonical_url"] == "https://nature.com/articles/s41551-023-0001"
    assert "transformers" in fields["keywords"]

    assert provenance["title"] == "citation_meta"
    assert provenance["doi"] == "citation_meta"
    assert res["confidence"] >= 0.85


def test_layered_json_ld_extraction():
    res = LayeredMetadataExtractor.extract_all(SAMPLE_JSON_LD_HTML)
    fields = res["fields"]
    provenance = res["provenance"]

    assert fields["title"] == "Diffusion Models for Scientific Discovery"
    assert "Charlie Brown" in fields["authors"]
    assert "Stanford University" in fields["affiliations"]
    assert fields["doi"] == "10.1016/j.cell.2024.01.001"
    assert fields["publication_year"] == 2024
    assert fields["publisher"] == "Cell Press"
    assert provenance["title"] == "json_ld"
    assert provenance["doi"] == "json_ld"


def test_layered_dublin_core_extraction():
    res = LayeredMetadataExtractor.extract_all(SAMPLE_DUBLIN_CORE_HTML)
    fields = res["fields"]
    provenance = res["provenance"]

    assert fields["title"] == "Dublin Core Scholarly Document"
    assert "David Miller" in fields["authors"]
    assert fields["doi"] == "10.1145/3544548.3581234"
    assert fields["publication_year"] == 2022
    assert provenance["title"] == "dublin_core"


def test_pdf_discovery_extractor():
    pdf = PdfDiscoveryExtractor.discover_pdf_url(SAMPLE_SCHOLARLY_HTML, base_url="https://nature.com")
    assert pdf == "https://nature.com/articles/s41551-023-0001.pdf"

    # Test ArXiv canonical pdf discovery
    arxiv_pdf = PdfDiscoveryExtractor.discover_pdf_url("", base_url="https://arxiv.org/abs/2301.01234", source_id="arxiv")
    assert arxiv_pdf == "https://arxiv.org/pdf/2301.01234.pdf"

    # Test bioRxiv canonical pdf discovery
    biorxiv_pdf = PdfDiscoveryExtractor.discover_pdf_url(
        "", base_url="https://www.biorxiv.org/content/10.1101/2023.01.01.522432v1", source_id="biorxiv"
    )
    assert biorxiv_pdf == "https://www.biorxiv.org/content/10.1101/2023.01.01.522432v1.full.pdf"

    # Test SSRF block on malicious PDF link
    bad_html = '<a href="http://169.254.169.254/secret.pdf">Download PDF</a>'
    bad_pdf = PdfDiscoveryExtractor.discover_pdf_url(bad_html, base_url="https://example.com")
    assert bad_pdf is None
