"""
Unit tests for Stage A: Query Intelligence and Identifier Extraction.
Validates extraction of DOIs, IEEE arnumbers, arXiv IDs, PMIDs, author/year cues,
and multi-representation query generation across 25+ distinct query variations.
"""

import pytest
from paper_scraper.discovery.identity import (
    QueryIntelligence,
    QueryIdentity,
    clean_doi,
    extract_doi,
    extract_ieee_id,
    extract_arxiv_id,
    extract_pmid_pmcid,
)
from paper_scraper.discovery.query import QueryBuilder
from paper_scraper.models import QueryFilter


class TestStageAQueryIntelligence:
    # 1. Bare DOI
    def test_bare_doi(self):
        q = "10.1109/ACCESS.2023.1234567"
        ident = QueryIntelligence.parse(q)
        assert ident.doi == "10.1109/access.2023.1234567"
        assert ident.detected_type == "doi"
        assert ident.is_identifier_lookup is True
        assert ident.canonical_id == "10.1109/access.2023.1234567"

    # 2. DOI with https://doi.org/
    def test_doi_url_https(self):
        q = "https://doi.org/10.1038/s41586-020-2649-2"
        ident = QueryIntelligence.parse(q)
        assert ident.doi == "10.1038/s41586-020-2649-2"
        assert ident.detected_type == "doi"
        assert ident.is_identifier_lookup is True

    # 3. DOI with http://dx.doi.org/
    def test_doi_url_dx(self):
        q = "http://dx.doi.org/10.1145/3377325.3377500"
        ident = QueryIntelligence.parse(q)
        assert ident.doi == "10.1145/3377325.3377500"
        assert ident.detected_type == "doi"

    # 4. DOI with prefix doi:
    def test_doi_prefix(self):
        q = "doi: 10.1016/j.cell.2021.01.001"
        ident = QueryIntelligence.parse(q)
        assert ident.doi == "10.1016/j.cell.2021.01.001"
        assert ident.detected_type == "doi"

    # 5. DOI with trailing sentence punctuation
    def test_doi_in_sentence_with_punctuation(self):
        q = "Reference paper at (10.1007/s11263-020-01387-4)."
        ident = QueryIntelligence.parse(q)
        assert ident.doi == "10.1007/s11263-020-01387-4"
        assert ident.detected_type == "doi"

    # 6. IEEE document URL
    def test_ieee_url_document(self):
        q = "https://ieeexplore.ieee.org/document/8123456"
        ident = QueryIntelligence.parse(q)
        assert ident.ieee_id == "8123456"
        assert ident.detected_type == "ieee_id"
        assert ident.canonical_id == "8123456"
        assert ident.is_identifier_lookup is True

    # 7. IEEE stamp URL
    def test_ieee_url_stamp(self):
        q = "https://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=9876543"
        ident = QueryIntelligence.parse(q)
        assert ident.ieee_id == "9876543"
        assert ident.detected_type == "ieee_id"

    # 8. IEEE arnumber text
    def test_ieee_arnumber_text(self):
        q = "arnumber: 7654321"
        ident = QueryIntelligence.parse(q)
        assert ident.ieee_id == "7654321"
        assert ident.detected_type == "ieee_id"

    # 9. IEEE direct prefix
    def test_ieee_prefix_text(self):
        q = "ieee: 6543210"
        ident = QueryIntelligence.parse(q)
        assert ident.ieee_id == "6543210"
        assert ident.detected_type == "ieee_id"

    # 10. arXiv abs URL
    def test_arxiv_abs_url(self):
        q = "https://arxiv.org/abs/2301.12345"
        ident = QueryIntelligence.parse(q)
        assert ident.arxiv_id == "2301.12345"
        assert ident.detected_type == "arxiv_id"
        assert ident.is_identifier_lookup is True

    # 11. arXiv PDF URL with version
    def test_arxiv_pdf_versioned_url(self):
        q = "https://arxiv.org/pdf/1706.03762v5.pdf"
        ident = QueryIntelligence.parse(q)
        assert ident.arxiv_id == "1706.03762v5"
        assert ident.detected_type == "arxiv_id"

    # 12. arXiv prefix
    def test_arxiv_prefix(self):
        q = "arxiv: 2106.09685"
        ident = QueryIntelligence.parse(q)
        assert ident.arxiv_id == "2106.09685"
        assert ident.detected_type == "arxiv_id"

    # 13. Bare arXiv identifier
    def test_bare_arxiv_id(self):
        q = "2301.12345"
        ident = QueryIntelligence.parse(q)
        assert ident.arxiv_id == "2301.12345"
        assert ident.detected_type == "arxiv_id"

    # 14. Old style arXiv ID
    def test_old_style_arxiv(self):
        q = "arxiv: math.PR/0501123"
        ident = QueryIntelligence.parse(q)
        assert ident.arxiv_id == "math.pr/0501123"

    # 15. PubMed URL
    def test_pubmed_url(self):
        q = "https://pubmed.ncbi.nlm.nih.gov/33456789/"
        ident = QueryIntelligence.parse(q)
        assert ident.pmid == "33456789"
        assert ident.detected_type == "pmid"
        assert ident.is_identifier_lookup is True

    # 16. PMID prefix
    def test_pmid_prefix(self):
        q = "pmid: 33456789"
        ident = QueryIntelligence.parse(q)
        assert ident.pmid == "33456789"
        assert ident.detected_type == "pmid"

    # 17. PMCID token
    def test_pmcid_token(self):
        q = "PMC7812345"
        ident = QueryIntelligence.parse(q)
        assert ident.pmc_id == "PMC7812345"
        assert ident.detected_type == "pmcid"

    # 18. Author + Year natural language
    def test_author_year_title(self):
        q = "Vaswani et al. 2017 Attention Is All You Need"
        ident = QueryIntelligence.parse(q)
        assert "Vaswani" in ident.authors
        assert ident.year == 2017
        assert "Attention Is All You Need" in ident.cleaned_title
        assert ident.detected_type == "author_year_title"
        assert "Vaswani" in ident.multi_queries.get("author_year", "")

    # 19. Author + Year with parenthesis
    def test_author_year_parenthesis(self):
        q = "Smith & Jones (2020) Deep Learning in Healthcare"
        ident = QueryIntelligence.parse(q)
        assert ident.year == 2020
        assert "Deep Learning" in ident.cleaned_title
        assert "author_year" in ident.multi_queries

    # 20. Quoted exact title phrase
    def test_quoted_exact_title(self):
        q = '"Deep Residual Learning for Image Recognition"'
        ident = QueryIntelligence.parse(q)
        assert ident.cleaned_title == "Deep Residual Learning for Image Recognition"
        assert ident.exact_title_query == '"Deep Residual Learning for Image Recognition"'
        assert "residual" in ident.keywords

    # 21. Natural language research topic with stop words removed
    def test_natural_language_keywords(self):
        q = "A comprehensive survey on graph neural networks for drug discovery"
        ident = QueryIntelligence.parse(q)
        # Verify common stopwords like 'a', 'on', 'for' are omitted
        assert "graph" in ident.keywords
        assert "neural" in ident.keywords
        assert "networks" in ident.keywords
        assert "drug" in ident.keywords
        assert "discovery" in ident.keywords
        assert "for" not in ident.keywords
        assert "on" not in ident.keywords

    # 22. Clean DOI normalizer edge cases
    def test_clean_doi_variations(self):
        assert clean_doi("https://doi.org/10.1109/CVPR.2016.90.") == "10.1109/cvpr.2016.90"
        assert clean_doi("DOI: 10.1000/182") == "10.1000/182"
        assert clean_doi("  10.1038/nature12373; ") == "10.1038/nature12373"

    # 23. QueryBuilder IEEE search URL generation
    def test_query_builder_ieee(self):
        url1 = QueryBuilder.build_ieee_search_url(QueryFilter(query="https://ieeexplore.ieee.org/document/8123456"))
        assert url1 == "https://ieeexplore.ieee.org/document/8123456"

        url2 = QueryBuilder.build_ieee_search_url(QueryFilter(query="10.1109/ACCESS.2021.123"))
        assert "queryText=10.1109%2Faccess.2021.123" in url2

    # 24. QueryBuilder Semantic Scholar & OpenAlex URL generation
    def test_query_builder_s2_and_openalex(self):
        s2_doi_url = QueryBuilder.build_semantic_scholar_url("10.1109/ACCESS.2021.123")
        assert "paper/DOI:10.1109%2Faccess.2021.123" in s2_doi_url

        s2_arxiv_url = QueryBuilder.build_semantic_scholar_url("arxiv: 2301.12345")
        assert "paper/ARXIV:2301.12345" in s2_arxiv_url

        oa_doi_url = QueryBuilder.build_openalex_url("10.1109/ACCESS.2021.123")
        assert "works/https://doi.org/10.1109%2Faccess.2021.123" in oa_doi_url

    # 25. Mixed DOI and topic in user request
    def test_mixed_doi_and_topic(self):
        q = "Check this DOI 10.1109/JPROC.2018.2820126 for radar systems"
        ident = QueryIntelligence.parse(q)
        assert ident.doi == "10.1109/jproc.2018.2820126"
        assert ident.is_identifier_lookup is True
        assert "radar" in ident.keywords
