/**
 * GitHub Copilot CLI Marketplace Manager
 * Implements IMarketplaceManager for GitHub Copilot marketplace operations
 */

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import fetch from 'node-fetch';
import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { IMarketplaceManager, ListMarketplaceOptions, InstallMarketplaceOptions } from '../../types/index.js';
import { getConfig } from '../../utils/config.js';
import { cleanProfileDir } from './snapshot.js';
import { CATEGORY_LABELS } from './constants.js';

const INDEX_CACHE_TIME = 60 * 60 * 1000; // 1 hour
const MARKETPLACE_PATH = 'profiles/github/marketplace';

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

export class GitHubMarketplaceManager implements IMarketplaceManager {
  private formatContentsLines(contents: Record<string, string[]>, indent = '    '): string[] {
    if (!contents || Object.keys(contents).length === 0) return [];

    const lines: string[] = [];
    for (const [category, items] of Object.entries(contents)) {
      if (!items || items.length === 0) continue;
      const label = CATEGORY_LABELS[category] || category;
      lines.push(`${indent}${chalk.white(label + ':')} ${chalk.dim(items.join(', '))}`);
    }
    return lines;
  }

  private async fetchMarketplaceIndex(forceRefresh = false): Promise<MarketplaceIndex> {
    const config = await getConfig();
    const cacheFile = join(config.cacheDir, 'github-marketplace-index.json');

    if (!forceRefresh && existsSync(cacheFile)) {
      try {
        const cached = JSON.parse(readFileSync(cacheFile, 'utf-8')) as MarketplaceIndex;
        if (Date.now() - (cached._cachedAt || 0) < INDEX_CACHE_TIME) {
          return cached;
        }
      } catch {
        // Ignore cache errors
      }
    }

    const indexUrl = `https://raw.githubusercontent.com/${config.marketplaceRepo}/main/${MARKETPLACE_PATH}/index.json`;

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
      console.log(chalk.bold('GitHub Copilot Profile Marketplace'));
      console.log(chalk.dim('-'.repeat(50)));
      console.log('');

      if (!index.profiles || index.profiles.length === 0) {
        console.log(chalk.dim('  No profiles available yet.'));
        console.log('');
        console.log(chalk.dim('  Be the first to publish: ') + chalk.cyan('cpm publish <name> --provider github'));
        return;
      }

      let profiles = index.profiles;
      if (options.category) {
        profiles = profiles.filter(p => (p.tags || []).includes(options.category!));
      }

      for (const profile of profiles) {
        const fullName = `${profile.author}/${profile.name}`;
        console.log(`  ${chalk.cyan(fullName)} ${chalk.dim('v' + (profile.version || '1.0.0'))}`);

        if (profile.description) {
          console.log(`    ${chalk.dim(profile.description.slice(0, 60))}${profile.description.length > 60 ? '...' : ''}`);
        }

        for (const line of this.formatContentsLines(profile.contents || {})) {
          console.log(line);
        }

        if (profile.tags?.length) {
          console.log(`    ${chalk.yellow(profile.tags.join(', '))}`);
        }

        const stats: string[] = [];
        if (profile.downloads) stats.push(`${profile.downloads} downloads`);
        if (profile.stars) stats.push(`${profile.stars} stars`);
        if (stats.length) console.log(`    ${chalk.yellow(stats.join(' | '))}`);

        console.log('');
      }

      console.log(chalk.dim('Install a profile:'));
      console.log(chalk.cyan('  cpm install author/profile-name --provider github'));
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
        const searchable = [profile.name, profile.author, profile.description, ...(profile.tags || [])]
          .join(' ').toLowerCase();
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
      const profile = (index.profiles || []).find(p => p.author === author && p.name === name);

      if (!profile) {
        spinner.fail(chalk.red(`Profile not found: ${profilePath}`));
        process.exit(1);
      }

      const config = await getConfig();
      const metadataUrl = `https://raw.githubusercontent.com/${config.marketplaceRepo}/main/${MARKETPLACE_PATH}/${author}/${name}/profile.json`;

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
      console.log(chalk.cyan('Provider:    ') + 'GitHub Copilot');
      console.log(chalk.cyan('Version:     ') + (metadata.version || '1.0.0'));
      console.log(chalk.cyan('Author:      ') + author);
      console.log(chalk.cyan('Description: ') + (metadata.description || chalk.dim('No description')));
      console.log(chalk.cyan('Tags:        ') + (metadata.tags?.join(', ') || chalk.dim('None')));
      if (metadata.downloads) console.log(chalk.cyan('Downloads:   ') + metadata.downloads);
      if (metadata.stars) console.log(chalk.cyan('Stars:       ') + metadata.stars);
      if (metadata.createdAt) console.log(chalk.cyan('Created:     ') + new Date(metadata.createdAt).toLocaleDateString());
      if (metadata.updatedAt) console.log(chalk.cyan('Updated:     ') + new Date(metadata.updatedAt).toLocaleDateString());

      if (metadata.contents && Object.keys(metadata.contents).length > 0) {
        console.log('');
        console.log(chalk.bold('Contents:'));
        for (const line of this.formatContentsLines(metadata.contents, '  ')) {
          console.log(line);
        }
      }

      console.log('');
      console.log(chalk.dim('Install with:'));
      console.log(chalk.cyan(`  cpm install ${author}/${name} --provider github`));
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

    const config = await getConfig();
    const githubDir = config.githubDir;
    const destDir = join(githubDir, name);

    if (existsSync(destDir) && !options.force) {
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: `This will replace the existing .github/${name} configuration. Continue?`,
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
          message: `Backup current .github/${name} folder first?`,
          default: true
        }]);
        options.backup = backup;
      }

      options.force = true;
    }

    const spinner = ora('Downloading profile...').start();

    try {
      const baseUrl = `https://raw.githubusercontent.com/${config.marketplaceRepo}/main/${MARKETPLACE_PATH}/${author}/${name}`;
      const metaResponse = await fetch(`${baseUrl}/profile.json`);

      if (!metaResponse.ok) {
        if (metaResponse.status === 404) throw new Error(`Profile not found: ${profilePath}`);
        throw new Error(`Download failed: ${metaResponse.status}`);
      }

      const metadata = await metaResponse.json() as { files?: string[] };
      const files = (metadata.files || []).map(f => f.replace(/\\/g, '/'));

      if (files.length === 0) {
        throw new Error('Profile has no files to install');
      }

      if (options.backup && existsSync(destDir)) {
        const { cpSync } = await import('fs');
        const backupPath = join(config.githubProfilesDir, `.github-${name}-backup-${Date.now()}`);
        cpSync(destDir, backupPath, { recursive: true });
      }

      mkdirSync(destDir, { recursive: true });
      cleanProfileDir(destDir);

      spinner.text = 'Installing profile files...';

      for (const filePath of files) {
        const fileUrl = `${baseUrl}/${filePath}`;
        const fileResponse = await fetch(fileUrl);

        if (!fileResponse.ok) {
          throw new Error(`Failed to download ${filePath}: ${fileResponse.status}`);
        }

        const content = await fileResponse.text();
        const destPath = join(destDir, filePath);

        mkdirSync(dirname(destPath), { recursive: true });
        writeFileSync(destPath, content);
      }

      spinner.succeed(chalk.green(`Installed: ${chalk.bold(profilePath)}`));

      if (options.backup) {
        console.log(chalk.dim('  Previous config backed up'));
      }

      console.log('');
      console.log(chalk.green(`GitHub Copilot profile installed at: ${destDir}`));
      console.log('');

    } catch (error: any) {
      spinner.fail(chalk.red(`Installation failed: ${error.message}`));
      process.exit(1);
    }
  }
}
