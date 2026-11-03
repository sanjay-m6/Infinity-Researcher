#!/usr/bin/env node
/**
 * scripts/release-check.mjs
 * Validates pre-release prerequisites before tagging or publishing a release:
 * 1. SemVer synchronization across package.json, tauri.conf.json, and Cargo.toml.
 * 2. Secret scanning hygiene.
 * 3. Tauri updater configuration (endpoints, pubkey).
 * 4. Git status & tag conflicts.
 * 5. Changelog readiness.
 *
 * Usage:
 *   node scripts/release-check.mjs [--tag v0.1.0] [--allow-dirty]
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateVersions } from './version-check.mjs';
import { scanDirectoryForSecrets } from './audit-secrets.mjs';
import { extractReleaseNotes } from './release-notes.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

export function runReleaseChecks(options = {}) {
  const { rootDir = ROOT_DIR, expectedTag = null, allowDirty = false } = options;
  const results = [];
  let allPassed = true;

  function report(name, passed, message) {
    results.push({ name, passed, message });
    if (!passed) allPassed = false;
  }

  // 1. Version synchronization
  try {
    const vCheck = validateVersions(rootDir, expectedTag);
    if (vCheck.valid) {
      report('Version Synchronization', true, `All files synchronized at v${vCheck.version}`);
    } else {
      report('Version Synchronization', false, vCheck.errors.join('; '));
    }
  } catch (err) {
    report('Version Synchronization', false, err.message);
  }

  // 2. Secret audit
  try {
    const secretAudit = scanDirectoryForSecrets(rootDir);
    if (secretAudit.findings.length === 0) {
      report('Secret Audit', true, 'Zero unredacted credentials or private keys detected.');
    } else {
      report('Secret Audit', false, `Found ${secretAudit.findings.length} secret finding(s)!`);
    }
  } catch (err) {
    report('Secret Audit', false, err.message);
  }

  // 3. Tauri updater configuration
  try {
    const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
    const conf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
    const updater = conf.plugins?.updater;

    if (!updater) {
      report('Tauri Updater Config', false, 'Missing "plugins.updater" block in tauri.conf.json');
    } else if (!updater.pubkey || updater.pubkey.length < 30) {
      report('Tauri Updater Config', false, 'Missing or invalid "plugins.updater.pubkey"');
    } else if (!Array.isArray(updater.endpoints) || updater.endpoints.length === 0) {
      report('Tauri Updater Config', false, 'Missing "plugins.updater.endpoints"');
    } else {
      report('Tauri Updater Config', true, `Configured with valid pubkey and endpoint: ${updater.endpoints[0]}`);
    }
  } catch (err) {
    report('Tauri Updater Config', false, err.message);
  }

  // 4. Git repository state
  try {
    const status = execSync('git status --porcelain', { cwd: rootDir, encoding: 'utf8' }).trim();
    if (!status) {
      report('Git Working Tree', true, 'Working directory is clean.');
    } else if (allowDirty) {
      report('Git Working Tree', true, `Working directory has uncommitted files (allowed via --allow-dirty).`);
    } else {
      report('Git Working Tree', false, `Working directory has uncommitted files:\n${status}`);
    }
  } catch (e) {
    report('Git Working Tree', true, `Not running in git environment (${e.message})`);
  }

  // 5. Changelog check
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    const changelog = fs.readFileSync(path.join(rootDir, 'CHANGELOG.md'), 'utf8');
    const notes = extractReleaseNotes(pkg.version, changelog);

    if (notes) {
      report('Changelog Entry', true, `Found release notes for v${pkg.version} (${notes.length} chars)`);
    } else {
      // Check if unreleased section has notes
      const unreleasedNotes = extractReleaseNotes('Unreleased', changelog);
      if (unreleasedNotes) {
        report('Changelog Entry', true, `Found [Unreleased] notes ready for v${pkg.version}`);
      } else {
        report('Changelog Entry', false, `No changelog entry found for v${pkg.version} or [Unreleased] in CHANGELOG.md`);
      }
    }
  } catch (err) {
    report('Changelog Entry', false, err.message);
  }

  return { allPassed, results };
}

// CLI execution
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const args = process.argv.slice(2);
  let expectedTag = null;
  let allowDirty = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tag' && args[i + 1]) {
      expectedTag = args[i + 1];
      i++;
    } else if (args[i].startsWith('--tag=')) {
      expectedTag = args[i].split('=')[1];
    } else if (args[i] === '--allow-dirty') {
      allowDirty = true;
    }
  }

  console.log(`\n========================================`);
  console.log(`Infinity Researcher — Release Check`);
  console.log(`========================================`);

  const { allPassed, results } = runReleaseChecks({ expectedTag, allowDirty });

  for (const r of results) {
    const symbol = r.passed ? '✓ [PASS]' : '✗ [FAIL]';
    console.log(`${symbol} ${r.name}`);
    console.log(`   ${r.message}`);
  }

  console.log(`========================================`);
  if (!allPassed) {
    console.error(`\nRelease checks FAILED. Correct issues before building release.\n`);
    process.exit(1);
  } else {
    console.log(`\nAll release checks PASSED. Ready for release build.\n`);
    process.exit(0);
  }
}
