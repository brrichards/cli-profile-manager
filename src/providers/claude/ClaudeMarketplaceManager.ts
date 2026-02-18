/**
 * Claude Code CLI Marketplace Manager
 * Implements IMarketplaceManager for Claude Code marketplace operations
 */

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import fetch from 'node-fetch';
import { existsSync, writeFileSync, readFileSync, mkdirSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import type { IMarketplaceManager, ListMarketplaceOptions, InstallMarketplaceOptions } from '../../types';
import { getConfig, configDirExists } from '../../utils/config';
import { cleanProfileContent } from './snapshot';
import { CATEGORY_LABELS } from './constants';

const INDEX_CACHE_TIME = 60 * 60 * 1000; // 1 hour

interface MarketplaceProfile {
  name: string;
  author: string;
  version?: string;
  description?: string;
  tags?: string[];
  downloads?: number;
  stars?: number;
  contents?: Record<string, string[]>;
  createdAt?: string;
  updatedAt?: string;
}

interface MarketplaceIndex {
  profiles: MarketplaceProfile[];
  _cachedAt?: number;
}

export class ClaudeMarketplaceManager implements IMarketplaceManager {
  /**
   * Format a contents object into display lines
   */
  private formatContentsLines(contents: Record<string, string[]>, indent = '    '): string[] {
    if (!contents || Object.keys(contents).length === 0) return [];

    const lines: string[] = [];
    for (const [category, items] of Object.entries(contents)) {
      if (!items || items.length === 0) continue;
      const label = CATEGORY_LABELS[category] || category;
      const display = category === 'commands'
        ? items.map(i => `/${i}`).join(', ')
        : items.join(', ');
      lines.push(`${indent}${chalk.white(label + ':')} ${chalk.dim(display)}`);
    }
    return lines;
  }

  /**
   * Get the marketplace index (list of all profiles)
   */
  private async fetchMarketplaceIndex(forceRefresh = false): Promise<MarketplaceIndex> {
    const config = await getConfig();
    const cacheFile = join(config.cacheDir, 'claude-marketplace-index.json');

    if (!forceRefresh && existsSync(cacheFile)) {
      try {
        const cached = JSON.parse(readFileSync(cacheFile, 'utf-8')) as MarketplaceIndex;
        const age = Date.now() - (cached._cachedAt || 0);

        if (age < INDEX_CACHE_TIME) {
          return cached;
        }
      } catch {
        // Ignore cache errors
      }
    }

    const indexUrl = `https://raw.githubusercontent.com/${config.marketplaceRepo}/main/profiles/claude/index.json`;

    try {
      const response = await fetch(indexUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch marketplace index: ${response.status}`);
      }

      const index = await response.json() as MarketplaceIndex;
      index._cachedAt = Date.now();

      mkdirSync(config.cacheDir, { recursive: true });
      writeFileSync(cacheFile, JSON.stringify(index, null, 2));

      return index;
    } catch (error: any) {
      if (existsSync(cacheFile)) {
        console.log(chalk.yellow('Could not refresh marketplace. Using cached data.'));
        return JSON.parse(readFileSync(cacheFile, 'utf-8'));
      }
      throw error;
    }
  }

  async listMarketplace(options: ListMarketplaceOptions): Promise<void> {
    const spinner = ora('Fetching marketplace...').start();

    try {
      const index = await this.fetchMarketplaceIndex(options.refresh);
      spinner.stop();

      console.log('');
      console.log(chalk.bold('Claude Code Profile Marketplace'));
      console.log(chalk.dim('-'.repeat(50)));
      console.log('');

      if (!index.profiles || index.profiles.length === 0) {
        console.log(chalk.dim('  No profiles available yet.'));
        console.log('');
        console.log(chalk.dim('  Be the first to publish: ') + chalk.cyan('cpm publish <name> --provider claude'));
        return;
      }

      let profiles = index.profiles;
      if (options.category) {
        profiles = profiles.filter(p =>
          (p.tags || []).includes(options.category!)
        );
      }

      for (const profile of profiles) {
        const fullName = `${profile.author}/${profile.name}`;
        console.log(`  ${chalk.cyan(fullName)} ${chalk.dim('v' + (profile.version || '1.0.0'))}`);

        if (profile.description) {
          console.log(`    ${chalk.dim(profile.description.slice(0, 60))}${profile.description.length > 60 ? '...' : ''}`);
        }

        const contentsLines = this.formatContentsLines(profile.contents || {});
        for (const line of contentsLines) {
          console.log(line);
        }

        if (profile.tags?.length) {
          console.log(`    ${chalk.yellow(profile.tags.join(', '))}`);
        }

        const stats: string[] = [];
        if (profile.downloads) stats.push(`${profile.downloads} downloads`);
        if (profile.stars) stats.push(`${profile.stars} stars`);
        if (stats.length) {
          console.log(`    ${chalk.yellow(stats.join(' | '))}`);
        }

        console.log('');
      }

      console.log(chalk.dim('Install a profile:'));
      console.log(chalk.cyan('  cpm install author/profile-name --provider claude'));
      console.log('');

    } catch (error: any) {
      spinner.fail(chalk.red(`Failed to fetch marketplace: ${error.message}`));
      process.exit(1);
    }
  }

  async searchMarketplace(query: string): Promise<void> {
    const spinner = ora('Searching marketplace...').start();

    try {
      const index = await this.fetchMarketplaceIndex();
      spinner.stop();

      const queryLower = query.toLowerCase();

      const results = (index.profiles || []).filter(profile => {
        const searchable = [
          profile.name,
          profile.author,
          profile.description,
          ...(profile.tags || [])
        ].join(' ').toLowerCase();

        return searchable.includes(queryLower);
      });

      console.log('');
      console.log(chalk.bold(`Search Results for "${query}"`));
      console.log(chalk.dim('-'.repeat(50)));
      console.log('');

      if (results.length === 0) {
        console.log(chalk.dim(`  No profiles found matching "${query}"`));
        console.log('');
        return;
      }

      for (const profile of results) {
        const fullName = `${profile.author}/${profile.name}`;
        console.log(`  ${chalk.cyan(fullName)} ${chalk.dim('v' + (profile.version || '1.0.0'))}`);

        if (profile.description) {
          console.log(`    ${chalk.dim(profile.description.slice(0, 60))}${profile.description.length > 60 ? '...' : ''}`);
        }

        if (profile.tags?.length) {
          console.log(`    ${chalk.yellow(profile.tags.join(', '))}`);
        }

        console.log('');
      }

      console.log(chalk.dim(`Found ${results.length} profile(s)`));
      console.log('');

    } catch (error: any) {
      spinner.fail(chalk.red(`Search failed: ${error.message}`));
      process.exit(1);
    }
  }

  async showMarketplaceInfo(profilePath: string): Promise<void> {
    const [author, name] = profilePath.includes('/')
      ? profilePath.split('/')
      : [null, profilePath];

    if (!author || !name) {
      console.log(chalk.red('Invalid profile format. Use: author/profile-name'));
      process.exit(1);
    }

    const spinner = ora('Fetching profile info...').start();

    try {
      const index = await this.fetchMarketplaceIndex();
      const profile = (index.profiles || []).find(
        p => p.author === author && p.name === name
      );

      if (!profile) {
        spinner.fail(chalk.red(`Profile not found: ${profilePath}`));
        process.exit(1);
      }

      const config = await getConfig();
      const metadataUrl = `https://raw.githubusercontent.com/${config.marketplaceRepo}/main/profiles/claude/${author}/${name}/profile.json`;

      let metadata = profile;
      try {
        const response = await fetch(metadataUrl);
        if (response.ok) {
          metadata = { ...profile, ...await response.json() as MarketplaceProfile };
        }
      } catch {
        // Use index data
      }

      spinner.stop();

      console.log('');
      console.log(chalk.bold('Profile Information'));
      console.log(chalk.dim('-'.repeat(50)));
      console.log('');

      console.log(chalk.cyan('Name:        ') + `${author}/${name}`);
      console.log(chalk.cyan('Provider:    ') + 'Claude Code');
      console.log(chalk.cyan('Version:     ') + (metadata.version || '1.0.0'));
      console.log(chalk.cyan('Author:      ') + author);
      console.log(chalk.cyan('Description: ') + (metadata.description || chalk.dim('No description')));
      console.log(chalk.cyan('Tags:        ') + (metadata.tags?.join(', ') || chalk.dim('None')));

      if (metadata.downloads) {
        console.log(chalk.cyan('Downloads:   ') + metadata.downloads);
      }
      if (metadata.stars) {
        console.log(chalk.cyan('Stars:       ') + metadata.stars);
      }
      if (metadata.createdAt) {
        console.log(chalk.cyan('Created:     ') + new Date(metadata.createdAt).toLocaleDateString());
      }
      if (metadata.updatedAt) {
        console.log(chalk.cyan('Updated:     ') + new Date(metadata.updatedAt).toLocaleDateString());
      }

      if (metadata.contents && Object.keys(metadata.contents).length > 0) {
        console.log('');
        console.log(chalk.bold('Contents:'));
        const contentsLines = this.formatContentsLines(metadata.contents, '  ');
        for (const line of contentsLines) {
          console.log(line);
        }
      }

      console.log('');
      console.log(chalk.dim('Install with:'));
      console.log(chalk.cyan(`  cpm install ${author}/${name} --provider claude`));
      console.log('');

    } catch (error: any) {
      spinner.fail(chalk.red(`Failed to fetch profile: ${error.message}`));
      process.exit(1);
    }
  }

  async installFromMarketplace(profilePath: string, options: InstallMarketplaceOptions): Promise<void> {
    const [author, name] = profilePath.includes('/')
      ? profilePath.split('/')
      : [null, profilePath];

    if (!author || !name) {
      console.log(chalk.red('Invalid profile format. Use: author/profile-name'));
      process.exit(1);
    }

    console.log('');
    console.log(chalk.bold(`Installing: ${chalk.cyan(profilePath)}`));
    console.log('');

    if (configDirExists('claude') && !options.force) {
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: 'This will replace your current .claude configuration. Continue?',
        default: false
      }]);

      if (!confirm) {
        console.log(chalk.yellow('Aborted.'));
        process.exit(0);
      }

      if (!options.backup) {
        const { backup } = await inquirer.prompt([{
          type: 'confirm',
          name: 'backup',
          message: 'Backup current .claude folder first?',
          default: true
        }]);
        options.backup = backup;
      }

      options.force = true;
    }

    const spinner = ora('Downloading profile...').start();

    try {
      const config = await getConfig();
      const claudeDir = config.claudeDir;
      const baseUrl = `https://raw.githubusercontent.com/${config.marketplaceRepo}/main/profiles/claude/${author}/${name}`;

      const metaResponse = await fetch(`${baseUrl}/profile.json`);

      if (!metaResponse.ok) {
        if (metaResponse.status === 404) {
          throw new Error(`Profile not found: ${profilePath}`);
        }
        throw new Error(`Download failed: ${metaResponse.status}`);
      }

      const metadata = await metaResponse.json() as { files?: string[] };
      const files = (metadata.files || []).map(f => f.replace(/\\/g, '/'));

      if (files.length === 0) {
        throw new Error('Profile has no files to install');
      }

      if (options.backup && existsSync(claudeDir)) {
        const backupName = `.claude-backup-${Date.now()}`;
        const backupPath = join(config.claudeProfilesDir, backupName);
        cpSync(claudeDir, backupPath, { recursive: true });
      }

      mkdirSync(claudeDir, { recursive: true });

      cleanProfileContent(claudeDir);

      spinner.text = 'Installing profile files...';

      for (const filePath of files) {
        const fileUrl = `${baseUrl}/${filePath}`;
        const fileResponse = await fetch(fileUrl);

        if (!fileResponse.ok) {
          throw new Error(`Failed to download ${filePath}: ${fileResponse.status}`);
        }

        const content = await fileResponse.text();
        const destPath = join(claudeDir, filePath);

        mkdirSync(dirname(destPath), { recursive: true });
        writeFileSync(destPath, content);
      }

      spinner.succeed(chalk.green(`Installed: ${chalk.bold(profilePath)}`));

      if (options.backup) {
        console.log(chalk.dim('  Previous config backed up'));
      }

      console.log('');
      console.log(chalk.green(`Your Claude CLI is now configured with this profile. The profile files are located at ${claudeDir}.`));
      console.log('');

    } catch (error: any) {
      spinner.fail(chalk.red(`Installation failed: ${error.message}`));
      process.exit(1);
    }
  }
}
