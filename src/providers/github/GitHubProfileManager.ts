/**
 * GitHub Copilot CLI Profile Manager
 * Implements IProfileManager for GitHub Copilot specific operations
 */

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { existsSync, readdirSync, statSync, rmSync } from 'fs';
import { join } from 'path';
import type {
  IProfileManager,
  SaveProfileOptions,
  LoadProfileOptions,
  DeleteProfileOptions
} from '../../types/index.js';
import { getConfig, configDirExists } from '../../utils/config.js';
import {
  createSnapshot,
  extractSnapshot,
  readProfileMetadata,
  deriveContents
} from './snapshot.js';
import { CATEGORY_LABELS } from './constants.js';

export class GitHubProfileManager implements IProfileManager {
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

  private getContents(metadata: any): Record<string, string[]> {
    if (metadata?.contents) return metadata.contents;
    if (metadata?.files) return deriveContents(metadata.files);
    return {};
  }

  async saveProfile(name: string, options: SaveProfileOptions): Promise<void> {
    if (!/^[a-z0-9][a-z0-9-_]*[a-z0-9]$|^[a-z0-9]$/i.test(name)) {
      console.log(chalk.red('Invalid profile name. Use alphanumeric characters, hyphens, and underscores.'));
      process.exit(1);
    }

    if (!configDirExists('github')) {
      console.log(chalk.red('GitHub Copilot directory not found (.github or ~/.copilot).'));
      console.log(chalk.dim('  Create a .github directory in your project root, or ensure ~/.copilot exists.'));
      process.exit(1);
    }

    const spinner = ora('Creating profile snapshot...').start();

    try {
      const config = await getConfig();
      const githubDir = config.githubDir;
      const profileDir = join(config.githubProfilesDir, name);

      const metadata = await createSnapshot(githubDir, profileDir, name, options);

      spinner.succeed(chalk.green(`Profile saved: ${chalk.bold(name)}`));

      console.log('');
      console.log(chalk.dim('  Location: ') + profileDir);

      if (options.description) {
        console.log(chalk.dim('  Desc:     ') + options.description);
      }

      const contents = this.getContents(metadata);
      const contentsLines = this.formatContentsLines(contents, '  ');
      if (contentsLines.length > 0) {
        for (const line of contentsLines) {
          console.log(line);
        }
      } else {
        console.log(chalk.dim('  Files:    ') + metadata.files.length);
      }

      console.log('');
      console.log(chalk.dim('Load this profile anytime with:'));
      console.log(chalk.cyan(`  cpm load ${name} --provider github`));

    } catch (error: any) {
      spinner.fail(chalk.red(`Failed to save profile: ${error.message}`));
      process.exit(1);
    }
  }

