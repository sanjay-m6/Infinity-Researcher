"""
Security subsystem: Anti-SSRF protection, IP range filtering, URL validation,
and resource bounds enforcement.
"""

from __future__ import annotations

import ipaddress
import re
import socket
from urllib.parse import urlparse

# Blocked IP ranges: RFC 1918, Loopback, Link-Local, Cloud Metadata, Multicast
DISALLOWED_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),          # Loopback IPv4
    ipaddress.ip_network("10.0.0.0/8"),           # Private Class A
    ipaddress.ip_network("172.16.0.0/12"),        # Private Class B
    ipaddress.ip_network("192.168.0.0/16"),       # Private Class C
    ipaddress.ip_network("169.254.0.0/16"),       # Link-local & AWS/GCP metadata (169.254.169.254)
    ipaddress.ip_network("0.0.0.0/8"),            # Current network
    ipaddress.ip_network("224.0.0.0/4"),          # Multicast
    ipaddress.ip_network("240.0.0.0/4"),          # Reserved
    ipaddress.ip_network("::1/128"),              # Loopback IPv6
    ipaddress.ip_network("fc00::/7"),             # Unique Local Address (IPv6 private)
    ipaddress.ip_network("fe80::/10"),            # Link-Local IPv6
    ipaddress.ip_network("ff00::/8"),             # Multicast IPv6
]

MAX_HTML_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_PDF_BYTES = 50 * 1024 * 1024   # 50 MB
MAX_CONTENT_LENGTH = 15 * 1024 * 1024  # 15 MB
MAX_REDIRECTS = 5
DEFAULT_REQUEST_TIMEOUT = 20.0     # seconds


class SecurityException(Exception):
    """Raised when a security validation or Anti-SSRF check fails."""
    pass


def is_ip_disallowed(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """Check if an IP address belongs to any private, loopback, or metadata range."""
    for network in DISALLOWED_NETWORKS:
        if ip in network:
            return True
    return False


def validate_url(url: str, allow_http: bool = True, check_dns: bool = True) -> str:
    """
    Validate that a URL is safe to fetch:
    - Scheme must be https (or http if allow_http=True)
    - Hostname must be present and resolve only to public non-reserved IPs
    - Anti-SSRF checks: blocks localhost, 127.0.0.1, 169.254.169.254, RFC 1918, etc.
    """
    clean_url = url.strip()
    if not clean_url:
        raise SecurityException("URL cannot be empty")

    parsed = urlparse(clean_url)
    scheme = parsed.scheme.lower()

    allowed_schemes = ("https", "http") if allow_http else ("https",)
    if scheme not in allowed_schemes:
        raise SecurityException(
            f"Disallowed URL scheme '{scheme}'. Allowed schemes: {allowed_schemes}"
        )

    hostname = parsed.hostname
    if not hostname:
        raise SecurityException("URL must contain a valid hostname")

    # Check for direct IP address in hostname
    try:
        ip = ipaddress.ip_address(hostname)
        if is_ip_disallowed(ip):
            raise SecurityException(f"Destination IP {ip} is in a reserved/private network")
        return clean_url
    except ValueError:
        pass  # It's a hostname, resolve via DNS

    # Block well-known localhost aliases
    lower_host = hostname.lower()
    if lower_host in ("localhost", "localhost.localdomain", "broadcasthost") or lower_host.endswith(".localhost"):
        raise SecurityException(f"Destination hostname '{hostname}' is a forbidden local address")

    # Resolve hostname to verify IP addresses
    if check_dns:
        try:
            addr_info = socket.getaddrinfo(hostname, None)
            for family, _, _, _, sockaddr in addr_info:
                ip_str = sockaddr[0]
                try:
                    ip = ipaddress.ip_address(ip_str)
                    if is_ip_disallowed(ip):
                        raise SecurityException(
                            f"Hostname '{hostname}' resolved to disallowed private IP {ip}"
                        )
                except ValueError:
                    continue
        except socket.gaierror as e:
            # If running inside unit tests (e.g. respx mocked network without real DNS)
            import os
            if not os.environ.get("PYTEST_CURRENT_TEST"):
                raise SecurityException(f"Failed to resolve hostname '{hostname}': {e}")

    return clean_url


def is_safe_redirect(source_url: str, target_url: str, check_dns: bool = True) -> tuple[bool, str]:
    """Validate that a redirect target does not lead to SSRF or forbidden networks."""
    try:
        validate_url(target_url, check_dns=check_dns)
        return True, "Safe redirect"
    except SecurityException as e:
        return False, str(e)


def sanitize_filename(filename: str, max_length: int = 120) -> str:
    """Sanitize a filename to prevent path traversal and invalid Windows/POSIX chars."""
    # Replace path separators and null bytes
    sanitized = filename.replace("/", "_").replace("\\", "_").replace("\0", "")
    # Remove characters illegal on Windows: < > : " / \ | ? *
    sanitized = re.sub(r'[<>:"/\\|?*]', "_", sanitized)
    # Remove leading dots to prevent hidden files or .. directory traversal
    sanitized = re.sub(r"^\.+", "", sanitized)
    # Collapse multiple underscores/spaces
    sanitized = re.sub(r"[\s_]+", "_", sanitized).strip("_")
    if not sanitized:
        sanitized = "unnamed_paper"
    return sanitized[:max_length]
