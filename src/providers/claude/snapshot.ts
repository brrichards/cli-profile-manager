/**
 * Claude Code CLI snapshot utilities
 * Handles reading, writing, and analyzing Claude profile files
 */

import { existsSync, mkdirSync, readdirSync, statSync, readFileSync, writeFileSync, rmSync, cpSync } from 'fs';
import { join, dirname, resolve, sep } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';
import type { ProfileMetadata, PluginInfo } from '../../types/index.js';
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
 * Recursively collect files from a plugin's cache directory into the files list.
 */
function collectPluginFiles(pluginDir: string, relativePath: string, files: string[]): void {
  const entries = readdirSync(pluginDir);
  for (const entry of entries) {
    const fullPath = join(pluginDir, entry);
    const relPath = `${relativePath}/${entry}`;
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      collectPluginFiles(fullPath, relPath, files);
    } else {
      const normalized = relPath.split(sep).join('/');
      if (!files.includes(normalized)) {
        files.push(normalized);
      }
    }
  }
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

    if (normalized === 'settings.json') {
      if (!contents.settings) contents.settings = [];
      contents.settings.push('settings.json');
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

      // Skip plugin cache files — actual plugin info comes from metadata.plugins
      if (category === 'plugins' && itemName === 'cache') continue;

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

  // Discover installed plugins and include their cache files
  const plugins = readInstalledPlugins(claudeDir);
  if (plugins.length > 0) {
    metadata.plugins = plugins;
    for (const plugin of plugins) {
      const pluginDir = join(claudeDir, plugin.relativePath);
      if (existsSync(pluginDir)) {
        collectPluginFiles(pluginDir, plugin.relativePath, files);
      }
    }
  }

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

  // Replace CPM-managed plugins with those from the new profile
  const metadata = readProfileMetadata(profileDir);
  replaceCpmPlugins(claudeDir, metadata?.plugins || []);
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
  const contentFiles = ['CLAUDE.md', 'mcp.json', 'settings.json'];
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
 * Read installed plugins from a .claude directory.
 * Parses installed_plugins.json and returns portable plugin metadata.
 */
export function readInstalledPlugins(claudeDir: string): PluginInfo[] {
  const installedPath = join(claudeDir, 'plugins', 'installed_plugins.json');
  if (!existsSync(installedPath)) {
    return [];
  }

  try {
    const data = JSON.parse(readFileSync(installedPath, 'utf-8'));
    const plugins: PluginInfo[] = [];

    for (const [key, entries] of Object.entries(data.plugins || {})) {
      const lastAt = key.lastIndexOf('@');
      if (lastAt <= 0) continue;
      const name = key.substring(0, lastAt);
      const marketplace = key.substring(lastAt + 1);
      if (!marketplace || !Array.isArray(entries)) continue;

      for (const entry of entries as any[]) {
        const version = entry.version || '0.0.0';
        const relativePath = `plugins/cache/${marketplace}/${name}/${version}`;
        plugins.push({ name, marketplace, version, relativePath });
      }
    }

    return plugins;
  } catch {
    return [];
  }
}

/**
 * Resolve the global Claude Code config directory.
 * Respects CLAUDE_CONFIG_DIR env var, falls back to ~/.claude.
 */
export function getGlobalClaudeDir(): string {
  return process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
}

/**
 * Compare two semver version strings numerically.
 * Returns true if `existing` is strictly newer than `incoming`.
 * SYNC: duplicated in scripts/install-profile.mjs — keep both in sync.
 */
function isNewerVersion(existing: string | undefined, incoming: string): boolean {
  if (!existing) return false;
  const parse = (v: string) => v.split('.').map(Number);
  const [eM = 0, em = 0, ep = 0] = parse(existing);
  const [iM = 0, im = 0, ip = 0] = parse(incoming);
  if (eM !== iM) return eM > iM;
  if (em !== im) return em > im;
  return ep > ip;
}

/**
 * Check if a plugin's relativePath is unsafe (path traversal or outside plugins/cache/).
 */
function isUnsafePluginPath(relativePath: string): boolean {
  return !relativePath.startsWith('plugins/cache/') || relativePath.includes('..');
}

/**
 * Write the CPM plugin manifest to the global plugins directory.
 */
export function writeCpmManifest(keys: string[]): void {
  const globalDir = getGlobalClaudeDir();
  const manifestPath = join(globalDir, 'plugins', 'cpm_installed_plugins.json');
  mkdirSync(join(globalDir, 'plugins'), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify({ plugins: keys }, null, 2));
}

/**
 * Remove plugins previously installed by CPM from installed_plugins.json
 * and delete their cache directories. Uses the cpm_installed_plugins.json
 * manifest to distinguish CPM-installed plugins from user-installed ones.
 */
export function unregisterCpmPlugins(): void {
  const globalDir = getGlobalClaudeDir();
  const manifestPath = join(globalDir, 'plugins', 'cpm_installed_plugins.json');

  if (!existsSync(manifestPath)) return;

  let manifest: { plugins: string[] };
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  } catch {
    return;
  }

  if (!manifest.plugins || manifest.plugins.length === 0) return;

  const installedPath = join(globalDir, 'plugins', 'installed_plugins.json');
  if (!existsSync(installedPath)) {
    writeCpmManifest([]);
    return;
  }

  let installedData: any;
  try {
    installedData = JSON.parse(readFileSync(installedPath, 'utf-8'));
  } catch {
    writeCpmManifest([]);
    return;
  }

  if (!installedData.plugins) {
    writeCpmManifest([]);
    return;
  }

  const safePrefix = resolve(join(globalDir, 'plugins', 'cache')) + sep;
  for (const key of manifest.plugins) {
    const entries = installedData.plugins[key];
    if (Array.isArray(entries)) {
      for (const entry of entries) {
        if (entry.installPath && resolve(entry.installPath).startsWith(safePrefix)) {
          rmSync(entry.installPath, { recursive: true, force: true });
        }
      }
    }
    delete installedData.plugins[key];
  }

  writeFileSync(installedPath, JSON.stringify(installedData, null, 2));
  writeCpmManifest([]);
}

