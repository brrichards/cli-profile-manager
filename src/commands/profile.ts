/**
 * Profile management commands
 * Delegates to provider-specific implementations
 */

import type {
  CLIType,
  SaveProfileOptions,
  LoadProfileOptions,
  DeleteProfileOptions
} from '../types';
import { getProviderFactory } from '../types/factory';

export async function saveProfile(
  name: string,
  provider: CLIType,
  options: SaveProfileOptions
): Promise<void> {
  const factory = getProviderFactory(provider);
  const profileManager = factory.createProfileManager();
  await profileManager.saveProfile(name, options);
}

export async function loadProfile(
  name: string,
  provider: CLIType,
  options: LoadProfileOptions
): Promise<void> {
  const factory = getProviderFactory(provider);
  const profileManager = factory.createProfileManager();
  await profileManager.loadProfile(name, options);
}

export async function listLocalProfiles(provider: CLIType): Promise<void> {
  const factory = getProviderFactory(provider);
  const profileManager = factory.createProfileManager();
  await profileManager.listLocalProfiles();
}

export async function deleteLocalProfile(
  name: string,
  provider: CLIType,
  options: DeleteProfileOptions
): Promise<void> {
  const factory = getProviderFactory(provider);
  const profileManager = factory.createProfileManager();
  await profileManager.deleteLocalProfile(name, options);
}

export async function showProfileInfo(name: string, provider: CLIType): Promise<void> {
  const factory = getProviderFactory(provider);
  const profileManager = factory.createProfileManager();
  await profileManager.showProfileInfo(name);
}
