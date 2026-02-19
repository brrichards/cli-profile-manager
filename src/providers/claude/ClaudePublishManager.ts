/**
 * Claude Code CLI Publish Manager
 * Implements IPublishManager for Claude Code publishing operations
 */

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import type { IPublishManager, PublishProfileOptions } from '../../types/index.js';
import { getConfig, updateConfig } from '../../utils/config.js';
import { readProfileMetadata } from './snapshot.js';
import {
  getGitHubToken,
  getGitHubUsername,
  createProfilePR,
  fetchRepoIndex,
  authenticateWithDeviceFlow
} from '../../utils/auth.js';
import { CLAUDE_PROFILES_PATH } from './constants.js';

export class ClaudePublishManager implements IPublishManager {
  async publishProfile(name: string, _options: PublishProfileOptions): Promise<void> {
    const config = await getConfig();
    const profilePath = join(config.claudeProfilesDir, name);

    if (!existsSync(profilePath)) {
      console.log(chalk.red(`Profile not found: ${name}`));
      console.log(chalk.dim('  List local profiles with: cpm local --provider claude'));
      process.exit(1);
    }

    const metadata = readProfileMetadata(profilePath);

    if (!metadata) {
      console.log(chalk.red('Invalid profile: missing metadata'));
      process.exit(1);
    }

    const contents = metadata.contents || {};
    const hasContent = Object.values(contents).some(items => items && items.length > 0);
    if (!hasContent) {
      console.log(chalk.red('Profile has no functional content (commands, hooks, skills, etc.)'));
      console.log(chalk.dim('  Profiles must contain at least one functional customization.'));
      process.exit(1);
    }

    console.log('');
    console.log(chalk.bold('Publish Profile to Marketplace'));
    console.log(chalk.dim('-'.repeat(50)));
    console.log('');

    const spinner = ora('Checking GitHub credentials...').start();
    let token = getGitHubToken();
    let useFork = false;

    if (!token) {
      spinner.warn(chalk.yellow('No cached GitHub credentials found.'));
      console.log(chalk.dim('  Falling back to browser authentication...'));
      token = await authenticateWithDeviceFlow();
      useFork = true;
    } else {
      spinner.succeed(chalk.green('Found GitHub credentials.'));
    }

    let author: string;
    const userSpinner = ora('Verifying identity...').start();
    try {
      author = await getGitHubUsername(token);
      userSpinner.succeed(chalk.green(`Authenticated as ${chalk.bold(author)}`));
    } catch (error: any) {
      userSpinner.fail(chalk.red(error.message));
      process.exit(1);
    }

    console.log('');
    console.log(chalk.cyan('  Name:    ') + name);
    console.log(chalk.cyan('  Version: ') + (metadata.version || '1.0.0'));
    console.log(chalk.cyan('  Files:   ') + (metadata.files || []).length);
    if (metadata.description) {
      console.log(chalk.cyan('  Desc:    ') + metadata.description);
    }

    for (const [category, items] of Object.entries(contents)) {
      if (items && items.length > 0) {
        const display = category === 'commands'
          ? items.map(i => `/${i}`).join(', ')
          : items.join(', ');
        console.log(chalk.cyan(`  ${category}: `) + chalk.dim(display));
      }
    }
    console.log('');

    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: `Publish ${chalk.cyan(author + '/' + name)} to the marketplace?`,
      default: true
    }]);

    if (!confirm) {
      console.log(chalk.yellow('Aborted.'));
      process.exit(0);
    }

    await this.attemptPublish(token, config, { author, name, metadata, profilePath, useFork });
  }

  /**
   * Attempt to publish. On 403 (insufficient token scope), fall back to
   * OAuth device flow and retry with a fork-based PR.
   */
  private async attemptPublish(token: string, config: any, params: {
    author: string;
    name: string;
    metadata: any;
    profilePath: string;
    useFork: boolean;
  }): Promise<void> {
    const { author, name, metadata, profilePath, useFork } = params;
    const publishSpinner = ora('Creating pull request...').start();

    try {
      const pr = await this.doPublish(token, config, { author, name, metadata, profilePath, useFork });
      publishSpinner.succeed(chalk.green('Pull request created!'));
      console.log('');
      console.log(chalk.cyan('  PR: ') + pr.html_url);
      console.log('');
      console.log(chalk.dim('A maintainer will review and merge your profile.'));
      console.log('');
    } catch (error: any) {
      if (error.message.includes('403') && !useFork) {
        publishSpinner.warn(chalk.yellow('Credentials lack write access to marketplace repo.'));
        console.log(chalk.dim('  Falling back to browser authentication...'));
        console.log('');

        const deviceToken = await authenticateWithDeviceFlow();

        const retrySpinner = ora('Retrying with fork-based PR...').start();
        try {
          const pr = await this.doPublish(deviceToken, config, { author, name, metadata, profilePath, useFork: true });
          retrySpinner.succeed(chalk.green('Pull request created!'));
          console.log('');
          console.log(chalk.cyan('  PR: ') + pr.html_url);
          console.log('');
          console.log(chalk.dim('A maintainer will review and merge your profile.'));
          console.log('');
        } catch (retryError: any) {
          retrySpinner.fail(chalk.red(`Publish failed: ${retryError.message}`));
          process.exit(1);
        }
      } else {
        publishSpinner.fail(chalk.red(`Publish failed: ${error.message}`));
        process.exit(1);
      }
    }
  }

  /**
   * Core publish logic: fetch index, prepare metadata, create PR.
   */
  private async doPublish(token: string, config: any, params: {
    author: string;
    name: string;
    metadata: any;
    profilePath: string;
    useFork: boolean;
  }): Promise<any> {
    const { author, name, metadata, profilePath, useFork } = params;

    const index = await fetchRepoIndex(token, config.marketplaceRepo, CLAUDE_PROFILES_PATH);

    const publishMetadata = {
      ...metadata,
      author,
      publishedAt: new Date().toISOString()
    };

    index.profiles = (index.profiles || []).filter(
      (p: any) => !(p.author === author && p.name === name)
    );
    index.profiles.push({
      name,
      author,
      version: publishMetadata.version || '1.0.0',
      description: publishMetadata.description || '',
      tags: publishMetadata.tags || [],
      downloads: 0,
      stars: 0,
      createdAt: publishMetadata.publishedAt,
      contents: publishMetadata.contents || {}
    });
    index.lastUpdated = new Date().toISOString();

    const profileFiles = this.readProfileFiles(profilePath);

    const pr = await createProfilePR(token, config.marketplaceRepo, {
      author,
      name,
      profileJson: JSON.stringify(publishMetadata, null, 2),
      profileFiles,
      indexUpdate: JSON.stringify(index, null, 2)
    }, { useFork, profilesPath: CLAUDE_PROFILES_PATH });

    return pr;
  }

  /**
   * Read all content files from a profile directory (excluding profile.json).
   * Returns an array of { path, content } pairs with forward-slash paths.
   */
  private readProfileFiles(profileDir: string): Array<{ path: string; content: string }> {
    const files: Array<{ path: string; content: string }> = [];

    const walk = (dir: string, relativePath = '') => {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        if (!relativePath && entry === 'profile.json') continue;

        const fullPath = join(dir, entry);
        const relPath = relativePath ? `${relativePath}/${entry}` : entry;
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          walk(fullPath, relPath);
        } else {
          files.push({ path: relPath, content: readFileSync(fullPath, 'utf-8') });
        }
      }
    };

    walk(profileDir);
    return files;
  }

  async setRepository(repository: string): Promise<void> {
    if (!/^[a-z0-9-]+\/[a-z0-9-]+$/i.test(repository)) {
      console.log(chalk.red('Invalid repository format. Use: owner/repo'));
      process.exit(1);
    }

    const spinner = ora('Validating repository...').start();

    try {
      const fetch = (await import('node-fetch')).default;

      const response = await fetch(
        `https://raw.githubusercontent.com/${repository}/main/${CLAUDE_PROFILES_PATH}/index.json`
      );

      if (!response.ok && response.status !== 404) {
        throw new Error(`Repository not accessible: ${response.status}`);
      }

      await updateConfig({ marketplaceRepo: repository });

      spinner.succeed(chalk.green(`Repository set to: ${chalk.bold(repository)}`));
      console.log('');
      console.log(chalk.dim('Browse profiles with: ') + chalk.cyan('cpm list'));

    } catch (error: any) {
      spinner.fail(chalk.red(`Failed to set repository: ${error.message}`));
      process.exit(1);
    }
  }
}
