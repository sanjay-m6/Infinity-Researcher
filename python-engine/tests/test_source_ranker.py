"""
Unit tests for Stage F: Source Candidate Ranking Engine.
Tests composite scoring formula S(c) = 0.30M + 0.25R + 0.20A + 0.15I + 0.10V,
rejection criteria (login pages, text/html, magic bytes, paywalls),
and candidate selection accuracy across 20+ multi-candidate test papers.
"""

import pytest
from paper_scraper.ranking.source_ranker import (
    SourceRanker,
    SourceCandidate,
    TargetPaper,
    CandidateRankingResult,
)


class TestSourceRanker:
    def setup_method(self):
        self.ranker = SourceRanker()

    # Rejection Tests
    def test_rejection_html_login_page(self):
        target = TargetPaper(title="Quantum Computing Algorithms", doi="10.1109/TQE.2021.123")
        cand = SourceCandidate(
            candidate_id="c1",
            source_name="Publisher Mirror",
            url="https://publisher.com/login?redirect=pdf",
            doi="10.1109/TQE.2021.123",
            title="Quantum Computing Algorithms",
            is_html_login_page=True,
        )
        res = self.ranker.rank_candidate(target, cand)
        assert res.is_rejected is True
        assert "login" in res.rejection_reason.lower()

    def test_rejection_text_html_content_type(self):
        target = TargetPaper(title="Deep Learning Survey")
        cand = SourceCandidate(
            candidate_id="c2",
            source_name="Web Site",
            url="https://example.org/paper.html",
            title="Deep Learning Survey",
            content_type="text/html; charset=utf-8",
        )
        res = self.ranker.rank_candidate(target, cand)
        assert res.is_rejected is True
        assert "text/html" in res.rejection_reason

    def test_rejection_missing_magic_bytes(self):
        target = TargetPaper(title="Attention Is All You Need", doi="10.48550/arXiv.1706.03762")
        cand = SourceCandidate(
            candidate_id="c3",
            source_name="Corrupt Source",
            url="https://corrupt.org/paper.pdf",
            doi="10.48550/arXiv.1706.03762",
            title="Attention Is All You Need",
            has_pdf_magic_bytes=False,
        )
        res = self.ranker.rank_candidate(target, cand)
        assert res.is_rejected is True
        assert "%pdf-" in res.rejection_reason.lower()

    def test_rejection_paywalled_status(self):
        target = TargetPaper(title="Closed Access Paper", doi="10.1016/j.cell.2020.01.001")
        cand = SourceCandidate(
            candidate_id="c4",
            source_name="Paywalled Journal",
            url="https://journal.org/locked.pdf",
            doi="10.1016/j.cell.2020.01.001",
            title="Closed Access Paper",
            access_status="paywalled",
        )
        res = self.ranker.rank_candidate(target, cand)
        assert res.is_rejected is True
        assert "paywalled" in res.rejection_reason.lower()

    def test_rejection_mismatched_doi(self):
        target = TargetPaper(title="Target Paper Title", doi="10.1109/ACCESS.2020.100")
        cand = SourceCandidate(
            candidate_id="c5",
            source_name="Unpaywall",
            url="https://unpaywall.org/wrong.pdf",
            doi="10.1109/ACCESS.2020.999",  # Different DOI
            title="Completely Different Paper",
        )
        res = self.ranker.rank_candidate(target, cand)
        assert res.is_rejected is True
        assert "mismatched doi" in res.rejection_reason.lower()

    def test_rejection_unrelated_paper(self):
        target = TargetPaper(title="Graph Neural Networks in Drug Discovery")
        cand = SourceCandidate(
            candidate_id="c6",
            source_name="Repository",
            url="https://repo.org/paper.pdf",
            title="Agricultural Soil Moisture Estimation Using Satellite Radar",
        )
        res = self.ranker.rank_candidate(target, cand)
        assert res.is_rejected is True
        assert "similarity" in res.rejection_reason.lower()

    # Preference & Ranking Tests
    def test_arxiv_verified_beats_unverified_web(self):
        target = TargetPaper(
            title="LoRA: Low-Rank Adaptation of Large Language Models",
            doi="10.48550/arXiv.2106.09685",
            authors=["Hu", "Shen", "Wallis"],
            publication_year=2021,
        )
        cand_arxiv = SourceCandidate(
            candidate_id="arxiv",
            source_name="arXiv",
            url="https://arxiv.org/pdf/2106.09685.pdf",
            doi="10.48550/arXiv.2106.09685",
            title="LoRA: Low-Rank Adaptation of Large Language Models",
            authors=["Edward Hu", "Yelong Shen"],
            publication_year=2021,
            access_status="verified_oa",
            has_pdf_magic_bytes=True,
            content_type="application/pdf",
            content_length=1_200_000,
        )
        cand_random = SourceCandidate(
            candidate_id="random",
            source_name="Unknown Blog",
            url="https://randomblog.com/lora.pdf",
            title="LoRA: Low-Rank Adaptation",
            access_status="unverified",
            content_length=15_000,
        )
        results = self.ranker.rank_candidates(target, [cand_random, cand_arxiv])
        assert results[0].candidate.candidate_id == "arxiv"
        assert results[0].composite_score > results[1].composite_score

    def test_verified_oa_beats_preprint_for_published_paper(self):
        target = TargetPaper(
            title="An Open Access Breakthrough in Optics",
            doi="10.1364/OE.2023.001",
            publication_year=2023,
            venue="Optics Express",
        )
        cand_journal = SourceCandidate(
            candidate_id="journal_oa",
            source_name="Optics Express / PMC",
            url="https://ncbi.nlm.nih.gov/pmc/articles/PMC12345/pdf/main.pdf",
            doi="10.1364/OE.2023.001",
            title="An Open Access Breakthrough in Optics",
            publication_year=2023,
            venue="Optics Express",
            access_status="verified_oa",
            version_type="published",
            has_pdf_magic_bytes=True,
            content_length=800_000,
        )
        cand_early_preprint = SourceCandidate(
            candidate_id="early_preprint",
            source_name="arXiv",
            url="https://arxiv.org/pdf/2101.0001.pdf",
            title="An Early Study on Optics Breakthrough",
            publication_year=2021,
            access_status="green_oa",
            version_type="preprint",
        )
        results = self.ranker.rank_candidates(target, [cand_early_preprint, cand_journal])
        assert results[0].candidate.candidate_id == "journal_oa"

    # Multi-Candidate Benchmark: 20 Real-World Papers with Multiple Candidates
    def test_twenty_paper_retrieval_benchmark(self):
        """
        Verify that for 20 diverse research papers with multiple candidate sources
        (including OA repositories, paywalled versions, corrupted mirrors, and preprints),
        the highest-ranked candidate is the legitimate, highest-quality accessible PDF.
        Required acceptance: >= 90% accuracy.
        """
        benchmark_cases = [
            # 1. IEEE Gold OA paper with IEEE Stamp vs PMC copy
            {
                "target": TargetPaper(title="Deep Learning in Wireless Communications", doi="10.1109/ACCESS.2020.1", publication_year=2020),
                "candidates": [
                    SourceCandidate("c_pmc", "PMC", "https://ncbi.nlm.nih.gov/pmc/articles/PMC7001/pdf/ieee.pdf", doi="10.1109/ACCESS.2020.1", title="Deep Learning in Wireless Communications", access_status="verified_oa", has_pdf_magic_bytes=True, content_length=950_000),
                    SourceCandidate("c_paywall", "IEEE Closed", "https://ieeexplore.ieee.org/document/locked", doi="10.1109/ACCESS.2020.1", access_status="paywalled"),
                ],
                "expected_top": "c_pmc",
            },
            # 2. arXiv paper with official PDF vs broken scraper stub
            {
                "target": TargetPaper(title="Transformers for Time Series", doi="10.48550/arXiv.2202.001", publication_year=2022),
                "candidates": [
                    SourceCandidate("c_broken", "Mirror", "https://mirror.org/stub.pdf", content_length=1200, has_pdf_magic_bytes=False),
                    SourceCandidate("c_arxiv", "arXiv", "https://arxiv.org/pdf/2202.001.pdf", doi="10.48550/arXiv.2202.001", title="Transformers for Time Series", access_status="verified_oa", has_pdf_magic_bytes=True, content_length=1_100_000),
                ],
                "expected_top": "c_arxiv",
            },
            # 3. Nature paper with EuropePMC OA vs paywalled Nature landing page
            {
                "target": TargetPaper(title="Genome-wide association study of longevity", doi="10.1038/s41586-021-001", publication_year=2021),
                "candidates": [
                    SourceCandidate("c_nature_html", "Nature", "https://nature.com/articles/s41586-021-001", content_type="text/html", access_status="paywalled"),
                    SourceCandidate("c_epmc", "Europe PMC", "https://europepmc.org/articles/PMC8001/pdf/nature.pdf", doi="10.1038/s41586-021-001", title="Genome-wide association study of longevity", access_status="verified_oa", has_pdf_magic_bytes=True, content_length=2_500_000),
                ],
                "expected_top": "c_epmc",
            },
            # 4. PLOS ONE direct OA PDF vs unauthorized mirror
            {
                "target": TargetPaper(title="Microbiome diversity in alpine lakes", doi="10.1371/journal.pone.0250000", publication_year=2021),
                "candidates": [
                    SourceCandidate("c_plos", "PLOS", "https://journals.plos.org/plosone/article/file?id=10.1371/journal.pone.0250000&type=printable", doi="10.1371/journal.pone.0250000", title="Microbiome diversity in alpine lakes", access_status="verified_oa", license="CC-BY", has_pdf_magic_bytes=True, content_length=1_800_000),
                    SourceCandidate("c_mirror", "Unknown", "https://lake-ecology.org/scan.pdf", title="Microbiome diversity", access_status="unverified", content_length=40_000),
                ],
                "expected_top": "c_plos",
            },
            # 5. bioRxiv preprint vs outdated summary
            {
                "target": TargetPaper(title="Single-cell transcriptomics of neural crest cells", doi="10.1101/2022.05.01.490000", publication_year=2022),
                "candidates": [
                    SourceCandidate("c_biorxiv", "bioRxiv", "https://biorxiv.org/content/10.1101/2022.05.01.490000v1.full.pdf", doi="10.1101/2022.05.01.490000", title="Single-cell transcriptomics of neural crest cells", access_status="verified_oa", has_pdf_magic_bytes=True, content_length=3_200_000),
                    SourceCandidate("c_blog", "Blog", "https://bio-summary.org/cells.pdf", title="Single-cell transcriptomics", access_status="unverified"),
                ],
                "expected_top": "c_biorxiv",
            },
            # 6. Unpaywall discovered author repository vs general web search
            {
                "target": TargetPaper(title="Security of Autonomous Vehicle Protocols", doi="10.1145/3377325.3377500", publication_year=2020),
                "candidates": [
                    SourceCandidate("c_unpaywall", "Unpaywall / Stanford Repo", "https://stanford.edu/repo/auto-sec.pdf", doi="10.1145/3377325.3377500", title="Security of Autonomous Vehicle Protocols", access_status="green_oa", has_pdf_magic_bytes=True, content_length=650_000),
                    SourceCandidate("c_acm_locked", "ACM Digital Library", "https://dl.acm.org/doi/10.1145/3377325.3377500", access_status="paywalled"),
                ],
                "expected_top": "c_unpaywall",
            },
            # 7. Semantic Scholar Graph API OpenAccessPdf link vs broken link
            {
                "target": TargetPaper(title="Diffusion Models in Vision: A Survey", doi="10.1109/TPAMI.2022.001", publication_year=2022),
                "candidates": [
                    SourceCandidate("c_s2", "Semantic Scholar", "https://api.semanticscholar.org/corpus/diff-models.pdf", doi="10.1109/TPAMI.2022.001", title="Diffusion Models in Vision: A Survey", access_status="verified_oa", has_pdf_magic_bytes=True, content_length=2_100_000),
                    SourceCandidate("c_login", "Publisher Portal", "https://ieeexplore.ieee.org/document/login", is_html_login_page=True),
                ],
                "expected_top": "c_s2",
            },
            # 8. CORE API UK institutional copy vs outdated conference abstract
            {
                "target": TargetPaper(title="Quantum Error Mitigation in NISQ Devices", doi="10.1103/PhysRevLett.127.001", publication_year=2021),
                "candidates": [
                    SourceCandidate("c_core", "CORE / Oxford", "https://core.ac.uk/download/pdf/998877.pdf", doi="10.1103/PhysRevLett.127.001", title="Quantum Error Mitigation in NISQ Devices", access_status="green_oa", has_pdf_magic_bytes=True, content_length=890_000),
                    SourceCandidate("c_prl_lock", "APS", "https://journals.aps.org/prl/abstract/10.1103", access_status="restricted"),
                ],
                "expected_top": "c_core",
            },
            # 9. OpenAlex verified repository vs partial slide deck
            {
                "target": TargetPaper(title="Reinforcement Learning for Robotic Manipulation", publication_year=2021),
                "candidates": [
                    SourceCandidate("c_openalex", "OpenAlex / MIT Repo", "https://openalex.org/mit/rl-manip.pdf", title="Reinforcement Learning for Robotic Manipulation", access_status="green_oa", has_pdf_magic_bytes=True, content_length=1_400_000),
                    SourceCandidate("c_slides", "Slides", "https://slideshare.net/rl-robot.pdf", title="Reinforcement Learning for Robotic Manipulation - Slides", content_length=8_000, access_status="unverified"),
                ],
                "expected_top": "c_openalex",
            },
            # 10. medRxiv clinical trial preprint vs unverified doc
            {
                "target": TargetPaper(title="Efficacy of Novel Therapeutics in Oncology", doi="10.1101/2021.03.15.21253000", publication_year=2021),
                "candidates": [
                    SourceCandidate("c_medrxiv", "medRxiv", "https://medrxiv.org/content/10.1101/2021.03.15.21253000v1.full.pdf", doi="10.1101/2021.03.15.21253000", title="Efficacy of Novel Therapeutics in Oncology", access_status="verified_oa", has_pdf_magic_bytes=True, content_length=1_900_000),
                    SourceCandidate("c_pharma_stub", "Mirror", "https://pharma-stub.com/trial.pdf", content_length=2_000),
                ],
                "expected_top": "c_medrxiv",
            },
            # 11. IEEE Open Access Gold Journal vs Closed Proceeding
            {
                "target": TargetPaper(title="Efficient 5G Beamforming Architectures", doi="10.1109/OJCOMS.2021.123", publication_year=2021),
                "candidates": [
                    SourceCandidate("c_ojcoms", "IEEE Open Journal", "https://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=9123456", doi="10.1109/OJCOMS.2021.123", title="Efficient 5G Beamforming Architectures", access_status="verified_oa", license="CC-BY", has_pdf_magic_bytes=True, content_length=1_200_000),
                    SourceCandidate("c_unrel", "Other Source", "https://other.org/radar.pdf", title="Unrelated Radar Processing"),
                ],
                "expected_top": "c_ojcoms",
            },
            # 12. PubMed Central full text vs publisher paywall
            {
                "target": TargetPaper(title="Cryo-EM structures of membrane proteins", doi="10.1038/s41594-020-001", publication_year=2020),
                "candidates": [
                    SourceCandidate("c_pmc_full", "PubMed Central", "https://ncbi.nlm.nih.gov/pmc/articles/PMC65432/pdf/main.pdf", doi="10.1038/s41594-020-001", title="Cryo-EM structures of membrane proteins", access_status="verified_oa", has_pdf_magic_bytes=True, content_length=3_400_000),
                    SourceCandidate("c_paywall2", "Nature Struct", "https://nature.com/locked", access_status="paywalled"),
                ],
                "expected_top": "c_pmc_full",
            },
            # 13. High-quality institutional repo vs scrape stub
            {
                "target": TargetPaper(title="Fault-Tolerant Quantum Computing with Surface Codes", publication_year=2019),
                "candidates": [
                    SourceCandidate("c_caltech", "Caltech Repository", "https://caltech.edu/repo/surface-codes.pdf", title="Fault-Tolerant Quantum Computing with Surface Codes", access_status="green_oa", has_pdf_magic_bytes=True, content_length=900_000),
                    SourceCandidate("c_stub2", "Stub", "https://stub.org/doc.pdf", has_pdf_magic_bytes=False),
                ],
                "expected_top": "c_caltech",
            },
            # 14. Author website preprint with exact author/title match vs unrelated document
            {
                "target": TargetPaper(title="Scaling Laws for Neural Language Models", authors=["Kaplan", "McCandlish", "Brown"], publication_year=2020),
                "candidates": [
                    SourceCandidate("c_author", "Author Page", "https://openai.com/research/scaling-laws.pdf", title="Scaling Laws for Neural Language Models", authors=["Jared Kaplan", "Sam McCandlish"], publication_year=2020, access_status="verified_oa", has_pdf_magic_bytes=True, content_length=1_500_000),
                    SourceCandidate("c_wrong_authors", "Random", "https://random.org/scaling.pdf", title="Scaling Laws for Neural Language Models", authors=["Different Person"], publication_year=2012),
                ],
                "expected_top": "c_author",
            },
            # 15. Springer Open Access vs Springer Closed
            {
                "target": TargetPaper(title="Federated Learning in Edge Networks", doi="10.1007/s11277-021-001", publication_year=2021),
                "candidates": [
                    SourceCandidate("c_springer_oa", "Springer Open", "https://springer.com/content/pdf/10.1007/s11277-021-001.pdf", doi="10.1007/s11277-021-001", title="Federated Learning in Edge Networks", access_status="verified_oa", has_pdf_magic_bytes=True, content_length=750_000),
                    SourceCandidate("c_springer_lock", "Springer Link", "https://link.springer.com/closed", access_status="paywalled"),
                ],
                "expected_top": "c_springer_oa",
            },
            # 16. S2 openAccessPdf with verified magic bytes vs unverified landing page
            {
                "target": TargetPaper(title="Contrastive Learning for Visual Representations", publication_year=2020),
                "candidates": [
                    SourceCandidate("c_s2_direct", "Semantic Scholar", "https://api.semanticscholar.org/simclr.pdf", title="Contrastive Learning for Visual Representations", access_status="verified_oa", has_pdf_magic_bytes=True, content_length=2_000_000),
                    SourceCandidate("c_landing", "Landing Page", "https://conf.org/paper-landing", content_type="text/html"),
                ],
                "expected_top": "c_s2_direct",
            },
            # 17. Multi-source comparison: arXiv, Institutional Repo, Broken Mirror
            {
                "target": TargetPaper(title="BERT: Pre-training of Deep Bidirectional Transformers", doi="10.48550/arXiv.1810.04805", publication_year=2018),
                "candidates": [
                    SourceCandidate("c_broken_mirror", "Broken", "https://bad.org/bert.pdf", has_pdf_magic_bytes=False),
                    SourceCandidate("c_repo_cornell", "arXiv", "https://arxiv.org/pdf/1810.04805.pdf", doi="10.48550/arXiv.1810.04805", title="BERT: Pre-training of Deep Bidirectional Transformers", access_status="verified_oa", has_pdf_magic_bytes=True, content_length=1_600_000),
                    SourceCandidate("c_inst", "Uni Repo", "https://uni.edu/bert-draft.pdf", title="BERT: Pre-training draft", access_status="green_oa", version_type="preprint", content_length=300_000),
                ],
                "expected_top": "c_repo_cornell",
            },
            # 18. Exact DOI match on OpenAlex vs generic title match on web
            {
                "target": TargetPaper(title="Deep Residual Learning", doi="10.1109/CVPR.2016.90", publication_year=2016),
                "candidates": [
                    SourceCandidate("c_openalex_oa", "OpenAlex", "https://openalex.org/cvpr/resnet.pdf", doi="10.1109/CVPR.2016.90", title="Deep Residual Learning for Image Recognition", access_status="verified_oa", has_pdf_magic_bytes=True, content_length=3_000_000),
                    SourceCandidate("c_gen_title", "Web", "https://web.org/deep-learning.pdf", title="Deep Residual Learning Discussion", access_status="unverified"),
                ],
                "expected_top": "c_openalex_oa",
            },
            # 19. Europe PMC open access version vs CAPTCHA wall
            {
                "target": TargetPaper(title="CRISPR-Cas9 Therapeutics in Genetic Diseases", doi="10.1056/NEJMoa2016153", publication_year=2021),
                "candidates": [
                    SourceCandidate("c_captcha", "Publisher", "https://nejm.org/verify-human", is_html_login_page=True),
                    SourceCandidate("c_epmc_crispr", "Europe PMC", "https://europepmc.org/articles/PMC79001/pdf/nejm.pdf", doi="10.1056/NEJMoa2016153", title="CRISPR-Cas9 Therapeutics in Genetic Diseases", access_status="verified_oa", has_pdf_magic_bytes=True, content_length=1_750_000),
                ],
                "expected_top": "c_epmc_crispr",
            },
            # 20. Published Open Access Article vs Outdated Low-Confidence Version
            {
                "target": TargetPaper(title="Graph Attention Networks", doi="10.48550/arXiv.1710.10903", publication_year=2018),
                "candidates": [
                    SourceCandidate("c_arxiv_gat", "arXiv", "https://arxiv.org/pdf/1710.10903.pdf", doi="10.48550/arXiv.1710.10903", title="Graph Attention Networks", access_status="verified_oa", has_pdf_magic_bytes=True, content_length=1_100_000),
                    SourceCandidate("c_low_conf", "Scraper Scrap", "https://scrap.com/gat.txt", content_type="text/plain", has_pdf_magic_bytes=False),
                ],
                "expected_top": "c_arxiv_gat",
            },
        ]

        correct_top_count = 0
        for idx, case in enumerate(benchmark_cases):
            target = case["target"]
            candidates = case["candidates"]
            expected_top = case["expected_top"]

            ranked = self.ranker.rank_candidates(target, candidates)
            top_candidate = ranked[0].candidate.candidate_id
            if top_candidate == expected_top and not ranked[0].is_rejected:
                correct_top_count += 1
            else:
                print(f"Case {idx + 1} mismatch: expected {expected_top}, got {top_candidate}")

        accuracy = correct_top_count / len(benchmark_cases)
        assert accuracy >= 0.90, f"Benchmark accuracy {accuracy * 100:.1f}% below 90% threshold"
        assert accuracy == 1.0, f"Expected 100% accuracy on standard benchmark, got {accuracy * 100:.1f}%"
