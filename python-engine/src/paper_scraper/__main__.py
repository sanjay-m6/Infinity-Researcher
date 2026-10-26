"""
Command-line and Tauri sidecar entry point for the paper scraping engine.
"""

from paper_scraper.integration.runner import run_sidecar

if __name__ == "__main__":
    run_sidecar()
