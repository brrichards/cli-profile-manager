/**
 * GitHub Copilot CLI provider constants
 */

// Files/patterns to exclude (secrets, caches, generated files)
export const GITHUB_EXCLUDES = [
  '.credentials',
  '.auth',
  '*.key',
  '*.pem',
  '*.secret',
  'oauth_token*',
  '.cache',
  'node_modules',
  '.git',
];

// Items allowed at the root of a .github directory for a GitHub Copilot profile
export const GITHUB_SAFE_INCLUDES = [
  'copilot-instructions.md',
  'skills',
  'skills/**',
  'agents',
  'agents/**',
  'instructions',
  'instructions/**',
  'mcp-config.json'
];

// Subdirectories that are part of a profile
export const GITHUB_SAFE_DIRS = ['skills', 'agents', 'instructions'];

// Display labels for content categories
export const CATEGORY_LABELS: Record<string, string> = {
  skills: 'Skills',
  agents: 'Agents',
  instructions: 'Instructions',
  mcp: 'MCP Servers',
  mcp_servers: 'MCP Servers',
};

export const GITHUB_PROFILES_PATH = 'profiles/github';
