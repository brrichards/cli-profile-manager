/**
 * Factory interface for creating CLI-specific manager instances
 */

import { CLIType } from './interfaces.js';
import { IProfileManager, IMarketplaceManager, IPublishManager } from './interfaces.js';
import { ClaudeProviderFactory } from '../providers/claude/index.js';

/**
 * Provider factory that creates CLI-specific implementations
 * of the three core interfaces
 */
export interface IProviderFactory {
  /**
   * Get the CLI type this factory creates providers for
   */
  getType(): CLIType;

  /**
   * Create a profile manager for this CLI
   */
  createProfileManager(): IProfileManager;

  /**
   * Create a marketplace manager for this CLI
   */
  createMarketplaceManager(): IMarketplaceManager;

  /**
   * Create a publish manager for this CLI
   */
  createPublishManager(): IPublishManager;

  /**
   * Check if the CLI is installed
   */
  isInstalled(): Promise<boolean>;

  /**
   * Get the CLI version
   */
  getVersion(): Promise<string>;
}

/**
 * Get the appropriate provider factory based on CLI type
 */
export function getProviderFactory(type: CLIType): IProviderFactory {
  // Lazy load to avoid circular dependencies
  if (type === 'claude') {
    return new ClaudeProviderFactory();
  } else if (type === 'github') {
    // GitHub provider will be implemented later
    throw new Error('GitHub provider not implemented yet');
  } else {
    throw new Error(`Unknown provider type: ${type}`);
  }
}
