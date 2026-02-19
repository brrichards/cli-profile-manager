/**
 * Publishing commands
 * Delegates to provider-specific implementations
 */

import type { CLIType, PublishProfileOptions } from '../types/index.js';
import { getProviderFactory } from '../types/factory.js';

export async function publishProfile(
  name: string,
  provider: CLIType,
  options: PublishProfileOptions
): Promise<void> {
  const factory = getProviderFactory(provider);
  const publishManager = factory.createPublishManager();
  await publishManager.publishProfile(name, options);
}

export async function setRepository(repository: string): Promise<void> {
  // Repository setting is provider-agnostic for now
  // Could be made provider-specific in the future if needed
  const factory = getProviderFactory('claude');
  const publishManager = factory.createPublishManager();
  await publishManager.setRepository(repository);
}
