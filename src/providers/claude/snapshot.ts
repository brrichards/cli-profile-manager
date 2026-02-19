/**
 * Claude Code CLI snapshot utilities
 * Handles reading, writing, and analyzing Claude profile files
 */

import { existsSync, mkdirSync, readdirSync, statSync, readFileSync, writeFileSync, rmSync, cpSync } from 'fs';
import { join, dirname, sep } from 'path';
import { execSync } from 'child_process';
import type { ProfileMetadata } from '../../types/index.js';
import { SAFE_INCLUDES, CLAUDE_EXCLUDES, PLUGIN_INFRA_DIRS } from './constants.js';

/**
 * Get list of files to archive (using allowlist approach)
 */
export function getFilesToArchive(claudeDir: string, includeSecrets = false): string[] {
  const files: string[] = [];
  const excludes = includeSecrets ? [] : CLAUDE_EXCLUDES;

  function walk(currentDir: string, relativePath = '') {
    const entries = readdirSync(currentDir);

    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      const relPath = relativePath ? join(relativePath, entry) : entry;

      if (!isAllowed(entry, relPath)) {
        continue;
      }

      if (shouldExclude(entry, relPath, excludes)) {
        continue;
      }

      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath, relPath);
      } else {
        // Always use forward slashes for portable metadata
        files.push(relPath.split(sep).join('/'));
      }
    }
  }

  walk(claudeDir);
  return files;
}

/**
 * Check if a file/folder is in the allowlist
 */
