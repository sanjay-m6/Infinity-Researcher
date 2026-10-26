"""
Scholarly metadata and PDF extractors.
"""

from paper_scraper.extractors.metadata import LayeredMetadataExtractor
from paper_scraper.extractors.pdf import PdfDiscoveryExtractor

__all__ = ["LayeredMetadataExtractor", "PdfDiscoveryExtractor"]
