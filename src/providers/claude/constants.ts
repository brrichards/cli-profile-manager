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
  'plugins/cache',
  'plugins/install-counts-cache',
  'plugins/installed_plugins',
  'plugins/known_marketplaces',
  'plugins/marketplaces'
];

// Plugin subdirectories that are Claude Code infrastructure.
// These must be preserved when cleaning profile content.
export const PLUGIN_INFRA_DIRS = [
  'cache',
  'install-counts-cache',
  'installed_plugins',
  'known_marketplaces',
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
