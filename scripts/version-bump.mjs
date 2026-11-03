#!/usr/bin/env node
/**
 * scripts/version-bump.mjs
 * Atomically bumps application version across package.json, src-tauri/tauri.conf.json,
 * src-tauri/Cargo.toml, and package-lock.json.
 *
 * Usage:
 *   node scripts/version-bump.mjs patch
 *   node scripts/version-bump.mjs minor
 *   node scripts/version-bump.mjs major
 *   node scripts/version-bump.mjs 1.0.0
 *   node scripts/version-bump.mjs 1.0.0-beta.1
 *   node scripts/version-bump.mjs minor --dry-run
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateVersions } from './version-check.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const SEMVER_REGEX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

function parseSemVer(v) {
  const match = v.match(SEMVER_REGEX);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || null,
    build: match[5] || null,
  };
}

export function computeNextVersion(currentVersion, bumpType) {
  const parsed = parseSemVer(currentVersion);
  if (!parsed) {
    throw new Error(`Current version "${currentVersion}" is not a valid Semantic Version.`);
  }

  // If bumpType is already a valid SemVer, validate and return it
  if (SEMVER_REGEX.test(bumpType)) {
    return bumpType;
  }

  switch (bumpType.toLowerCase()) {
    case 'major':
      return `${parsed.major + 1}.0.0`;
    case 'minor':
      return `${parsed.major}.${parsed.minor + 1}.0`;
    case 'patch':
      return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
    case 'prerelease': {
      if (parsed.prerelease) {
        // e.g., beta.1 -> beta.2
        const parts = parsed.prerelease.split('.');
        const last = parts[parts.length - 1];
        if (/^\d+$/.test(last)) {
          parts[parts.length - 1] = String(parseInt(last, 10) + 1);
          return `${parsed.major}.${parsed.minor}.${parsed.patch}-${parts.join('.')}`;
        }
        return `${parsed.major}.${parsed.minor}.${parsed.patch}-${parsed.prerelease}.1`;
      }
      return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}-beta.1`;
    }
    default:
      throw new Error(`Invalid bump type "${bumpType}". Must be 'patch', 'minor', 'major', 'prerelease', or an explicit version like '1.2.3'.`);
  }
}

export function bumpVersions(targetVersion, options = {}) {
  const { rootDir = ROOT_DIR, dryRun = false, force = false, skipGitCheck = false } = options;

  // 1. Check current sync
  const initialCheck = validateVersions(rootDir);
  if (!initialCheck.valid && !force) {
    throw new Error(
      `Cannot bump: current versions are not synchronized:\n${initialCheck.errors.map(e => '  - ' + e).join('\n')}`
    );
  }

  const currentVersion = initialCheck.version;
  const nextVersion = computeNextVersion(currentVersion, targetVersion);

  if (!SEMVER_REGEX.test(nextVersion)) {
    throw new Error(`Calculated target version "${nextVersion}" is not valid SemVer.`);
  }

  // 2. Check if git tag already exists
  if (!skipGitCheck) {
    try {
      const existingTags = execSync(`git tag -l v${nextVersion}`, { cwd: rootDir, encoding: 'utf8' }).trim();
      if (existingTags) {
        throw new Error(`A Git tag "v${nextVersion}" already exists in the repository! Aborting.`);
      }
    } catch (e) {
      if (e.message.includes('already exists')) throw e;
      // git tag check failed (e.g. not a git repo), continue
    }
  }

  const changes = [];

  // File paths
  const pkgPath = path.join(rootDir, 'package.json');
  const pkgLockPath = path.join(rootDir, 'package-lock.json');
  const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
  const cargoPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
  const changelogPath = path.join(rootDir, 'CHANGELOG.md');

  // A. package.json
  const pkgContent = fs.readFileSync(pkgPath, 'utf8');
  const pkgObj = JSON.parse(pkgContent);
  pkgObj.version = nextVersion;
  const newPkgContent = JSON.stringify(pkgObj, null, 2) + '\n';
  changes.push({ path: pkgPath, name: 'package.json' });

  // B. package-lock.json (if present)
  let newPkgLockContent = null;
  if (fs.existsSync(pkgLockPath)) {
    const pkgLockObj = JSON.parse(fs.readFileSync(pkgLockPath, 'utf8'));
    pkgLockObj.version = nextVersion;
    if (pkgLockObj.packages && pkgLockObj.packages['']) {
      pkgLockObj.packages[''].version = nextVersion;
    }
    newPkgLockContent = JSON.stringify(pkgLockObj, null, 2) + '\n';
    changes.push({ path: pkgLockPath, name: 'package-lock.json' });
  }

  // C. src-tauri/tauri.conf.json
  const tauriContent = fs.readFileSync(tauriConfPath, 'utf8');
  const tauriObj = JSON.parse(tauriContent);
  tauriObj.version = nextVersion;
  const newTauriContent = JSON.stringify(tauriObj, null, 2) + '\n';
  changes.push({ path: tauriConfPath, name: 'src-tauri/tauri.conf.json' });

  // D. src-tauri/Cargo.toml
  const cargoContent = fs.readFileSync(cargoPath, 'utf8');
  const newCargoContent = cargoContent.replace(
    /(\[package\][^\[]*?version\s*=\s*)"([^"]+)"/s,
    `$1"${nextVersion}"`
  );
  if (cargoContent === newCargoContent) {
    throw new Error(`Failed to substitute version in ${cargoPath}`);
  }
  changes.push({ path: cargoPath, name: 'src-tauri/Cargo.toml' });

  // E. CHANGELOG.md
  let newChangelogContent = null;
  if (fs.existsSync(changelogPath)) {
    const changelog = fs.readFileSync(changelogPath, 'utf8');
    const today = new Date().toISOString().split('T')[0];
    const unreleasedHeader = '## [Unreleased]';
    const releaseHeader = `## [${nextVersion}] - ${today}`;

    if (changelog.includes(unreleasedHeader)) {
      newChangelogContent = changelog.replace(
        unreleasedHeader,
        `${unreleasedHeader}\n\n${releaseHeader}`
      );
      changes.push({ path: changelogPath, name: 'CHANGELOG.md (prepared release section)' });
    }
  }

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      currentVersion,
      nextVersion,
      changes: changes.map(c => c.name),
    };
  }

  // Apply changes
  fs.writeFileSync(pkgPath, newPkgContent, 'utf8');
  if (newPkgLockContent) fs.writeFileSync(pkgLockPath, newPkgLockContent, 'utf8');
  fs.writeFileSync(tauriConfPath, newTauriContent, 'utf8');
  fs.writeFileSync(cargoPath, newCargoContent, 'utf8');
  if (newChangelogContent) fs.writeFileSync(changelogPath, newChangelogContent, 'utf8');

  // Verify post-condition
  const postCheck = validateVersions(rootDir);
  if (!postCheck.valid) {
    throw new Error(`Post-bump verification failed:\n${postCheck.errors.join('\n')}`);
  }

  return {
    success: true,
    dryRun: false,
    currentVersion,
    nextVersion,
    changes: changes.map(c => c.name),
  };
}

// CLI execution
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Usage:
  node scripts/version-bump.mjs <patch|minor|major|prerelease|x.y.z> [options]

Options:
  --dry-run       Preview changes without modifying files
  --force         Bypass initial sync check
  --skip-git      Skip git tag existence check
`);
    process.exit(0);
  }

  const bumpArg = args[0];
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  const skipGit = args.includes('--skip-git');

  try {
    const result = bumpVersions(bumpArg, { dryRun, force, skipGitCheck: skipGit });
    console.log(`\n========================================`);
    console.log(`Version Bump Result: ${result.currentVersion} -> v${result.nextVersion}`);
    if (result.dryRun) {
      console.log(`[DRY-RUN] No files were modified.`);
    } else {
      console.log(`[UPDATED] Files synchronized:`);
    }
    for (const c of result.changes) {
      console.log(`  + ${c}`);
    }
    console.log(`========================================\n`);
  } catch (err) {
    console.error(`\n[version:bump] ERROR:`, err.message);
    process.exit(1);
  }
}
