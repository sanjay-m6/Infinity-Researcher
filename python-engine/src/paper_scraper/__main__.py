"""
Command-line and Tauri sidecar entry point for the paper scraping engine.
"""

import sys

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] in ("--worker", "worker"):
        from paper_scraper.engine.worker import run_worker_cli
        run_worker_cli()
    else:
        from paper_scraper.integration.runner import run_sidecar
        run_sidecar()
