#!/usr/bin/env node
/**
 * scripts/release-notes.mjs
 * Extracts changelog release notes for a specified version from CHANGELOG.md.
 * Used during GitHub Releases generation.
 *
 * Usage:
 *   node scripts/release-notes.mjs [version] [--output <path>] [--fallback]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getProjectVersions } from './version-check.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

export function extractReleaseNotes(targetVersion, changelogContent) {
  // Normalize version (strip leading v)
  const v = targetVersion.startsWith('v') ? targetVersion.slice(1) : targetVersion;
  const lines = changelogContent.replace(/\r\n/g, '\n').split('\n');

  let capturing = false;
  const resultLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check for version header: ## [0.1.0] or ## 0.1.0 or ## [Unreleased]
    const headerMatch = line.match(/^##\s+\[?([0-9A-Za-z.-]+)\]?(?:\s+-.*)?$/);
    if (headerMatch) {
      const headerVer = headerMatch[1];
      if (capturing) {
        // We reached the subsequent release section, stop
        break;
      }
      if (headerVer === v) {
        capturing = true;
        continue;
      }
    } else if (capturing) {
      resultLines.push(line);
    }
  }

  const result = resultLines.join('\n').trim();
  return result.length > 0 ? result : null;
}

// CLI execution
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const args = process.argv.slice(2);
  let version = null;
  let outputPath = null;
  let allowFallback = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' && args[i + 1]) {
      outputPath = path.resolve(args[i + 1]);
      i++;
    } else if (args[i] === '--fallback') {
      allowFallback = true;
    } else if (!args[i].startsWith('--')) {
      version = args[i];
    }
  }

  if (!version) {
    try {
      version = getProjectVersions(ROOT_DIR).packageJson.version;
    } catch {
      version = '0.1.0';
    }
  }

  const changelogPath = path.join(ROOT_DIR, 'CHANGELOG.md');
  if (!fs.existsSync(changelogPath)) {
    console.error(`[release-notes] Error: CHANGELOG.md not found at ${changelogPath}`);
    process.exit(1);
  }

  const changelogContent = fs.readFileSync(changelogPath, 'utf8');
  let notes = extractReleaseNotes(version, changelogContent);

  if (!notes) {
    if (allowFallback) {
      notes = `### Release v${version}\n\nAutomated production release build for Infinity Researcher v${version}.\nSee commit history for detailed list of updates.`;
      console.warn(`[release-notes] Warning: No entry found for v${version} in CHANGELOG.md. Using fallback notes.`);
    } else {
      console.error(`[release-notes] Error: No changelog section found for version "${version}" in CHANGELOG.md!`);
      console.error(`Add a "## [${version}] - YYYY-MM-DD" section to CHANGELOG.md before publishing.`);
      process.exit(1);
    }
  }

  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, notes, 'utf8');
    console.log(`[release-notes] Written notes for v${version} to ${outputPath}`);
  } else {
    console.log(notes);
  }
}
