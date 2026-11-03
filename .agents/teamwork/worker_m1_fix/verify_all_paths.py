import os
import re

# 1. Build an index of all files in the repository (relative paths, lowercased basenames, etc.)
repo_root = r"d:\Paper"
repo_files = set()
repo_basenames = {}

exclude_dirs = {".git", "node_modules", "target", ".venv", "dist", "build"}

for root, dirs, files in os.walk(repo_root):
    dirs[:] = [d for d in dirs if d not in exclude_dirs]
    for f in files:
        rel_path = os.path.relpath(os.path.join(root, f), repo_root).replace("\\", "/")
        repo_files.add(rel_path)
        base = os.path.basename(rel_path)
        if base not in repo_basenames:
            repo_basenames[base] = []
        repo_basenames[base].append(rel_path)

print(f"Total repo files indexed: {len(repo_files)}")

# 2. Read CURRENT_IMPLEMENTATION_AUDIT.md
with open(os.path.join(repo_root, "docs/research-tools/CURRENT_IMPLEMENTATION_AUDIT.md"), "r", encoding="utf-8") as f:
    lines = f.readlines()

# 3. Extract paths mentioned in the document
# Patterns like src/..., python-engine/..., src-tauri/..., tests/..., etc.
path_pattern = re.compile(r'[`\'"]([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+(?::\d+(?:-\d+)?)?)[`\'"]')

citations = []
for line_no, line in enumerate(lines, 1):
    for match in path_pattern.finditer(line):
        candidate = match.group(1)
        # Strip line numbers
        clean_path = re.sub(r':\d+(?:-\d+)?$', '', candidate.strip())
        clean_path = clean_path.rstrip(',.;')
        
        # Check if it looks like a path or source file
        if (
            '/' in clean_path 
            or any(clean_path.endswith(ext) for ext in ['.rs', '.ts', '.tsx', '.py', '.sql', '.toml', '.json', '.md', '.html', '.exe', '.bak'])
        ):
            # Exclude code snippets, regex, SQL queries
            if not any(clean_path.startswith(prefix) for prefix in [
                'http', 'PRAGMA', 'SELECT', 'CREATE', 'INSERT', 'ALTER', 'UPDATE',
                'cargo', 'npm', 'python', 'tokio::', 'serde_json::', 'AiToolsRepository::', 'std::'
            ]) and not clean_path.startswith('^10.') and not '\\' in clean_path and not '<' in clean_path:
                citations.append((line_no, clean_path))

print(f"Total path citations found: {len(citations)}")
unique_paths = sorted(set(p for _, p in citations))
print(f"Unique path candidates: {len(unique_paths)}")

known_unwritten_or_external = {
    "pytest.exe": "Documented as missing from system PATH (Line 435)",
    "src-tauri/tests/ai_tools_persistence_tests.rs": "Documented as unwritten test suite gap for Milestone M3 (Lines 528, 572)",
    "backups/pre_migration_<timestamp>.sqlite3.bak": "Documented as dynamic runtime backup (Line 485)",
}

missing = []
for p in unique_paths:
    # Direct match
    if p in repo_files or p.replace('/', '\\') in repo_files:
        continue
    # Try src-tauri relative
    tauri_rel = f"src-tauri/{p}"
    if tauri_rel in repo_files:
        continue
    # Try if it's documented as missing/unwritten
    if p in known_unwritten_or_external:
        continue
    # Synthetic fixtures mentioned as missing
    if "tests/fixtures" in p or "fixtures" in p:
        continue
    # Check if basename matches a single file in repo
    base = os.path.basename(p)
    if base in repo_basenames:
        matching = repo_basenames[base]
        # Flag if full path in doc doesn't match actual repo location
        missing.append((p, f"Basename exists at: {matching}"))
    else:
        missing.append((p, "Not found anywhere in repo"))

print(f"\nMissing / Mislocated paths: {len(missing)}")
for p, reason in missing:
    print(f"  - {p}: {reason}")
