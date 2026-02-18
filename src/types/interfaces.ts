/**
 * Core interfaces for CLI profile management.
 * Each interface will be implemented separately for Claude Code and GitHub CLI.
 */

export type CLIType = 'claude' | 'github';

// ============================================================================
// Common Types
// ============================================================================

export interface ProfileMetadata {
  name: string;
  provider: CLIType;
  version: string;
  description?: string;
  tags?: string[];
  createdAt: string;
  cliVersion?: string;
  platform: string;
  includesSecrets?: boolean;
  files: string[];
  contents?: Record<string, string[]>;
}

// ============================================================================
// Interface 1: Profile Operations (Local)
// ============================================================================

export interface SaveProfileOptions {
  description?: string;
  tags?: string;
  includeSecrets?: boolean;
}

export interface LoadProfileOptions {
  force?: boolean;
  backup?: boolean;
}

export interface DeleteProfileOptions {
  force?: boolean;
}

/**
 * Interface for local profile operations.
 * Handles saving, loading, listing, deleting, and viewing profile information.
 */
export interface IProfileManager {
  /**
   * Save the current CLI configuration as a profile
   * @param name - Profile name
   * @param options - Save options (description, tags, includeSecrets)
   */
  saveProfile(name: string, options: SaveProfileOptions): Promise<void>;

  /**
   * Load a profile and apply it to the current CLI configuration
   * @param name - Profile name
   * @param options - Load options (force, backup)
   */
  loadProfile(name: string, options: LoadProfileOptions): Promise<void>;

  /**
   * List all locally saved profiles for this CLI
   */
  listLocalProfiles(): Promise<void>;

  /**
   * Delete a local profile
   * @param name - Profile name
   * @param options - Delete options (force)
   */
  deleteLocalProfile(name: string, options: DeleteProfileOptions): Promise<void>;

  /**
   * Show detailed information about a local profile
   * @param name - Profile name
   */
  showProfileInfo(name: string): Promise<void>;
}

// ============================================================================
// Interface 2: Marketplace Operations
// ============================================================================

export interface ListMarketplaceOptions {
  category?: string;
  refresh?: boolean;
}

export interface InstallMarketplaceOptions {
  force?: boolean;
  backup?: boolean;
}

/**
 * Interface for marketplace operations.
 * Handles listing, searching, installing, and viewing marketplace profiles.
 */
export interface IMarketplaceManager {
  /**
   * List profiles available in the marketplace
   * @param options - List options (category filter, refresh cache)
   */
  listMarketplace(options: ListMarketplaceOptions): Promise<void>;

  /**
   * Search the marketplace for profiles
   * @param query - Search query string
   */
  searchMarketplace(query: string): Promise<void>;

  /**
   * Install a profile from the marketplace
   * @param profilePath - Profile path in format "author/profile-name"
   * @param options - Install options (force, backup)
   */
  installFromMarketplace(profilePath: string, options: InstallMarketplaceOptions): Promise<void>;

  /**
   * Show detailed information about a marketplace profile
   * @param profilePath - Profile path in format "author/profile-name"
   */
  showMarketplaceInfo(profilePath: string): Promise<void>;
}

// ============================================================================
// Interface 3: Publishing Operations
// ============================================================================

export interface PublishProfileOptions {
  // Future: add publish-specific options if needed
}

/**
 * Interface for publishing operations.
 * Handles publishing profiles to the marketplace and managing marketplace repository.
 */
export interface IPublishManager {
  /**
   * Publish a local profile to the marketplace
   * @param name - Profile name
   * @param options - Publish options
   */
  publishProfile(name: string, options: PublishProfileOptions): Promise<void>;

  /**
   * Set a custom marketplace repository
   * @param repository - Repository in format "owner/repo"
   */
  setRepository(repository: string): Promise<void>;
}
