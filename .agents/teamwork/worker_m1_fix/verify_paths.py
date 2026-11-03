import re
import os

with open("docs/research-tools/CURRENT_IMPLEMENTATION_AUDIT.md", "r", encoding="utf-8") as f:
    text = f.read()

# Match backtick-enclosed strings that look like file paths or filenames with extensions
pattern = r"`([^`\n]+)`"
matches = re.findall(pattern, text)

# Filter for path-like strings
candidates = set()
for raw in matches:
    # strip line numbers or line ranges e.g. :111 or :116-167
    cleaned = re.sub(r":\d+(?:-\d+)?$", "", raw.strip())
    # strip trailing punctuation
    cleaned = cleaned.rstrip(",.;")
    if any(cleaned.endswith(ext) for ext in [
        ".tsx", ".ts", ".rs", ".py", ".sql", ".toml", ".json", ".md", ".html", ".exe", ".bak", ".txt", ".pdf", ".docx", ".bib", ".tex", ".rtf"
    ]) or "/" in cleaned or "\\" in cleaned:
        # exclude obvious non-paths (e.g. commands, urls, code snippets, git commits)
        if not cleaned.startswith(("http", "PRAGMA", "SELECT", "CREATE", "INSERT", "ALTER", "UPDATE", "cargo ", "npm ", "python ", "tokio::", "serde_json::", "AiToolsRepository::", "std::")):
            candidates.add(cleaned)

print(f"Total path candidates extracted: {len(candidates)}")

existing = []
missing = []

for p in sorted(candidates):
    norm_p = p.replace("/", os.sep)
    # direct path relative to repo root
    full_p = os.path.join("d:\\Paper", norm_p)
    # also try inside src-tauri if not found
    tauri_p = os.path.join("d:\\Paper\\src-tauri", norm_p)
    if os.path.exists(full_p):
        existing.append(p)
    elif os.path.exists(tauri_p):
        existing.append(f"{p} -> src-tauri/{p}")
    else:
        missing.append(p)

print(f"Verified Existing on disk: {len(existing)}")
print(f"Missing / Unfound: {len(missing)}")
print("\n--- Missing / Unfound list ---")
for m in missing:
    print(" - ", m)
