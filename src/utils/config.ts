import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import type { CLIType } from '../types';

const HOME = homedir();
const BASE_DIR = join(HOME, '.cli-profiles');

/**
 * Path configuration for the application
 */
export const PATHS = {
  base: BASE_DIR,
  claude: join(BASE_DIR, 'claude'),
  github: join(BASE_DIR, 'github'),
  cache: join(BASE_DIR, '.cache'),
  config: join(BASE_DIR, 'config.json'),
};

/**
 * User configuration stored in config.json
 */
interface UserConfig {
  marketplaceRepo?: string;
  defaultProvider?: CLIType;
}

/**
 * Full application configuration
 */
export interface AppConfig extends UserConfig {
  profilesDir: string;
  claudeProfilesDir: string;
  githubProfilesDir: string;
  claudeDir: string;
  githubDir: string;
  cacheDir: string;
  configFile: string;
  marketplaceRepo: string;
  defaultProvider?: CLIType;
}

/**
 * Find Claude directory - checks project root first (codespaces), then home
 */
function findClaudeDir(): string {
  const candidates = [
    join(process.cwd(), '.claude'),
    join(HOME, '.claude'),
  ];

  for (const dir of candidates) {
    if (existsSync(dir)) {
      return dir;
    }
  }

  return join(HOME, '.claude');
}

/**
 * Find GitHub directory - checks project root first, then home
 * GitHub profiles will be stored in .github directory (similar to .claude)
 */
function findGitHubDir(): string {
  const candidates = [
    join(process.cwd(), '.github'),
    join(HOME, '.github'),
  ];

  for (const dir of candidates) {
    if (existsSync(dir)) {
      return dir;
    }
  }

  return join(HOME, '.github');
}

/**
 * Ensure required directories exist
 */
export function ensureDirs(): void {
  const dirs = [PATHS.base, PATHS.claude, PATHS.github, PATHS.cache];

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Get current configuration
 */
export async function getConfig(): Promise<AppConfig> {
  ensureDirs();

  let userConfig: UserConfig = {};

  if (existsSync(PATHS.config)) {
    try {
      userConfig = JSON.parse(readFileSync(PATHS.config, 'utf-8'));
    } catch (e) {
      // Ignore invalid config
    }
  }

  return {
    profilesDir: PATHS.base,
    claudeProfilesDir: PATHS.claude,
    githubProfilesDir: PATHS.github,
    claudeDir: findClaudeDir(),
    githubDir: findGitHubDir(),
    cacheDir: PATHS.cache,
    configFile: PATHS.config,
    marketplaceRepo: userConfig.marketplaceRepo || 'brrichards/cli-profile-manager',
    defaultProvider: userConfig.defaultProvider,
  };
}

/**
 * Update configuration
 */
export async function updateConfig(updates: Partial<UserConfig>): Promise<AppConfig> {
  ensureDirs();

  const current = await getConfig();
  const newConfig = { ...current, ...updates };

  const toSave: UserConfig = {
    marketplaceRepo: newConfig.marketplaceRepo,
    defaultProvider: newConfig.defaultProvider,
  };

  writeFileSync(PATHS.config, JSON.stringify(toSave, null, 2));

  return newConfig;
}

/**
 * Get the profile storage directory for a specific provider
 */
export function getProviderProfilesDir(provider: CLIType): string {
  return provider === 'claude' ? PATHS.claude : PATHS.github;
}

/**
 * Get the path for a local profile
 */
export function getProfilePath(name: string, provider: CLIType): string {
  return join(getProviderProfilesDir(provider), name);
}

/**
 * Get the config directory for a specific CLI provider
 */
export function getConfigDir(provider: CLIType): string {
  return provider === 'claude' ? findClaudeDir() : findGitHubDir();
}

/**
 * Check if config directory exists for a specific provider
 */
export function configDirExists(provider: CLIType): boolean {
  return existsSync(getConfigDir(provider));
}
