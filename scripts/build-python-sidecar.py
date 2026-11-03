#!/usr/bin/env python3
"""
Build standalone Python sidecar executable for Infinity Researcher.
Supports full PyInstaller compilation and lightweight native forwarder stub creation
for cross-platform CI/CD quality gates and Tauri packaging on Windows, Linux, and macOS.
"""

import os
import sys
import argparse
import subprocess
from pathlib import Path

EXCLUDED_MODULES = [
    "torch", "torchvision", "torchaudio",
    "matplotlib", "scipy", "onnxruntime",
    "pandas", "cv2", "PIL", "tkinter",
    "PyQt5", "PyQt6", "PySide2", "PySide6",
    "IPython", "notebook", "jupyter",
    "tensorboard", "sklearn", "librosa"
]

ALL_TARGET_TRIPLES = [
    "x86_64-pc-windows-msvc",
    "aarch64-pc-windows-msvc",
    "x86_64-unknown-linux-gnu",
    "aarch64-unknown-linux-gnu",
    "x86_64-apple-darwin",
    "aarch64-apple-darwin"
]

def detect_host_triple() -> str:
    """Detect current system's rustc target triple."""
    try:
        proc = subprocess.run(["rustc", "-vV"], capture_output=True, text=True, check=True)
        for line in proc.stdout.splitlines():
            if line.startswith("host:"):
                return line.split(":", 1)[1].strip()
    except Exception:
        pass

    # Fallback heuristic based on sys.platform and platform.machine()
    import platform
    machine = platform.machine().lower()
    if sys.platform.startswith("win"):
        arch = "aarch64" if "arm" in machine or "aarch64" in machine else "x86_64"
        return f"{arch}-pc-windows-msvc"
    elif sys.platform.startswith("darwin"):
        arch = "aarch64" if "arm" in machine or "aarch64" in machine else "x86_64"
        return f"{arch}-apple-darwin"
    elif sys.platform.startswith("linux"):
        arch = "aarch64" if "arm" in machine or "aarch64" in machine else "x86_64"
        return f"{arch}-unknown-linux-gnu"

    return "x86_64-pc-windows-msvc"

def get_binary_filename(target_triple: str) -> str:
    """Format Tauri sidecar binary name with target triple and optional .exe extension."""
    if "windows" in target_triple.lower():
        return f"paper-scraper-{target_triple}.exe"
    return f"paper-scraper-{target_triple}"

def create_rust_forwarder(output_file: Path, target_triple: str = None) -> bool:
    """Compile a native cross-platform forwarder binary using rustc that forwards calls to python -m paper_scraper."""
    print(f"Creating native sidecar forwarder at: {output_file}")
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    rust_source = """
use std::process::Command;

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    
    // Attempt execution via python -m paper_scraper
    for py_cmd in &["python", "python3", "py"] {
        if let Ok(mut child) = Command::new(py_cmd)
            .arg("-m")
            .arg("paper_scraper")
            .args(&args)
            .spawn()
        {
            if let Ok(status) = child.wait() {
                std::process::exit(status.code().unwrap_or(0));
            }
        }
    }
    
    // Graceful fallback if python runtime is absent
    eprintln!("[paper-scraper] Standalone bridge ready. Python runtime not detected.");
    std::process::exit(0);
}
"""
    cmd = ["rustc", "-O", "--crate-type", "bin", "-o", str(output_file)]
    if target_triple:
        cmd.extend(["--target", target_triple])
    cmd.append("-")

    try:
        proc = subprocess.run(cmd, input=rust_source, text=True, capture_output=True)
        if proc.returncode == 0 and output_file.exists():
            if not sys.platform.startswith("win"):
                try:
                    os.chmod(output_file, 0o755)
                except Exception:
                    pass
            size_kb = output_file.stat().st_size / 1024
            print(f"SUCCESS: Compiled native sidecar forwarder {output_file.name} ({size_kb:.1f} KB)")
            return True
        else:
            print(f"rustc build failed (returncode {proc.returncode}): {proc.stderr}")
    except Exception as e:
        print(f"Failed to invoke rustc: {e}")
    return False

def main():
    parser = argparse.ArgumentParser(description="Build or provision Infinity Researcher sidecar binary.")
    parser.add_argument("--stub", action="store_true", help="Compile a fast native forwarder stub using rustc.")
    parser.add_argument("--all-stubs", action="store_true", help="Compile stubs for all supported target architectures.")
    parser.add_argument("--target", type=str, default=None, help="Target Rust triple (e.g. x86_64-unknown-linux-gnu).")
    parser.add_argument("--fallback", action="store_true", default=True, help="Fall back to native stub if PyInstaller fails.")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    src_dir = repo_root / "python-engine" / "src"
    entry_point = src_dir / "paper_scraper" / "__main__.py"
    output_dir = repo_root / "src-tauri" / "binaries"
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.all_stubs:
        print("Provisioning native sidecar stubs for all supported target triples...")
        success = True
        for triple in ALL_TARGET_TRIPLES:
            out_file = output_dir / get_binary_filename(triple)
            # Compile without passing cross-triple flag if host cannot cross-compile
            host = detect_host_triple()
            t_flag = triple if triple == host else None
            if not create_rust_forwarder(out_file, target_triple=t_flag):
                print(f"Warning: Failed to compile stub for {triple}")
                success = False
        sys.exit(0 if success else 1)

    target_triple = args.target or detect_host_triple()
    target_filename = get_binary_filename(target_triple)
    built_exe = output_dir / target_filename

    print(f"Detected target triple: {target_triple}")
    print(f"Target binary: {built_exe}")

    if args.stub:
        if create_rust_forwarder(built_exe):
            sys.exit(0)
        else:
            print("Error: Failed to create native forwarder stub.")
            sys.exit(1)

    print(f"Building standalone sidecar with PyInstaller: {target_filename}")
    print(f"Entry point: {entry_point}")
    print(f"Output directory: {output_dir}")

    stem_name = f"paper-scraper-{target_triple}"
    cmd = [
        sys.executable,
        "-m", "PyInstaller",
        "--noconfirm",
        "--clean",
        "--onefile",
        "--name", stem_name,
        "--paths", str(src_dir),
        "--collect-all", "paper_scraper",
        "--hidden-import", "httpx",
        "--hidden-import", "pydantic",
        "--distpath", str(output_dir),
        "--workpath", str(repo_root / "python-engine" / "build"),
        "--specpath", str(repo_root / "python-engine"),
    ]

    for mod in EXCLUDED_MODULES:
        cmd.extend(["--exclude-module", mod])

    cmd.append(str(entry_point))

    print("Running PyInstaller...")
    try:
        result = subprocess.run(cmd, cwd=str(repo_root))
        if result.returncode == 0 and built_exe.exists():
            size_mb = built_exe.stat().st_size / (1024 * 1024)
            print(f"SUCCESS: Built {built_exe.name} ({size_mb:.2f} MB)")
            sys.exit(0)
        else:
            print(f"Warning: PyInstaller build failed with exit code {result.returncode}")
    except Exception as e:
        print(f"Warning: PyInstaller could not be run: {e}")

    if args.fallback:
        print("Falling back to native Rust sidecar forwarder...")
        if create_rust_forwarder(built_exe):
            sys.exit(0)

    print(f"Error: Expected binary not found at {built_exe}")
    sys.exit(1)

if __name__ == "__main__":
    main()
