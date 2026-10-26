"""
Logging configuration ensuring stderr isolation for IPC protocol stdout purity.
"""

import logging
import sys


def configure_engine_logging(log_level: str = "INFO") -> None:
    """Configure root and Scrapy loggers to output strictly to sys.stderr."""
    formatter = logging.Formatter(
        fmt="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
        datefmt="%H:%M:%S",
    )
    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.setLevel(getattr(logging, log_level.upper(), logging.INFO))
    # Replace existing handlers on root
    root.handlers = [handler]

    # Silence verbose 3rd party loggers
    logging.getLogger("filelock").setLevel(logging.WARNING)
    logging.getLogger("parsel").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
