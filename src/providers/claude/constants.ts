/**
 * Claude Code CLI specific constants
 */

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
  // Claude Code plugin infrastructure -- present in every install,
  // not user-authored content. Excluded from snapshots and preserved
  // during profile installs (cleanProfileContent).
  'plugins/blocklist.json',
  'plugins/cache',
  'plugins/install-counts-cache.json',
  'plugins/installed_plugins.json',
  'plugins/known_marketplaces.json',
  'plugins/marketplaces'
];

// Plugin subdirectories that are Claude Code infrastructure.
// These must be preserved when cleaning profile content.
export const PLUGIN_INFRA_DIRS = [
  'blocklist.json',
  'cache',
  'install-counts-cache.json',
  'installed_plugins.json',
  'known_marketplaces.json',
  'marketplaces'
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
  'agents/**'
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
