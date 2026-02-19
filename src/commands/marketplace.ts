/**
 * Marketplace commands
 * Delegates to provider-specific implementations
 */

import type {
  CLIType,
  ListMarketplaceOptions,
  InstallMarketplaceOptions
} from '../types/index.js';
import { getProviderFactory } from '../types/factory.js';

export async function listMarketplace(
  provider: CLIType,
  options: ListMarketplaceOptions
): Promise<void> {
  const factory = getProviderFactory(provider);
  const marketplaceManager = factory.createMarketplaceManager();
  await marketplaceManager.listMarketplace(options);
}

export async function searchMarketplace(provider: CLIType, query: string): Promise<void> {
  const factory = getProviderFactory(provider);
  const marketplaceManager = factory.createMarketplaceManager();
  await marketplaceManager.searchMarketplace(query);
}

export async function installFromMarketplace(
  provider: CLIType,
  profilePath: string,
  options: InstallMarketplaceOptions
): Promise<void> {
  const factory = getProviderFactory(provider);
  const marketplaceManager = factory.createMarketplaceManager();
  await marketplaceManager.installFromMarketplace(profilePath, options);
}

export async function showMarketplaceInfo(provider: CLIType, profilePath: string): Promise<void> {
  const factory = getProviderFactory(provider);
  const marketplaceManager = factory.createMarketplaceManager();
  await marketplaceManager.showMarketplaceInfo(profilePath);
}
