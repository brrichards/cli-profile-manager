/**
 * GitHub Copilot CLI Provider Factory
 * Creates GitHub-specific manager instances
 */

import { execSync } from 'child_process';
import type { CLIType, IProviderFactory, IProfileManager, IMarketplaceManager, IPublishManager } from '../../types/index.js';
import { GitHubProfileManager } from './GitHubProfileManager.js';
import { GitHubMarketplaceManager } from './GitHubMarketplaceManager.js';
import { GitHubPublishManager } from './GitHubPublishManager.js';

export class GitHubProviderFactory implements IProviderFactory {
  getType(): CLIType {
    return 'github';
  }

  createProfileManager(): IProfileManager {
    return new GitHubProfileManager();
  }

  createMarketplaceManager(): IMarketplaceManager {
    return new GitHubMarketplaceManager();
  }

  createPublishManager(): IPublishManager {
    return new GitHubPublishManager();
  }

  async isInstalled(): Promise<boolean> {
    try {
      execSync('gh --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string> {
    try {
      return execSync('gh --version', { encoding: 'utf-8' }).trim().split('\n')[0];
    } catch {
      return 'unknown';
    }
  }
}
