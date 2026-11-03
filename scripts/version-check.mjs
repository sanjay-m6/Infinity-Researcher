#!/usr/bin/env node
/**
 * scripts/version-check.mjs
 * Validates that package.json, src-tauri/tauri.conf.json, and src-tauri/Cargo.toml
 * have strictly matching SemVer versions.
 *
 * Can also validate a git tag (e.g. --tag v0.1.0) or GITHUB_REF_NAME against the files.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const SEMVER_REGEX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

export function getProjectVersions(rootDir = ROOT_DIR) {
  // 1. package.json
  const pkgPath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    throw new Error(`package.json not found at ${pkgPath}`);
  }
  const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const pkgVersion = pkgJson.version;

  // 2. src-tauri/tauri.conf.json
  const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
  if (!fs.existsSync(tauriConfPath)) {
    throw new Error(`tauri.conf.json not found at ${tauriConfPath}`);
  }
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  const tauriVersion = tauriConf.version;

  // 3. src-tauri/Cargo.toml
  const cargoPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
  if (!fs.existsSync(cargoPath)) {
    throw new Error(`Cargo.toml not found at ${cargoPath}`);
  }
  const cargoContent = fs.readFileSync(cargoPath, 'utf8');
  // Match version = "..." specifically in [package] section
  const packageMatch = cargoContent.match(/\[package\][^\[]*?version\s*=\s*"([^"]+)"/s);
  if (!packageMatch || !packageMatch[1]) {
    throw new Error(`Could not find package version in ${cargoPath}`);
  }
  const cargoVersion = packageMatch[1];

  return {
    packageJson: { version: pkgVersion, path: pkgPath },
    tauriConf: { version: tauriVersion, path: tauriConfPath },
    cargoToml: { version: cargoVersion, path: cargoPath },
  };
}

export function validateVersions(rootDir = ROOT_DIR, expectedTag = null) {
  const versions = getProjectVersions(rootDir);
  const errors = [];

  const { packageJson, tauriConf, cargoToml } = versions;

  // Check SemVer validity
  if (!SEMVER_REGEX.test(packageJson.version)) {
    errors.push(`package.json version "${packageJson.version}" is not a valid Semantic Version.`);
  }
  if (!SEMVER_REGEX.test(tauriConf.version)) {
    errors.push(`tauri.conf.json version "${tauriConf.version}" is not a valid Semantic Version.`);
  }
  if (!SEMVER_REGEX.test(cargoToml.version)) {
    errors.push(`Cargo.toml version "${cargoToml.version}" is not a valid Semantic Version.`);
  }

  // Check synchronization
  if (packageJson.version !== tauriConf.version) {
    errors.push(
      `Version mismatch: package.json (${packageJson.version}) !== tauri.conf.json (${tauriConf.version})`
    );
  }
  if (packageJson.version !== cargoToml.version) {
    errors.push(
      `Version mismatch: package.json (${packageJson.version}) !== Cargo.toml (${cargoToml.version})`
    );
  }

  // Check tag if provided
  if (expectedTag) {
    const normalizedTag = expectedTag.startsWith('v') ? expectedTag.slice(1) : expectedTag;
    if (packageJson.version !== normalizedTag) {
      errors.push(
        `Tag mismatch: git tag "${expectedTag}" implies version "${normalizedTag}", but app version is "${packageJson.version}"`
      );
    }
  }

  return {
    valid: errors.length === 0,
    version: packageJson.version,
    versions,
    errors,
  };
}

// CLI execution
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const args = process.argv.slice(2);
  let tagArg = null;
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tag' && args[i + 1]) {
      tagArg = args[i + 1];
      i++;
    } else if (args[i].startsWith('--tag=')) {
      tagArg = args[i].split('=')[1];
    } else if (args[i] === '--json') {
      jsonOutput = true;
    }
  }

  // If no CLI tag provided, check GITHUB_REF_NAME in GitHub Actions
  if (!tagArg && process.env.GITHUB_REF_NAME && process.env.GITHUB_REF_TYPE === 'tag') {
    tagArg = process.env.GITHUB_REF_NAME;
  }

  try {
    const result = validateVersions(ROOT_DIR, tagArg);

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`[version:check] Auditing version synchronization...`);
      console.log(`  - package.json:       ${result.versions.packageJson.version}`);
      console.log(`  - tauri.conf.json:    ${result.versions.tauriConf.version}`);
      console.log(`  - Cargo.toml:         ${result.versions.cargoToml.version}`);

      if (tagArg) {
        console.log(`  - Git tag:            ${tagArg}`);
      }

      if (!result.valid) {
        console.error(`\n[version:check] FAILED with ${result.errors.length} error(s):`);
        for (const err of result.errors) {
          console.error(`  x ${err}`);
        }
        process.exit(1);
      }

      console.log(`\n[version:check] OK: All versions are synchronized at v${result.version}.`);
    }
    process.exit(0);
  } catch (err) {
    console.error(`[version:check] Unexpected error:`, err.message);
    process.exit(1);
  }
}