  async loadProfile(name: string, options: LoadProfileOptions): Promise<void> {
    const config = await getConfig();
    const profileDir = join(config.githubProfilesDir, name);

    if (!existsSync(profileDir)) {
      console.log(chalk.red(`Profile not found: ${name}`));
      console.log(chalk.dim('  List local profiles with: cpm local --provider github'));
      console.log(chalk.dim('  Browse marketplace with:  cpm list --provider github'));
      process.exit(1);
    }

    const metadata = readProfileMetadata(profileDir);
    const githubDir = config.githubDir;

    console.log('');
    console.log(chalk.bold('Profile: ') + chalk.cyan(name));
    if (metadata?.description) {
      console.log(chalk.dim(metadata.description));
    }
    console.log(chalk.dim(`  Installs to: ${githubDir}`));
    console.log('');

    if (configDirExists('github') && !options.force) {
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: `This will replace your current GitHub Copilot configuration. Continue?`,
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
          message: 'Backup current GitHub Copilot config first?',
          default: true
        }]);
        options.backup = backup;
      }

      options.force = true;
    }

    const spinner = ora('Loading profile...').start();

    try {
      const backupDir = options.backup
        ? join(config.githubProfilesDir, `.copilot-backup-${Date.now()}`)
        : undefined;

      await extractSnapshot(profileDir, githubDir, backupDir);

      spinner.succeed(chalk.green(`Profile loaded: ${chalk.bold(name)}`));

      if (options.backup) {
        console.log(chalk.dim('  Previous config backed up'));
      }

      console.log('');
      console.log(chalk.green(`GitHub Copilot profile installed at: ${githubDir}`));

    } catch (error: any) {
      spinner.fail(chalk.red(`Failed to load profile: ${error.message}`));
      process.exit(1);
    }
  }

  async listLocalProfiles(): Promise<void> {
    const config = await getConfig();
    const profilesDir = config.githubProfilesDir;

    if (!existsSync(profilesDir)) {
      console.log('');
      console.log(chalk.bold('GitHub Copilot Profiles'));
      console.log(chalk.dim('-'.repeat(50)));
      console.log('');
      console.log(chalk.dim('  No local profiles found.'));
      console.log('');
      console.log(chalk.dim('  Save your current config:  ') + chalk.cyan('cpm save <name> --provider github'));
      console.log(chalk.dim('  Browse marketplace:        ') + chalk.cyan('cpm list --provider github'));
      console.log('');
      return;
    }

    const profiles = readdirSync(profilesDir)
      .filter(name => {
        if (name.startsWith('.')) return false;
        const profilePath = join(profilesDir, name);
        return statSync(profilePath).isDirectory() && existsSync(join(profilePath, 'profile.json'));
      });

    console.log('');
    console.log(chalk.bold('GitHub Copilot Profiles'));
    console.log(chalk.dim('-'.repeat(50)));

    if (profiles.length === 0) {
      console.log('');
      console.log(chalk.dim('  No local profiles found.'));
      console.log('');
      console.log(chalk.dim('  Save your current config:  ') + chalk.cyan('cpm save <name> --provider github'));
      console.log(chalk.dim('  Browse marketplace:        ') + chalk.cyan('cpm list --provider github'));
      console.log('');
      return;
    }

    console.log('');

    for (const name of profiles) {
      const profileDir = join(profilesDir, name);
      const metadata = readProfileMetadata(profileDir);

      console.log(chalk.cyan('  ' + name));

      if (metadata) {
        if (metadata.description) {
          console.log(chalk.dim(`    ${metadata.description}`));
        }

        const contents = this.getContents(metadata);
        for (const line of this.formatContentsLines(contents)) {
          console.log(line);
        }

        const info: string[] = [];
        if (metadata.tags?.length) {
          info.push(chalk.yellow(metadata.tags.join(', ')));
        }
        if (metadata.createdAt) {
          info.push(chalk.dim(new Date(metadata.createdAt).toLocaleDateString()));
        }
        if (info.length) {
          console.log(`    ${info.join(' | ')}`);
        }
      }

      console.log('');
    }

    console.log(chalk.dim('Commands:'));
    console.log(chalk.dim('  Load:   ') + chalk.cyan('cpm load <name> --provider github'));
    console.log(chalk.dim('  Info:   ') + chalk.cyan('cpm info <name> --provider github'));
    console.log(chalk.dim('  Delete: ') + chalk.cyan('cpm delete <name> --provider github'));
    console.log('');
  }

  async deleteLocalProfile(name: string, options: DeleteProfileOptions): Promise<void> {
    const config = await getConfig();
    const profileDir = join(config.githubProfilesDir, name);

    if (!existsSync(profileDir)) {
      console.log(chalk.red(`Profile not found: ${name}`));
      process.exit(1);
    }

    if (!options.force) {
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: `Delete profile "${name}"? This cannot be undone.`,
        default: false
      }]);

      if (!confirm) {
        console.log(chalk.yellow('Aborted.'));
        process.exit(0);
      }
    }

    rmSync(profileDir, { recursive: true, force: true });
    console.log(chalk.green(`Deleted profile: ${name}`));
  }

  async showProfileInfo(name: string): Promise<void> {
    const config = await getConfig();
    const profileDir = join(config.githubProfilesDir, name);

    if (!existsSync(profileDir)) {
      console.log(chalk.red(`Profile not found: ${name}`));
      process.exit(1);
    }

    const metadata = readProfileMetadata(profileDir);

    console.log('');
    console.log(chalk.bold('Profile Information'));
    console.log(chalk.dim('-'.repeat(50)));
    console.log('');

    console.log(chalk.cyan('Name:        ') + name);
    console.log(chalk.cyan('Provider:    ') + 'GitHub Copilot');
    console.log(chalk.cyan('Version:     ') + (metadata?.version || '1.0.0'));
    console.log(chalk.cyan('Description: ') + (metadata?.description || chalk.dim('No description')));
    console.log(chalk.cyan('Tags:        ') + (metadata?.tags?.join(', ') || chalk.dim('None')));
    console.log(chalk.cyan('Created:     ') + (metadata?.createdAt ? new Date(metadata.createdAt).toLocaleString() : chalk.dim('Unknown')));
    console.log(chalk.cyan('Platform:    ') + (metadata?.platform || chalk.dim('Unknown')));
    console.log(chalk.cyan('CLI version: ') + (metadata?.cliVersion || chalk.dim('Unknown')));

    const contents = this.getContents(metadata);
    if (Object.keys(contents).length > 0) {
      console.log('');
      console.log(chalk.bold('Contents:'));
      for (const line of this.formatContentsLines(contents, '  ')) {
        console.log(line);
      }
    }

    if (metadata?.files?.length) {
      console.log('');
      console.log(chalk.bold('Files:'));
      for (const file of metadata.files) {
        console.log(chalk.dim('  - ') + file);
      }
    }

    console.log('');
    console.log(chalk.dim('Location: ') + profileDir);
    console.log('');
  }
}
