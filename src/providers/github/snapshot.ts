/**
 * GitHub Copilot CLI snapshot utilities
 * Handles reading, writing, and analyzing GitHub Copilot profile files
 */

import { existsSync, mkdirSync, readdirSync, statSync, readFileSync, writeFileSync, rmSync, cpSync } from 'fs';
import { join, dirname, sep } from 'path';
import type { ProfileMetadata } from '../../types/index.js';
import { GITHUB_SAFE_INCLUDES, GITHUB_EXCLUDES } from './constants.js';
import { execSync } from 'child_process';

/**
 * Get list of files to archive from a .github directory.
 * Only includes copilot-instructions.md, skills/, and agents/.
 */
export function getFilesToArchive(githubDir: string): string[] {
  const files: string[] = [];

  function isAllowed(name: string, relPath: string): boolean {
    const normalized = relPath.split(sep).join('/');
    for (const pattern of GITHUB_SAFE_INCLUDES) {
      if (pattern.endsWith('/**')) {
        const dir = pattern.slice(0, -3);
        if (normalized.startsWith(dir + '/') || normalized === dir) return true;
      } else if (name === pattern || normalized === pattern) {
        return true;
      }
    }
    return false;
  }

  function shouldExclude(name: string): boolean {
    for (const pattern of GITHUB_EXCLUDES) {
      if (pattern.startsWith('*.')) {
        if (name.endsWith(pattern.slice(1))) return true;
      } else if (name === pattern) {
        return true;
      } else if (pattern.endsWith('*') && name.startsWith(pattern.slice(0, -1))) {
        return true;
      }
    }
    return false;
  }

  function walk(currentDir: string, relativePath = '') {
    if (!existsSync(currentDir)) return;

    for (const entry of readdirSync(currentDir)) {
      const fullPath = join(currentDir, entry);
      const relPath = relativePath ? join(relativePath, entry) : entry;

      if (!isAllowed(entry, relPath)) continue;
      if (shouldExclude(entry)) continue;

      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath, relPath);
      } else {
        files.push(relPath.split(sep).join('/'));
      }
    }
  }

  walk(githubDir);
  return files;
}

/**
 * Derive a structured contents summary from a list of file paths.
 */
export function deriveContents(files: string[]): Record<string, string[]> {
  const contents: Record<string, string[]> = {};

  for (const file of files) {
    const normalized = file.split(sep).join('/');

    if (normalized === 'copilot-instructions.md') {
      if (!contents.instructions) contents.instructions = [];
      contents.instructions.push('copilot-instructions.md');
      continue;
    }

    if (normalized === 'mcp-config.json') {
      if (!contents.mcp) contents.mcp = [];
      contents.mcp.push('mcp-config.json');
      continue;
    }

    const parts = normalized.split('/');
    if (parts.length >= 2) {
      const category = parts[0]; // 'skills', 'agents', or 'instructions'
      const itemName = parts[1].replace(/\.[^.]+$/, '');
      if (!contents[category]) contents[category] = [];
      if (!contents[category].includes(itemName)) {
        contents[category].push(itemName);
      }
    }
  }

  return contents;
}

/**
 * Create a snapshot of a .github directory's copilot files
 */
export async function createSnapshot(
  githubDir: string,
  profileDir: string,
  profileName: string,
  options: { description?: string; tags?: string }
): Promise<ProfileMetadata> {
  if (!existsSync(githubDir)) {
    throw new Error(`GitHub directory not found: ${githubDir}`);
  }

  if (existsSync(profileDir)) {
    throw new Error(`Profile "${profileName}" already exists. Use a different name or delete the existing one.`);
  }

  mkdirSync(profileDir, { recursive: true });

  const metadata: ProfileMetadata = {
    name: profileName,
    provider: 'github',
    version: '1.0.0',
    description: options.description || '',
    tags: options.tags ? options.tags.split(',').map(t => t.trim()) : [],
    createdAt: new Date().toISOString(),
    platform: process.platform,
    files: [],
    cliVersion: await getCopilotCliVersion()
  };

  const files = getFilesToArchive(githubDir);
  metadata.files = files;

  for (const file of files) {
    const srcPath = join(githubDir, file);
    const destPath = join(profileDir, file);
    mkdirSync(dirname(destPath), { recursive: true });
    writeFileSync(destPath, readFileSync(srcPath));
  }

  metadata.contents = deriveContents(metadata.files);
  writeFileSync(join(profileDir, 'profile.json'), JSON.stringify(metadata, null, 2));

  return metadata;
}

/**
 * Extract a profile into the GitHub Copilot config directory directly,
 * replacing its content (mirrors how Claude profiles replace .claude/).
 */
export async function extractSnapshot(
  profileDir: string,
  githubDir: string,
  backupDir?: string
): Promise<void> {
  if (!existsSync(profileDir) || !existsSync(join(profileDir, 'profile.json'))) {
    throw new Error('Profile not found or corrupted');
  }

  if (backupDir && existsSync(githubDir)) {
    cpSync(githubDir, backupDir, { recursive: true });
  }

  mkdirSync(githubDir, { recursive: true });
  cleanProfileDir(githubDir);
  copyProfileFiles(profileDir, githubDir);
}

/**
 * Remove existing copilot content from a profile directory.
 */
export function cleanProfileDir(dir: string): void {
  for (const entry of ['skills', 'agents', 'instructions', 'copilot-instructions.md', 'mcp-config.json']) {
    const p = join(dir, entry);
    if (existsSync(p)) {
      rmSync(p, { recursive: true, force: true });
    }
  }
}

function copyProfileFiles(srcDir: string, destDir: string): void {
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.name === 'profile.json') continue;

    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);

    if (entry.isDirectory()) {
      mkdirSync(destPath, { recursive: true });
      copyDirMerge(srcPath, destPath);
    } else {
      writeFileSync(destPath, readFileSync(srcPath));
    }
  }
}

function copyDirMerge(src: string, dest: string): void {
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      mkdirSync(destPath, { recursive: true });
      copyDirMerge(srcPath, destPath);
    } else {
      writeFileSync(destPath, readFileSync(srcPath));
    }
  }
}

/**
 * Get Copilot CLI version if installed
 */
export async function getCopilotCliVersion(): Promise<string> {
  try {
    const version = execSync('gh --version', { encoding: 'utf-8' }).trim().split('\n')[0];
    return version;
  } catch {
    return 'unknown';
  }
}

/**
 * Read profile metadata
 */
export function readProfileMetadata(profileDir: string): ProfileMetadata | null {
  const p = join(profileDir, 'profile.json');
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf-8'));
}
