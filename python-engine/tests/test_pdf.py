import pytest
from paper_scraper.pdf import verify_pdf_signature, PdfManager


def test_verify_pdf_signature_valid():
    valid_pdf_bytes = b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<<...>>"
    is_valid, reason = verify_pdf_signature(valid_pdf_bytes)
    assert is_valid is True
    assert reason is None


def test_verify_pdf_signature_html_masquerade(fake_pdf_login_html):
    html_bytes = fake_pdf_login_html.encode("utf-8")
    is_valid, reason = verify_pdf_signature(html_bytes)
    assert is_valid is False
    assert "HTML webpage instead of a direct PDF" in reason
    assert "institutional login" in reason


def test_verify_pdf_signature_too_short_or_corrupt():
    is_valid, reason = verify_pdf_signature(b"%PD")
    assert is_valid is False
    assert "too small" in reason

    is_valid, reason = verify_pdf_signature(b"RANDOM_NON_PDF_DATA_HERE")
    assert is_valid is False
    assert "did not contain a valid PDF signature" in reason


@pytest.mark.asyncio
async def test_pdf_manager_ssrf_blocked():
    manager = PdfManager()
    # Try local IP
    res = await manager.check_pdf_availability("http://127.0.0.1/paper.pdf")
    assert res["available"] is False
    assert res["status"] == "restricted"
    assert res.get("is_ssrf_blocked") is True
