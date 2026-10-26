import pytest
from paper_scraper.security import (
    SecurityException,
    is_ip_disallowed,
    sanitize_filename,
    validate_url,
)
import ipaddress


def test_ip_disallowed_checks():
    # Loopback
    assert is_ip_disallowed(ipaddress.ip_address("127.0.0.1"))
    assert is_ip_disallowed(ipaddress.ip_address("127.1.2.3"))
    assert is_ip_disallowed(ipaddress.ip_address("::1"))

    # Private IPv4 (RFC 1918)
    assert is_ip_disallowed(ipaddress.ip_address("10.0.0.1"))
    assert is_ip_disallowed(ipaddress.ip_address("172.16.0.5"))
    assert is_ip_disallowed(ipaddress.ip_address("192.168.1.1"))

    # Cloud metadata (AWS / GCP / Azure)
    assert is_ip_disallowed(ipaddress.ip_address("169.254.169.254"))

    # Public safe IPs
    assert not is_ip_disallowed(ipaddress.ip_address("8.8.8.8"))
    assert not is_ip_disallowed(ipaddress.ip_address("1.1.1.1"))
    assert not is_ip_disallowed(ipaddress.ip_address("128.84.21.199"))  # arXiv


def test_validate_url_schemes():
    # Reject dangerous schemes
    with pytest.raises(SecurityException, match="Disallowed URL scheme"):
        validate_url("file:///etc/passwd")

    with pytest.raises(SecurityException, match="Disallowed URL scheme"):
        validate_url("ftp://ftp.example.com/file")

    with pytest.raises(SecurityException, match="Disallowed URL scheme"):
        validate_url("javascript:alert(1)")

    # Allow HTTP/HTTPS
    valid_https = "https://arxiv.org/abs/2401.05432"
    assert validate_url(valid_https) == valid_https


def test_validate_url_ssrf_blocking():
    # Direct loopback IP
    with pytest.raises(SecurityException, match="reserved/private network"):
        validate_url("http://127.0.0.1:8080/secret")

    # Localhost hostname
    with pytest.raises(SecurityException, match="forbidden local address"):
        validate_url("http://localhost/admin")

    # Private network IP
    with pytest.raises(SecurityException, match="reserved/private network"):
        validate_url("https://192.168.1.1/router")

    # AWS metadata endpoint
    with pytest.raises(SecurityException, match="reserved/private network"):
        validate_url("http://169.254.169.254/latest/meta-data/")


def test_sanitize_filename():
    assert sanitize_filename("my_paper.pdf") == "my_paper.pdf"
    # Windows forbidden characters
    assert sanitize_filename('paper: "Analysis" <v1>?.pdf') == "paper_Analysis_v1_.pdf"
    # Directory traversal
    assert sanitize_filename("../../../etc/passwd") == ".._.._etc_passwd"
    assert sanitize_filename("..\\..\\Windows\\System32") == ".._Windows_System32"
    # Empty string fallback
    assert sanitize_filename("") == "unnamed_paper"
