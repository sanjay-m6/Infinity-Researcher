#!/usr/bin/env node
/**
 * Infinity Researcher — Secret & Repository Hygiene Audit Tool
 *
 * Scans repository files for accidentally committed secrets, private signing keys,
 * unredacted personal access tokens, and temporary binary artifacts.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "target",
  ".pytest_cache",
  ".venv",
  "venv",
  "coverage",
  "__pycache__",
]);

const SECRET_PATTERNS = [
  {
    name: "Private Cryptographic Key",
    regex: /-----BEGIN\s+(?:RSA|EC|DSA|OPENSSH|PGP|ENCRYPTED)?\s*PRIVATE\s+KEY-----/i,
  },
  {
    name: "Tauri / Minisign Secret Key Header",
    regex: /untrusted\s+comment:\s*rsign\s+encrypted\s+secret\s+key/i,
  },
  {
    name: "GitHub Personal Access Token (Classic)",
    regex: /\bghp_[a-zA-Z0-9]{36}\b/,
  },
  {
    name: "GitHub Fine-Grained Personal Access Token",
    regex: /\bgithub_pat_[a-zA-Z0-9_]{82}\b/,
  },
  {
    name: "Live Cloud Provider Secret Key",
    regex: /\b(?:sk-[a-zA-Z0-9]{32,}|xai-[a-zA-Z0-9]{32,})\b/,
  },
];

const FORBIDDEN_FILE_EXTENSIONS = new Set([
  ".sqlite3",
  ".db-wal",
  ".db-shm",
  ".key",
  ".pem",
  ".priv",
]);

// Excluded test fixtures where harmless mock tokens are intentionally asserted
function isAllowedMockFile(filePath) {
  const norm = filePath.replace(/\\/g, "/");
  return (
    norm.includes("test/") ||
    norm.includes("tests/") ||
    norm.includes("redactor.ts") ||
    norm.includes("audit-secrets.mjs") ||
    norm.endsWith(".example") ||
    norm.includes("scripts/")
  );
}

function scanDirectory(dir, issues = [], stats = { filesScanned: 0 }) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(ROOT_DIR, fullPath);

    if (entry.isDirectory()) {
      scanDirectory(fullPath, issues, stats);
    } else if (entry.isFile()) {
      stats.filesScanned++;

      // 1. Check forbidden extensions
      const ext = path.extname(entry.name).toLowerCase();
      if (FORBIDDEN_FILE_EXTENSIONS.has(ext)) {
        issues.push({
          file: relPath,
          line: 0,
          type: "Forbidden File Extension",
          snippet: `File has forbidden extension '${ext}' which should be in .gitignore`,
        });
        continue;
      }

      // Check .env files
      if (entry.name === ".env" || (entry.name.startsWith(".env.") && !entry.name.endsWith(".example"))) {
        issues.push({
          file: relPath,
          line: 0,
          type: "Committed Environment File",
          snippet: "Live .env files must never be committed. Use .env.example instead.",
        });
        continue;
      }

      // Skip large binary files or allowed mock files for regex scanning
      if (isAllowedMockFile(fullPath)) continue;

      const size = fs.statSync(fullPath).size;
      if (size > 2 * 1024 * 1024) continue; // Skip files > 2MB

      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          for (const pattern of SECRET_PATTERNS) {
            if (pattern.regex.test(line)) {
              issues.push({
                file: relPath,
                line: i + 1,
                type: pattern.name,
                snippet: line.trim().substring(0, 80),
              });
            }
          }
        }
      } catch {
        // Ignored for binary files that cannot be decoded as utf-8
      }
    }
  }

  return { issues, stats };
}

export function scanDirectoryForSecrets(rootDir = ROOT_DIR) {
  const issues = [];
  const stats = { filesScanned: 0 };
  scanDirectory(rootDir, issues, stats);
  return { findings: issues, issues, stats };
}

// CLI execution
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  console.log("🔍 Scanning Infinity Researcher repository for secrets & hygiene issues...");
  const { issues, stats } = scanDirectoryForSecrets(ROOT_DIR);

  console.log(`✓ Scanned ${stats.filesScanned} repository files.`);

  if (issues.length === 0) {
    console.log("✅ Secret & Hygiene Audit Passed: No credentials, private keys, or forbidden files found.\n");
    process.exit(0);
  } else {
    console.error(`\n❌ Found ${issues.length} secret / hygiene issue(s):`);
    for (const issue of issues) {
      console.error(`  - [${issue.type}] ${issue.file}:${issue.line}`);
      console.error(`    Preview: ${issue.snippet}`);
    }
    console.error("\nRemediation Instructions:");
    console.error("  1. Remove or redact the sensitive credential immediately.");
    console.error("  2. If a secret was committed to remote git history, rotate/revoke it at the provider.");
    console.error("  3. Ensure sensitive files are listed in .gitignore.\n");
    process.exit(1);
  }
}
