/**
 * Claude Code CLI specific constants
 */

// Plugin subdirectories that are Claude Code infrastructure.
// These must be preserved when cleaning profile content and
// excluded from snapshots (via CLAUDE_EXCLUDES).
export const PLUGIN_INFRA_DIRS = [
  'blocklist.json',
  'cache',
  'install-counts-cache.json',
  'installed_plugins.json',
  'known_marketplaces.json',
  'marketplaces',
  'cpm_installed_plugins.json'
];

// Files/patterns to exclude by default (secrets, caches, infra)
export const CLAUDE_EXCLUDES = [
  '.credentials',
  '.auth',
  '*.key',
  '*.pem',
  '*.secret',
  'oauth_token*',
  '.cache',
  'node_modules',
  '.git',
  ...PLUGIN_INFRA_DIRS.map(d => `plugins/${d}`)
];

// Files that are safe to include (functional customizations only)
export const SAFE_INCLUDES = [
  'CLAUDE.md',
  'commands',
  'commands/**',
  'skills',
  'skills/**',
  'hooks',
  'hooks/**',
  'plugins',
  'plugins/**',
  'mcp.json',
  'mcp_servers',
  'mcp_servers/**',
  'agents',
  'agents/**',
  'settings.json'
];

// Display labels for content categories
export const CATEGORY_LABELS: Record<string, string> = {
  commands: 'Commands',
  skills: 'Skills',
  mcp: 'MCP Servers',
  mcp_servers: 'MCP Servers',
  agents: 'Agents',
  plugins: 'Plugins',
  hooks: 'Hooks',
  instructions: 'Instructions'
};

export const CLAUDE_PROFILES_PATH = 'profiles/claude';
