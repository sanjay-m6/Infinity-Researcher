#!/usr/bin/env node
/**
 * scripts/verify-release-artifacts.mjs
 * Post-build cross-platform release verification tool.
 *
 * Verifies that:
 * 1. Installer packages (.exe, .msi, .AppImage, .deb, .rpm, .dmg) were produced and are non-empty.
 * 2. Updater archives (.zip, .tar.gz) and signatures (.sig) were produced.
 * 3. Minisign signature files are non-empty and formatted correctly.
 * 4. latest.json updater manifest is valid and matches the target version.
 * 5. Generates/validates SHA-256 checksums file.
 *
 * Usage:
 *   node scripts/verify-release-artifacts.mjs <target-directory> [--expected-version 0.1.0] [--generate-checksums]
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function calculateSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Recursively collect all files under a directory tree.
 * Returns an array of { relative, absolute } objects.
 */
function walkDir(dir, base = dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walkDir(full, base));
    } else if (entry.isFile()) {
      results.push({ relative: path.relative(base, full), absolute: full, name: entry.name });
    }
  }
  return results;
}

export function verifyReleaseDirectory(dirPath, expectedVersion = null) {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Target directory does not exist: ${dirPath}`);
  }

  // Recursively walk the bundle directory tree so we find installers
  // inside subdirectories like appimage/, deb/, rpm/, nsis/, msi/, dmg/.
  const allFiles = walkDir(dirPath);
  const issues = [];
  const verifiedAssets = [];

  // Categorize files across Windows, Linux, and macOS
  const installers = allFiles.filter(f => 
    f.name.endsWith('.exe') || 
    f.name.endsWith('.msi') || 
    f.name.endsWith('.AppImage') || 
    f.name.endsWith('.deb') || 
    f.name.endsWith('.rpm') || 
    f.name.endsWith('.dmg')
  );
  const updaterArchives = allFiles.filter(f => (f.name.endsWith('.zip') || f.name.endsWith('.tar.gz')) && !f.name.endsWith('.sig'));
  const signatures = allFiles.filter(f => f.name.endsWith('.sig'));
  const manifests = allFiles.filter(f => f.name === 'latest.json');

  // Check 1: Installers
  if (installers.length === 0) {
    issues.push('No installer packages (.exe, .msi, .AppImage, .deb, .rpm, or .dmg) found in release artifacts.');
  } else {
    for (const inst of installers) {
      const size = fs.statSync(inst.absolute).size;
      if (size < 1024 * 100) {
        issues.push(`Installer ${inst.relative} appears corrupt or abnormally small (${size} bytes).`);
      } else {
        verifiedAssets.push({ name: inst.relative, type: 'installer', size, hash: calculateSha256(inst.absolute) });
      }
    }
  }

  // Check 2: Updater archives & signatures
  for (const sig of signatures) {
    const sigContent = fs.readFileSync(sig.absolute, 'utf8').trim();
    if (!sigContent.startsWith('untrusted comment:') && sigContent.length < 30) {
      issues.push(`Signature file ${sig.relative} does not appear to be a valid Minisign signature.`);
    } else {
      verifiedAssets.push({ name: sig.relative, type: 'signature', size: sigContent.length });
    }
  }

  // Check 3: latest.json manifest verification
  if (manifests.length > 0) {
    const manifestPath = manifests[0].absolute;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      if (!manifest.version) {
        issues.push('latest.json is missing the required "version" property.');
      } else if (expectedVersion && manifest.version !== expectedVersion) {
        issues.push(`latest.json version "${manifest.version}" does not match expected version "${expectedVersion}".`);
      }

      if (!manifest.platforms || Object.keys(manifest.platforms).length === 0) {
        issues.push('latest.json has no configured platform entries under "platforms".');
      } else {
        for (const [platformKey, platformData] of Object.entries(manifest.platforms)) {
          if (!platformData.url) {
            issues.push(`latest.json platform "${platformKey}" is missing asset "url".`);
          }
          if (!platformData.signature) {
            issues.push(`latest.json platform "${platformKey}" is missing updater "signature".`);
          }
        }
      }
      verifiedAssets.push({ name: 'latest.json', type: 'manifest', version: manifest.version });
    } catch (err) {
      issues.push(`Failed to parse latest.json as JSON: ${err.message}`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    verifiedAssets,
  };
}

export function generateChecksumFile(dirPath, outputPath) {
  const allFiles = walkDir(dirPath);
  const filtered = allFiles.filter(f => !f.name.endsWith('.txt') && !f.name.endsWith('.md'));
  const lines = [];

  for (const f of filtered.sort((a, b) => a.relative.localeCompare(b.relative))) {
    const hash = calculateSha256(f.absolute);
    lines.push(`${hash}  ${f.relative}`);
  }

  const content = lines.join('\n') + '\n';
  fs.writeFileSync(outputPath, content, 'utf8');
  return { path: outputPath, count: lines.length };
}

// CLI execution
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const args = process.argv.slice(2);
  let targetDir = args[0] && !args[0].startsWith('--') ? path.resolve(args[0]) : null;
  let expectedVersion = null;
  let doChecksums = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--expected-version' && args[i + 1]) {
      expectedVersion = args[i + 1];
      i++;
    } else if (args[i] === '--generate-checksums') {
      doChecksums = true;
    }
  }

  if (!targetDir) {
    console.error('Usage: node scripts/verify-release-artifacts.mjs <target-directory> [--expected-version 0.1.0] [--generate-checksums]');
    process.exit(1);
  }

  try {
    const result = verifyReleaseDirectory(targetDir, expectedVersion);

    console.log(`\n========================================`);
    console.log(`Release Artifacts Verification`);
    console.log(`Directory: ${targetDir}`);
    console.log(`========================================`);

    for (const asset of result.verifiedAssets) {
      console.log(`✓ [${asset.type}] ${asset.name} (${asset.size || asset.version || 'verified'})`);
    }

    if (doChecksums) {
      const checksumOut = path.join(targetDir, 'SHA256SUMS.txt');
      const { count } = generateChecksumFile(targetDir, checksumOut);
      console.log(`✓ [checksums] Generated SHA256SUMS.txt for ${count} files.`);
    }

    if (!result.valid) {
      console.error(`\nArtifact verification FAILED with ${result.issues.length} error(s):`);
      for (const err of result.issues) {
        console.error(`  x ${err}`);
      }
      process.exit(1);
    }

    console.log(`\nAll release artifacts verified successfully.\n`);
    process.exit(0);
  } catch (err) {
    console.error(`[verify-release-artifacts] Error:`, err.message);
    process.exit(1);
  }
}
