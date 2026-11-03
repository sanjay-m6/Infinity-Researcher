#!/usr/bin/env python3
"""
Build standalone Python sidecar executable for Infinity Researcher.
Uses PyInstaller to package paper_scraper into a single executable
for Windows x64 without requiring Python or pip on end-user machines.
"""

import os
import sys
import subprocess
from pathlib import Path

def main():
    repo_root = Path(__file__).resolve().parent.parent
    src_dir = repo_root / "python-engine" / "src"
    entry_point = src_dir / "paper_scraper" / "__main__.py"
    output_dir = repo_root / "src-tauri" / "binaries"
    output_dir.mkdir(parents=True, exist_ok=True)

    target_name = "paper-scraper-x86_64-pc-windows-msvc"

    print(f"Building standalone sidecar: {target_name}.exe")
    print(f"Entry point: {entry_point}")
    print(f"Output directory: {output_dir}")

    cmd = [
        sys.executable,
        "-m", "PyInstaller",
        "--noconfirm",
        "--clean",
        "--onefile",
        "--name", target_name,
        "--paths", str(src_dir),
        "--collect-all", "paper_scraper",
        "--hidden-import", "httpx",
        "--hidden-import", "pydantic",
        "--distpath", str(output_dir),
        "--workpath", str(repo_root / "python-engine" / "build"),
        "--specpath", str(repo_root / "python-engine"),
        str(entry_point)
    ]

    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=str(repo_root))
    if result.returncode != 0:
        print(f"Error: PyInstaller build failed with exit code {result.returncode}")
        sys.exit(result.returncode)

    built_exe = output_dir / f"{target_name}.exe"
    if built_exe.exists():
        size_mb = built_exe.stat().st_size / (1024 * 1024)
        print(f"SUCCESS: Built {built_exe.name} ({size_mb:.2f} MB)")
    else:
        print(f"Error: Expected binary not found at {built_exe}")
        sys.exit(1)

if __name__ == "__main__":
    main()
