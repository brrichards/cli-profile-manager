/**
 * Claude Code CLI Profile Manager
 * Implements IProfileManager for Claude Code specific operations
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
} from '../../types';
import { getConfig, configDirExists } from '../../utils/config';
import {
  createSnapshot,
  extractSnapshot,
  readProfileMetadata,
  deriveContents
} from './snapshot';
import { CATEGORY_LABELS } from './constants';

export class ClaudeProfileManager implements IProfileManager {
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
   * Get contents from metadata, falling back to deriving from files list
   */
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

    if (!configDirExists('claude')) {
      console.log(chalk.red('Claude directory (.claude) not found.'));
      console.log(chalk.dim('  Make sure Claude CLI is installed and configured.'));
      process.exit(1);
    }

    const spinner = ora('Creating profile snapshot...').start();

    try {
      const config = await getConfig();
      const claudeDir = config.claudeDir;
      const profileDir = join(config.claudeProfilesDir, name);

      const metadata = await createSnapshot(claudeDir, profileDir, name, options);

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
      console.log(chalk.cyan(`  cpm load ${name} --provider claude`));

    } catch (error: any) {
      spinner.fail(chalk.red(`Failed to save profile: ${error.message}`));
      process.exit(1);
    }
  }

  async loadProfile(name: string, options: LoadProfileOptions): Promise<void> {
    const config = await getConfig();
    const profileDir = join(config.claudeProfilesDir, name);

    if (!existsSync(profileDir)) {
      console.log(chalk.red(`Profile not found: ${name}`));
      console.log(chalk.dim('  List local profiles with: cpm local --provider claude'));
      console.log(chalk.dim('  Browse marketplace with:  cpm list --provider claude'));
      process.exit(1);
    }

    const metadata = readProfileMetadata(profileDir);

    console.log('');
    console.log(chalk.bold('Profile: ') + chalk.cyan(name));
    if (metadata?.description) {
      console.log(chalk.dim(metadata.description));
    }
    console.log('');

    const claudeDir = config.claudeDir;

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

    const spinner = ora('Loading profile...').start();

    try {
      const backupDir = options.backup
        ? join(config.claudeProfilesDir, `.claude-backup-${Date.now()}`)
        : undefined;

      await extractSnapshot(profileDir, claudeDir, backupDir);

      spinner.succeed(chalk.green(`Profile loaded: ${chalk.bold(name)}`));

      if (options.backup) {
        console.log(chalk.dim('  Previous config backed up'));
      }

      console.log('');
      console.log(chalk.green('Your Claude CLI is now configured with this profile.'));

    } catch (error: any) {
      spinner.fail(chalk.red(`Failed to load profile: ${error.message}`));
      process.exit(1);
    }
  }

  async listLocalProfiles(): Promise<void> {
    const config = await getConfig();
    const profilesDir = config.claudeProfilesDir;

    if (!existsSync(profilesDir)) {
      console.log('');
      console.log(chalk.bold('Claude Code Profiles'));
      console.log(chalk.dim('-'.repeat(50)));
      console.log('');
      console.log(chalk.dim('  No local profiles found.'));
      console.log('');
      console.log(chalk.dim('  Save your current config:  ') + chalk.cyan('cpm save <name> --provider claude'));
      console.log(chalk.dim('  Browse marketplace:        ') + chalk.cyan('cpm list --provider claude'));
      console.log('');
      return;
    }

    const profiles = readdirSync(profilesDir)
      .filter(name => {
        if (name.startsWith('.')) return false;
        const profilePath = join(profilesDir, name);
        const stat = statSync(profilePath);
        return stat.isDirectory() && existsSync(join(profilePath, 'profile.json'));
      });

    console.log('');
    console.log(chalk.bold('Claude Code Profiles'));
    console.log(chalk.dim('-'.repeat(50)));

    if (profiles.length === 0) {
      console.log('');
      console.log(chalk.dim('  No local profiles found.'));
      console.log('');
      console.log(chalk.dim('  Save your current config:  ') + chalk.cyan('cpm save <name> --provider claude'));
      console.log(chalk.dim('  Browse marketplace:        ') + chalk.cyan('cpm list --provider claude'));
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
        const contentsLines = this.formatContentsLines(contents);
        for (const line of contentsLines) {
          console.log(line);
        }

        const info: string[] = [];
        if (metadata.tags?.length) {
          info.push(chalk.yellow(metadata.tags.join(', ')));
        }
        if (metadata.createdAt) {
          const date = new Date(metadata.createdAt).toLocaleDateString();
          info.push(chalk.dim(date));
        }

        if (info.length) {
          console.log(`    ${info.join(' | ')}`);
        }
      }

      console.log('');
    }

    console.log(chalk.dim('Commands:'));
    console.log(chalk.dim('  Load:   ') + chalk.cyan('cpm load <name> --provider claude'));
    console.log(chalk.dim('  Info:   ') + chalk.cyan('cpm info <name> --provider claude'));
    console.log(chalk.dim('  Delete: ') + chalk.cyan('cpm delete <name> --provider claude'));
    console.log('');
  }

  async deleteLocalProfile(name: string, options: DeleteProfileOptions): Promise<void> {
    const config = await getConfig();
    const profileDir = join(config.claudeProfilesDir, name);

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
    const profileDir = join(config.claudeProfilesDir, name);

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
    console.log(chalk.cyan('Provider:    ') + 'Claude Code');
    console.log(chalk.cyan('Version:     ') + (metadata?.version || '1.0.0'));
    console.log(chalk.cyan('Description: ') + (metadata?.description || chalk.dim('No description')));
    console.log(chalk.cyan('Tags:        ') + (metadata?.tags?.join(', ') || chalk.dim('None')));
    console.log(chalk.cyan('Created:     ') + (metadata?.createdAt ? new Date(metadata.createdAt).toLocaleString() : chalk.dim('Unknown')));
    console.log(chalk.cyan('Platform:    ') + (metadata?.platform || chalk.dim('Unknown')));
    console.log(chalk.cyan('Claude Ver:  ') + (metadata?.cliVersion || chalk.dim('Unknown')));

    const contents = this.getContents(metadata);
    if (Object.keys(contents).length > 0) {
      console.log('');
      console.log(chalk.bold('Contents:'));
      const contentsLines = this.formatContentsLines(contents, '  ');
      for (const line of contentsLines) {
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
