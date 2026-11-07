#!/usr/bin/env node
/**
 * scripts/generate-update-manifest.mjs
 * Consolidates multi-platform updater archives into a unified Tauri 2 `latest.json` manifest.
 *
 * Scans a release directory for updater archives (.zip, .tar.gz) and their matching .sig files:
 * - windows-x86_64 (.nsis.zip / .msi.zip)
 * - linux-x86_64 (.AppImage.tar.gz)
 * - darwin-aarch64 (.app.tar.gz on Apple Silicon)
 * - darwin-x86_64 (.app.tar.gz on Intel)
 *
 * Usage:
 *   node scripts/generate-update-manifest.mjs <artifacts-dir> --version 0.1.0 --tag v0.1.0 --repo sanjay-m6/Infinity-Researcher [--output latest.json]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function buildTauriUpdaterManifest(options) {
  const {
    artifactsDir,
    version,
    tag,
    repo = 'sanjay-m6/Infinity-Researcher',
    notes = 'Bug fixes and performance improvements.',
    pubDate = new Date().toISOString()
  } = options;

  if (!fs.existsSync(artifactsDir)) {
    throw new Error(`Artifacts directory does not exist: ${artifactsDir}`);
  }

  const files = fs.readdirSync(artifactsDir);
  const platforms = {};

  const baseUrl = `https://github.com/${repo}/releases/download/${tag}`;

  for (const file of files) {
    if (!file.endsWith('.sig')) continue;

    const baseAsset = file.slice(0, -4); // remove .sig
    const assetPath = path.join(artifactsDir, baseAsset);
    if (!fs.existsSync(assetPath)) continue;

    const sigPath = path.join(artifactsDir, file);
    const signature = fs.readFileSync(sigPath, 'utf8').trim();
    const url = `${baseUrl}/${encodeURIComponent(baseAsset)}`;

    const lower = baseAsset.toLowerCase();

    // Windows detection
    if (lower.includes('windows') || lower.includes('nsis') || lower.includes('.msi.zip') || lower.includes('x64-setup')) {
      if (lower.includes('arm64') || lower.includes('aarch64')) {
        platforms['windows-aarch64'] = { signature, url };
      } else {
        platforms['windows-x86_64'] = { signature, url };
      }
    }
    // macOS detection
    else if (lower.includes('darwin') || lower.includes('.app.tar.gz') || lower.includes('macos')) {
      if (lower.includes('aarch64') || lower.includes('arm64') || lower.includes('applesilicon')) {
        platforms['darwin-aarch64'] = { signature, url };
      } else {
        platforms['darwin-x86_64'] = { signature, url };
      }
    }
    // Linux detection
    else if (lower.includes('linux') || lower.includes('appimage.tar.gz')) {
      if (lower.includes('aarch64') || lower.includes('arm64')) {
        platforms['linux-aarch64'] = { signature, url };
      } else {
        platforms['linux-x86_64'] = { signature, url };
      }
    }
  }

  // Fallback: If no .sig files were present, populate platforms with the installer packages
  if (Object.keys(platforms).length === 0) {
    for (const file of files) {
      const lower = file.toLowerCase();
      const url = `${baseUrl}/${encodeURIComponent(file)}`;
      if (lower.endsWith('.exe') || lower.endsWith('.msi')) {
        if (!platforms['windows-x86_64']) {
          platforms['windows-x86_64'] = { signature: '', url };
        }
      } else if (lower.endsWith('.dmg') || lower.endsWith('.app.tar.gz')) {
        if (lower.includes('aarch64') || lower.includes('arm64')) {
          if (!platforms['darwin-aarch64']) platforms['darwin-aarch64'] = { signature: '', url };
        } else {
          if (!platforms['darwin-x86_64']) platforms['darwin-x86_64'] = { signature: '', url };
        }
      } else if (lower.endsWith('.appimage') || lower.endsWith('.deb')) {
        if (!platforms['linux-x86_64']) platforms['linux-x86_64'] = { signature: '', url };
      }
    }
  }

  return {
    version: tag.startsWith('v') ? tag : `v${version}`,
    notes,
    pub_date: pubDate,
    platforms
  };
}

// CLI execution
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const args = process.argv.slice(2);
  let artifactsDir = args[0] && !args[0].startsWith('--') ? path.resolve(args[0]) : null;
  let version = '0.1.0';
  let tag = 'v0.1.0';
  let repo = 'sanjay-m6/Infinity-Researcher';
  let notes = 'Bug fixes and performance improvements.';
  let output = 'latest.json';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--version' && args[i + 1]) {
      version = args[i + 1];
      if (!args.includes('--tag')) {
        tag = version.startsWith('v') ? version : `v${version}`;
      }
      i++;
    } else if (args[i] === '--tag' && args[i + 1]) {
      tag = args[i + 1];
      i++;
    } else if (args[i] === '--repo' && args[i + 1]) {
      repo = args[i + 1];
      i++;
    } else if (args[i] === '--notes' && args[i + 1]) {
      notes = args[i + 1];
      i++;
    } else if (args[i] === '--notes-file' && args[i + 1]) {
      const notesFilePath = path.resolve(args[i + 1]);
      if (fs.existsSync(notesFilePath)) {
        notes = fs.readFileSync(notesFilePath, 'utf8').trim();
      }
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      output = args[i + 1];
      i++;
    }
  }

  if (!artifactsDir) {
    console.error('Usage: node scripts/generate-update-manifest.mjs <artifacts-dir> --version 0.1.0 --tag v0.1.0 [--output latest.json]');
    process.exit(1);
  }

  try {
    const manifest = buildTauriUpdaterManifest({ artifactsDir, version, tag, repo, notes });
    // If output is a relative path, resolve it relative to cwd, NOT artifactsDir.
    // Ensure parent directories exist before writing.
    const outPath = path.resolve(output);
    const parentDir = path.dirname(outPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    console.log(`✓ [updater] Generated Tauri v2 updater manifest: ${outPath}`);
    console.log(`   Configured platforms (${Object.keys(manifest.platforms).length}): ${Object.keys(manifest.platforms).join(', ')}`);
    process.exit(0);
  } catch (err) {
    console.error(`[generate-update-manifest] Error: ${err.message}`);
    process.exit(1);
  }
}

