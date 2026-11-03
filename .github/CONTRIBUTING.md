# Contributing to Infinity Researcher

Thank you for your interest in contributing to **Infinity Researcher**! We welcome bug fixes, documentation improvements, academic website adapters, and feature suggestions.

---

## 1. Code of Conduct & Academic Integrity

Infinity Researcher is dedicated to scholarly literature research and academic study. All contributors are expected to:
- Respect academic source terms of service and crawler etiquette (rate limits, robots.txt compliance).
- Maintain local-first data sovereignty principles (zero unauthorized remote telemetry).
- Write defensive code with Anti-SSRF guards and input sanitization.

---

## 2. Git Branch & Release Workflow

We use a simple, sustainable trunk-based branching workflow:
- **`main`**: The primary branch containing stable, releasable code. Direct pushes are restricted; all changes arrive via pull requests.
- **`feature/*` / `fix/*`**: Work branches branched from `main`. Keep pull requests scoped and focused.
- **Release Tags (`vMAJOR.MINOR.PATCH`)**: Production releases are triggered by semantic version tags (e.g., `v0.1.0`, `v0.2.0`).

---

## 3. Development Setup

### Prerequisites
- **Node.js**: v20 or v22 LTS (`npm` v10+)
- **Rust Toolchain**: Stable 1.85+ (`cargo`, `rustfmt`, `clippy`)
- **Python**: 3.10+ (for Python scraper engine development)
- **Tauri 2 CLI**: Installed via devDependencies (`npx tauri`)

### Installation & Execution
```bash
# Clone the repository
git clone https://github.com/sanjay-m6/Infinity-Researcher.git
cd Infinity-Researcher

# Install frontend dependencies
npm ci

# Run development desktop application
npm run tauri dev
```

---

## 4. Quality Gates & Pre-Commit Verification

Before submitting a pull request, run the local quality checks:

```bash
# 1. TypeScript & Lint
npm run typecheck
npm run lint

# 2. Frontend Unit & Integration Tests
npm run test

# 3. Rust Backend Quality
cd src-tauri
cargo fmt --check
cargo clippy -- -D warnings
cargo test
cd ..

# 4. Python Engine Tests
python -m pytest python-engine/tests -q

# 5. Secret & Hygiene Audit
node scripts/audit-secrets.mjs
```

---

## 5. Versioning & Changelog Guidelines

Infinity Researcher adheres to [Semantic Versioning 2.0.0](https://semver.org/):
- **MAJOR**: Incompatible API, database migration breaking changes, or major UI overhauls.
- **MINOR**: New backward-compatible research tools, crawlers, or workspace capabilities.
- **PATCH**: Backward-compatible bug fixes, UI adjustments, or security hardening.

When introducing changes, please add an entry to [`CHANGELOG.md`](../CHANGELOG.md) under the `[Unreleased]` section.

---

## 6. Reporting Security Vulnerabilities

Please **DO NOT** report security vulnerabilities via public GitHub issues. See our [`SECURITY.md`](../SECURITY.md) for confidential disclosure instructions.
