/**
 * Claude Code CLI Provider Factory
 * Creates Claude-specific manager instances
 */

import { execSync } from 'child_process';
import type { CLIType, IProviderFactory, IProfileManager, IMarketplaceManager, IPublishManager } from '../../types/index.js';
import { ClaudeProfileManager } from './ClaudeProfileManager.js';
import { ClaudeMarketplaceManager } from './ClaudeMarketplaceManager.js';
import { ClaudePublishManager } from './ClaudePublishManager.js';

export class ClaudeProviderFactory implements IProviderFactory {
  getType(): CLIType {
    return 'claude';
  }

  createProfileManager(): IProfileManager {
    return new ClaudeProfileManager();
  }

  createMarketplaceManager(): IMarketplaceManager {
    return new ClaudeMarketplaceManager();
  }

  createPublishManager(): IPublishManager {
    return new ClaudePublishManager();
  }

  async isInstalled(): Promise<boolean> {
    try {
      execSync('claude --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string> {
    try {
      return execSync('claude --version', { encoding: 'utf-8' }).trim();
    } catch {
      return 'unknown';
    }
  }
}
