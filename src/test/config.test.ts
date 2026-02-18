import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getConfig, getProfilePath, getConfigDir, configDirExists } from '../utils/config.js';

describe('config defaults', () => {
  it('getConfig returns the default marketplace repo', async () => {
    const config = await getConfig();
    assert.strictEqual(config.marketplaceRepo, 'brrichards/cli-profile-manager');
  });

  it('getConfig returns separate profile directories for each provider', async () => {
    const config = await getConfig();
    assert.ok(config.claudeProfilesDir.endsWith('claude'), 'claude profiles dir should end with claude');
    assert.ok(config.githubProfilesDir.endsWith('github'), 'github profiles dir should end with github');
  });

  it('getConfig returns expected directory structure', async () => {
    const config = await getConfig();
    assert.ok(config.profilesDir, 'should have a profilesDir');
    assert.ok(config.cacheDir, 'should have a cacheDir');
    assert.ok(config.claudeDir, 'should have a claudeDir');
    assert.ok(config.githubDir, 'should have a githubDir');
  });

  it('getProfilePath returns path under the correct provider directory', async () => {
    const claudePath = getProfilePath('my-profile', 'claude');
    const githubPath = getProfilePath('my-profile', 'github');
    assert.ok(claudePath.includes('claude'), 'claude profile path should include claude');
    assert.ok(githubPath.includes('github'), 'github profile path should include github');
  });

  it('getConfigDir returns different dirs for each provider', () => {
    const claudeDir = getConfigDir('claude');
    const githubDir = getConfigDir('github');
    assert.notStrictEqual(claudeDir, githubDir);
  });

  it('configDirExists returns a boolean', () => {
    const result = configDirExists('claude');
    assert.strictEqual(typeof result, 'boolean');
  });
});
