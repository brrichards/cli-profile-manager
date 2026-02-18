/**
 * Claude Code CLI Provider Factory
 * Creates Claude-specific manager instances
 */

import { execSync } from 'child_process';
import type { CLIType, IProviderFactory, IProfileManager, IMarketplaceManager, IPublishManager } from '../../types';
import { ClaudeProfileManager } from './ClaudeProfileManager';
import { ClaudeMarketplaceManager } from './ClaudeMarketplaceManager';
import { ClaudePublishManager } from './ClaudePublishManager';

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