/**
 * Replace CPM-managed plugins: unregister old ones, register new ones.
 * If plugins is empty, just clears the manifest.
 */
export function replaceCpmPlugins(claudeDir: string, plugins: PluginInfo[]): void {
  unregisterCpmPlugins();
  if (plugins.length > 0) {
    registerPlugins(claudeDir, plugins);
  } else {
    writeCpmManifest([]);
  }
}

/**
 * Register plugins by copying plugin cache files to the global Claude home,
 * updating installed_plugins.json, and refreshing the CPM manifest.
 */
export function registerPlugins(claudeDir: string, plugins: PluginInfo[]): void {
  if (!plugins || plugins.length === 0) return;

  const globalDir = getGlobalClaudeDir();
  mkdirSync(join(globalDir, 'plugins'), { recursive: true });

  // Copy plugin cache files from profile target to global home
  for (const plugin of plugins) {
    if (isUnsafePluginPath(plugin.relativePath)) {
      continue;
    }
    const srcCacheDir = join(claudeDir, plugin.relativePath);
    const destCacheDir = join(globalDir, plugin.relativePath);
    if (existsSync(srcCacheDir) && srcCacheDir !== destCacheDir) {
      mkdirSync(destCacheDir, { recursive: true });
      cpSync(srcCacheDir, destCacheDir, { recursive: true });
    }
  }

  // Merge into global installed_plugins.json
  const installedPath = join(globalDir, 'plugins', 'installed_plugins.json');
  let installedData: any = { version: 2, plugins: {} };

  if (existsSync(installedPath)) {
    try {
      installedData = JSON.parse(readFileSync(installedPath, 'utf-8'));
    } catch {
      // Start fresh if corrupted
    }
  }

  const now = new Date().toISOString();
  const actuallyRegistered: string[] = [];
  for (const plugin of plugins) {
    // Validate relativePath is safe (must start with plugins/cache/ and contain no ..)
    if (isUnsafePluginPath(plugin.relativePath)) {
      continue;
    }
    const key = `${plugin.name}@${plugin.marketplace}`;
    // Skip if existing version is newer (compare numerically, not lexicographically)
    const existing = installedData.plugins[key];
    if (existing && Array.isArray(existing) && isNewerVersion(existing[0]?.version, plugin.version)) {
      continue;
    }
    const installPath = join(globalDir, plugin.relativePath);
    installedData.plugins[key] = [{
      scope: 'user',
      installPath,
      version: plugin.version,
      installedAt: now,
      lastUpdated: now
    }];
    actuallyRegistered.push(key);
  }

  writeFileSync(installedPath, JSON.stringify(installedData, null, 2));

  // Write the CPM manifest — only includes plugins actually registered (not version-skipped)
  writeCpmManifest(actuallyRegistered);
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