function isAllowed(name: string, path: string): boolean {
  const normalizedPath = path.split(sep).join('/');

  for (const pattern of SAFE_INCLUDES) {
    if (pattern.endsWith('/**')) {
      const dirName = pattern.slice(0, -3);
      if (normalizedPath.startsWith(dirName + '/') || normalizedPath === dirName) {
        return true;
      }
    } else if (name === pattern || normalizedPath === pattern) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a file/folder should be excluded
 */
function shouldExclude(name: string, path: string, excludes: string[]): boolean {
  const normalizedPath = path.split(sep).join('/');
  for (const pattern of excludes) {
    if (pattern.startsWith('*.')) {
      const ext = pattern.slice(1);
      if (name.endsWith(ext)) return true;
    } else if (name === pattern || normalizedPath === pattern) {
      return true;
    } else if (pattern.endsWith('*') && name.startsWith(pattern.slice(0, -1))) {
      return true;
    }
  }
  return false;
}

/**
 * Derive a structured contents summary from a list of file paths.
 * Returns an object with category keys mapping to arrays of item names.
 */
export function deriveContents(files: string[]): Record<string, string[]> {
  const contents: Record<string, string[]> = {};

  for (const file of files) {
    const normalized = file.split(sep).join('/');

    if (normalized === 'CLAUDE.md') {
      if (!contents.instructions) contents.instructions = [];
      contents.instructions.push('CLAUDE.md');
      continue;
    }

    if (normalized === 'mcp.json') {
      if (!contents.mcp) contents.mcp = [];
      contents.mcp.push('mcp.json');
      continue;
    }

    const parts = normalized.split('/');
    if (parts.length >= 2) {
      const category = parts[0];
      const itemName = parts[1].replace(/\.[^.]+$/, ''); // strip extension
      if (!contents[category]) contents[category] = [];
      if (!contents[category].includes(itemName)) {
        contents[category].push(itemName);
      }
    }
  }

  return contents;
}

/**
 * Derive contents and try to enrich MCP server names from the actual mcp.json file
 */
export function deriveContentsWithMcp(files: string[], claudeDir: string): Record<string, string[]> {
  const contents = deriveContents(files);

  if (contents.mcp && claudeDir) {
    try {
      const mcpPath = join(claudeDir, 'mcp.json');
      if (existsSync(mcpPath)) {
        const mcpData = JSON.parse(readFileSync(mcpPath, 'utf-8'));
        const serverNames = Object.keys(mcpData.mcpServers || mcpData);
        if (serverNames.length > 0) {
          contents.mcp = serverNames;
        }
      }
    } catch {
      // Keep the fallback
    }
  }

  return contents;
}

/**
 * Get Claude CLI version if installed
 */
export async function getClaudeVersion(): Promise<string> {
  try {
    const version = execSync('claude --version', { encoding: 'utf-8' }).trim();
    return version;
  } catch {
    return 'unknown';
  }
}

/**
 * Create a snapshot of the .claude folder
 */
export async function createSnapshot(
  claudeDir: string,
  profileDir: string,
  profileName: string,
  options: { description?: string; tags?: string; includeSecrets?: boolean }
): Promise<ProfileMetadata> {
  if (!existsSync(claudeDir)) {
    throw new Error(`Claude directory not found: ${claudeDir}`);
  }

  // Create profile directory
  if (existsSync(profileDir)) {
    throw new Error(`Profile "${profileName}" already exists. Use a different name or delete the existing one.`);
  }

  mkdirSync(profileDir, { recursive: true });

  const metadataPath = join(profileDir, 'profile.json');

  // Create metadata
  const metadata: ProfileMetadata = {
    name: profileName,
    provider: 'claude',
    version: '1.0.0',
    description: options.description || '',
    tags: options.tags ? options.tags.split(',').map(t => t.trim()) : [],
    createdAt: new Date().toISOString(),
    cliVersion: await getClaudeVersion(),
    platform: process.platform,
    includesSecrets: options.includeSecrets || false,
    files: []
  };

  // Get list of files to include
  const files = getFilesToArchive(claudeDir, options.includeSecrets);
  metadata.files = files;

  // Copy each file into the profile directory
  for (const file of files) {
    const srcPath = join(claudeDir, file);
    const destPath = join(profileDir, file);

    // Ensure parent directory exists
    mkdirSync(dirname(destPath), { recursive: true });

    const content = readFileSync(srcPath);
    writeFileSync(destPath, content);
  }

  // Derive structured contents from file list
  metadata.contents = deriveContentsWithMcp(metadata.files, claudeDir);

  // Save metadata
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  return metadata;
}

/**
 * Extract a profile to the .claude folder by copying files directly.
 * Uses a merge strategy to work even when Claude Code is running.
 */
export async function extractSnapshot(
  profileDir: string,
  claudeDir: string,
  backupDir?: string
): Promise<void> {
  if (!existsSync(profileDir) || !existsSync(join(profileDir, 'profile.json'))) {
    throw new Error(`Profile not found or corrupted`);
  }

  // Backup existing .claude if requested
  if (backupDir && existsSync(claudeDir)) {
    cpSync(claudeDir, backupDir, { recursive: true });
  }

  // Ensure .claude directory exists
  mkdirSync(claudeDir, { recursive: true });

  // Clean out old profile content before installing new files
  cleanProfileContent(claudeDir);

  // Copy profile files (excluding profile.json) into .claude
  copyProfileFiles(profileDir, claudeDir);
}

/**
 * Remove existing profile content from a .claude directory.
 * Only removes items in the SAFE_INCLUDES allowlist (commands/, hooks/, etc.)
 * so non-profile files (settings, credentials) are preserved.
 */
export function cleanProfileContent(claudeDir: string): void {
  // Directories to wipe entirely
  const contentDirs = ['commands', 'skills', 'hooks', 'mcp_servers', 'agents'];
  for (const dir of contentDirs) {
    const dirPath = join(claudeDir, dir);
    if (existsSync(dirPath)) {
      rmSync(dirPath, { recursive: true, force: true });
    }
  }

  // Plugins: only remove user-authored content, preserve Claude Code infra
  const pluginsDir = join(claudeDir, 'plugins');
  if (existsSync(pluginsDir)) {
    for (const entry of readdirSync(pluginsDir)) {
      if (!PLUGIN_INFRA_DIRS.includes(entry)) {
        rmSync(join(pluginsDir, entry), { recursive: true, force: true });
      }
    }
  }

  // Individual files to remove
  const contentFiles = ['CLAUDE.md', 'mcp.json'];
  for (const file of contentFiles) {
    const filePath = join(claudeDir, file);
    if (existsSync(filePath)) {
      rmSync(filePath, { force: true });
    }
  }
}

/**
 * Copy profile content files (not profile.json) from source to destination.
 */
function copyProfileFiles(srcDir: string, destDir: string): void {
  const entries = readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    // Skip profile.json -- it's metadata, not a profile file
    if (entry.name === 'profile.json') continue;

    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);

    if (entry.isDirectory()) {
      mkdirSync(destPath, { recursive: true });
      copyDirMerge(srcPath, destPath);
    } else {
      try {
        const content = readFileSync(srcPath);
        writeFileSync(destPath, content);
      } catch (err: any) {
        if (err.code === 'EBUSY') {
          throw new Error(`Cannot write to ${entry.name} - file is locked. Please close Claude Code and try again.`);
        }
        throw err;
      }
    }
  }
}

/**
 * Recursively copy/merge directory contents, overwriting files.
 * This works even when the target directory has open file handles.
 */
function copyDirMerge(src: string, dest: string): void {
  const entries = readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      mkdirSync(destPath, { recursive: true });
      copyDirMerge(srcPath, destPath);
    } else {
      try {
        const content = readFileSync(srcPath);
        writeFileSync(destPath, content);
      } catch (err: any) {
        if (err.code === 'EBUSY') {
          throw new Error(`Cannot write to ${entry.name} - file is locked. Please close Claude Code and try again.`);
        }
        throw err;
      }
    }
  }
}

/**
 * Read profile metadata
 */
export function readProfileMetadata(profileDir: string): ProfileMetadata | null {
  const metadataPath = join(profileDir, 'profile.json');

  if (!existsSync(metadataPath)) {
    return null;
  }

  return JSON.parse(readFileSync(metadataPath, 'utf-8'));
}
