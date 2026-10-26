import sys
from pathlib import Path
import pytest

# Ensure src is on sys.path
SRC_DIR = Path(__file__).resolve().parent.parent / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


@pytest.fixture
def arxiv_html() -> str:
    return (FIXTURES_DIR / "arxiv_search.html").read_text(encoding="utf-8")


@pytest.fixture
def biorxiv_html() -> str:
    return (FIXTURES_DIR / "biorxiv_search.html").read_text(encoding="utf-8")


@pytest.fixture
def pubmed_html() -> str:
    return (FIXTURES_DIR / "pubmed_search.html").read_text(encoding="utf-8")


@pytest.fixture
def plos_html() -> str:
    return (FIXTURES_DIR / "plos_search.html").read_text(encoding="utf-8")


@pytest.fixture
def zero_results_html() -> str:
    return (FIXTURES_DIR / "zero_results.html").read_text(encoding="utf-8")


@pytest.fixture
def malformed_html() -> str:
    return (FIXTURES_DIR / "malformed_results.html").read_text(encoding="utf-8")


@pytest.fixture
def fake_pdf_login_html() -> str:
    return (FIXTURES_DIR / "fake_pdf_login_wall.html").read_text(encoding="utf-8")
