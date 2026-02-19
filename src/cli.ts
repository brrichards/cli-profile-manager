#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import type { CLIType } from './types/index.js';
import {
  saveProfile,
  loadProfile,
  listLocalProfiles,
  deleteLocalProfile,
  showProfileInfo
} from './commands/profile.js';
import {
  listMarketplace,
  searchMarketplace,
  installFromMarketplace,
  showMarketplaceInfo
} from './commands/marketplace.js';
import {
  publishProfile,
  setRepository
} from './commands/publish.js';
import { getConfig } from './utils/config.js';

const VERSION = '0.1.1';

const program = new Command();

// Banner
const banner = `
${chalk.cyan('   ____ ____  __  __')}
${chalk.cyan('  / ___|  _ \\|  \\/  |')}
${chalk.cyan(' | |   | |_) | |\\/| |')}
${chalk.cyan(' | |___|  __/| |  | |')}
${chalk.cyan('  \\____|_|   |_|  |_|')}

  ${chalk.magenta('CLI Profile Manager v' + VERSION)}
`;

program
  .name('cpm')
  .description('Save, share, and load CLI profiles for Claude Code and GitHub CLI')
  .version(VERSION)
  .addHelpText('before', banner);

// Helper to get provider from options or default
async function getProvider(options: { provider?: string }): Promise<CLIType> {
  if (options.provider) {
    const provider = options.provider.toLowerCase();
    if (provider !== 'claude' && provider !== 'github') {
      console.log(chalk.red(`Invalid provider: ${provider}. Must be 'claude' or 'github'`));
      process.exit(1);
    }
    return provider as CLIType;
  }

  // Use default provider from config if available
  const config = await getConfig();
  if (config.defaultProvider) {
    return config.defaultProvider;
  }

  // Default to claude for backward compatibility
  return 'claude';
}

// ============================================================================
// Local Profile Commands
// ============================================================================

program
  .command('save <name>')
  .description('Save current CLI configuration as a profile')
  .option('-p, --provider <type>', 'CLI provider (claude|github)')
  .option('-d, --description <desc>', 'Profile description')
  .option('-t, --tags <tags>', 'Comma-separated tags')
  .option('--include-secrets', 'Include sensitive files (use with caution)')
  .action(async (name: string, options: any) => {
    const provider = await getProvider(options);
    await saveProfile(name, provider, {
      description: options.description,
      tags: options.tags,
      includeSecrets: options.includeSecrets
    });
  });

program
  .command('load <name>')
  .description('Load a profile and apply it to the CLI configuration')
  .option('-p, --provider <type>', 'CLI provider (claude|github)')
  .option('-f, --force', 'Overwrite existing configuration without prompting')
  .option('--backup', 'Backup current configuration before loading')
  .action(async (name: string, options: any) => {
    const provider = await getProvider(options);
    await loadProfile(name, provider, {
      force: options.force,
      backup: options.backup
    });
  });

program
  .command('local')
  .description('List locally saved profiles')
  .option('-p, --provider <type>', 'CLI provider (claude|github)')
  .action(async (options: any) => {
    const provider = await getProvider(options);
    await listLocalProfiles(provider);
  });

program
  .command('delete <name>')
  .description('Delete a locally saved profile')
  .option('-p, --provider <type>', 'CLI provider (claude|github)')
  .option('-f, --force', 'Delete without confirmation')
  .action(async (name: string, options: any) => {
    const provider = await getProvider(options);
    await deleteLocalProfile(name, provider, {
      force: options.force
    });
  });

program
  .command('info <name>')
  .description('Show detailed info about a profile')
  .option('-p, --provider <type>', 'CLI provider (claude|github)')
  .option('--marketplace', 'Show marketplace profile info')
  .action(async (name: string, options: any) => {
    const provider = await getProvider(options);
    if (options.marketplace || name.includes('/')) {
      await showMarketplaceInfo(provider, name);
    } else {
      await showProfileInfo(name, provider);
    }
  });

// ============================================================================
// Marketplace Commands
// ============================================================================

program
  .command('list')
  .alias('browse')
  .description('Browse profiles in the marketplace')
  .option('-p, --provider <type>', 'CLI provider (claude|github)')
  .option('-c, --category <category>', 'Filter by category')
  .option('--refresh', 'Force refresh the marketplace index')
  .action(async (options: any) => {
    const provider = await getProvider(options);
    await listMarketplace(provider, {
      category: options.category,
      refresh: options.refresh
    });
  });

program
  .command('search <query>')
  .description('Search the marketplace')
  .option('-p, --provider <type>', 'CLI provider (claude|github)')
  .action(async (query: string, options: any) => {
    const provider = await getProvider(options);
    await searchMarketplace(provider, query);
  });

program
  .command('install <profile>')
  .description('Install a profile from the marketplace (format: author/name)')
  .option('-p, --provider <type>', 'CLI provider (claude|github)')
  .option('-f, --force', 'Overwrite existing configuration')
  .option('--backup', 'Backup current config before installing')
  .action(async (profile: string, options: any) => {
    const provider = await getProvider(options);
    await installFromMarketplace(provider, profile, {
      force: options.force,
      backup: options.backup
    });
  });

// ============================================================================
// Publishing Commands
// ============================================================================

program
  .command('publish <name>')
  .description('Publish a local profile to the marketplace')
  .option('-p, --provider <type>', 'CLI provider (claude|github)')
  .action(async (name: string, options: any) => {
    const provider = await getProvider(options);
    await publishProfile(name, provider, {});
  });

program
  .command('repo <repository>')
  .description('Set custom marketplace repository (format: owner/repo)')
  .action(async (repository: string) => {
    await setRepository(repository);
  });

// ============================================================================
// Utility Commands
// ============================================================================

program
  .command('config')
  .description('Show current configuration')
  .action(async () => {
    const config = await getConfig();
    console.log(banner);
    console.log(chalk.bold('Configuration:\n'));
    console.log(`  ${chalk.cyan('Profiles Directory:')} ${config.profilesDir}`);
    console.log(`  ${chalk.cyan('Claude Profiles:')}    ${config.claudeProfilesDir}`);
    console.log(`  ${chalk.cyan('GitHub Profiles:')}    ${config.githubProfilesDir}`);
    console.log(`  ${chalk.cyan('Claude Directory:')}   ${config.claudeDir}`);
    console.log(`  ${chalk.cyan('GitHub Directory:')}   ${config.githubDir}`);
    console.log(`  ${chalk.cyan('Marketplace Repo:')}   ${config.marketplaceRepo}`);
    console.log(`  ${chalk.cyan('Default Provider:')}   ${config.defaultProvider || chalk.dim('none (uses claude)')}`);
    console.log(`  ${chalk.cyan('Cache Directory:')}    ${config.cacheDir}`);
  });

program.parse();
