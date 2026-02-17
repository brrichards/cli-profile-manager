import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('config defaults', () => {
  it('marketplaceRepo defaults to brrichards/cli-profile-manager', async () => {
    const { DEFAULTS } = await import('../src/utils/config.js');
    assert.strictEqual(DEFAULTS.marketplaceRepo, 'brrichards/cli-profile-manager');
  });

  it('getConfig returns the new marketplace repo', async () => {
    const { getConfig } = await import('../src/utils/config.js');
    const config = await getConfig();
    assert.strictEqual(config.marketplaceRepo, 'brrichards/cli-profile-manager');
  });
});
