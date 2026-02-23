import { describe, it } from 'node:test';
import assert from 'node:assert';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync, readFileSync } from 'fs';
import { deriveContents, getFilesToArchive, cleanProfileContent, readInstalledPlugins, registerPlugins } from '../providers/claude/snapshot.js';

describe('deriveContents', () => {
  it('categorizes files into correct content buckets', () => {
    const files = [
      'CLAUDE.md',
      'commands/review.md',
      'commands/test-gen.md',
      'hooks/pre-commit.md',
      'mcp.json',
      'skills/debugging/SKILL.md'
    ];

    const contents = deriveContents(files);

    assert.deepStrictEqual(contents.instructions, ['CLAUDE.md']);
    assert.deepStrictEqual(contents.commands, ['review', 'test-gen']);
    assert.deepStrictEqual(contents.hooks, ['pre-commit']);
    assert.deepStrictEqual(contents.mcp, ['mcp.json']);
    assert.deepStrictEqual(contents.skills, ['debugging']);
  });

  it('returns empty object for empty file list', () => {
    const contents = deriveContents([]);
    assert.deepStrictEqual(contents, {});
  });
});

describe('getFilesToArchive', () => {
  it('only includes files matching the allowlist', () => {
    const testDir = join(tmpdir(), `cpm-test-${Date.now()}`);
    mkdirSync(join(testDir, 'commands'), { recursive: true });
    mkdirSync(join(testDir, 'secrets'), { recursive: true });
    writeFileSync(join(testDir, 'CLAUDE.md'), 'instructions');
    writeFileSync(join(testDir, 'commands', 'foo.md'), 'command');
    writeFileSync(join(testDir, 'secrets', 'key.pem'), 'secret');
    writeFileSync(join(testDir, 'settings.json'), 'settings');
    writeFileSync(join(testDir, '.credentials'), 'creds');
    writeFileSync(join(testDir, 'random.txt'), 'not allowed');

    try {
      const files = getFilesToArchive(testDir);
      assert.ok(files.includes('CLAUDE.md'), 'should include CLAUDE.md');
      assert.ok(files.includes('settings.json'), 'should include settings.json');
      assert.ok(files.includes('commands/foo.md'), 'should include commands/foo.md');
      assert.ok(!files.includes('secrets/key.pem'), 'should not include secrets/');
      assert.ok(!files.includes('.credentials'), 'should not include .credentials');
      assert.ok(!files.includes('random.txt'), 'should not include random.txt');
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('excludes all plugin infrastructure files from snapshots', () => {
    const testDir = join(tmpdir(), `cpm-test-infra-${Date.now()}`);
    const pluginsDir = join(testDir, 'plugins');
    mkdirSync(join(pluginsDir, 'cache', 'mkt', 'p', '1.0.0'), { recursive: true });
    mkdirSync(join(pluginsDir, 'marketplaces', 'official'), { recursive: true });
    writeFileSync(join(pluginsDir, 'blocklist.json'), '{}');
    writeFileSync(join(pluginsDir, 'install-counts-cache.json'), '{}');
    writeFileSync(join(pluginsDir, 'installed_plugins.json'), '{}');
    writeFileSync(join(pluginsDir, 'known_marketplaces.json'), '{}');
    writeFileSync(join(pluginsDir, 'cache', 'mkt', 'p', '1.0.0', 'README.md'), 'hi');
    writeFileSync(join(pluginsDir, 'marketplaces', 'official', 'index.json'), '{}');

    try {
      const files = getFilesToArchive(testDir);
      assert.ok(!files.includes('plugins/blocklist.json'), 'should exclude blocklist.json');
      assert.ok(!files.includes('plugins/install-counts-cache.json'), 'should exclude install-counts-cache.json');
      assert.ok(!files.includes('plugins/installed_plugins.json'), 'should exclude installed_plugins.json');
      assert.ok(!files.includes('plugins/known_marketplaces.json'), 'should exclude known_marketplaces.json');
      assert.ok(!files.some(f => f.startsWith('plugins/cache/')), 'should exclude plugins/cache/');
      assert.ok(!files.some(f => f.startsWith('plugins/marketplaces/')), 'should exclude plugins/marketplaces/');
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });
});

describe('cleanProfileContent', () => {
  it('preserves all plugin infrastructure files including .json files', () => {
    const testDir = join(tmpdir(), `cpm-test-clean-${Date.now()}`);
    const pluginsDir = join(testDir, 'plugins');
    mkdirSync(join(pluginsDir, 'cache'), { recursive: true });
    mkdirSync(join(pluginsDir, 'marketplaces'), { recursive: true });
    writeFileSync(join(pluginsDir, 'blocklist.json'), '{}');
    writeFileSync(join(pluginsDir, 'install-counts-cache.json'), '{}');
    writeFileSync(join(pluginsDir, 'installed_plugins.json'), '{}');
    writeFileSync(join(pluginsDir, 'known_marketplaces.json'), '{}');

    try {
      cleanProfileContent(testDir);
      assert.ok(existsSync(join(pluginsDir, 'blocklist.json')), 'should preserve blocklist.json');
      assert.ok(existsSync(join(pluginsDir, 'install-counts-cache.json')), 'should preserve install-counts-cache.json');
      assert.ok(existsSync(join(pluginsDir, 'installed_plugins.json')), 'should preserve installed_plugins.json');
      assert.ok(existsSync(join(pluginsDir, 'known_marketplaces.json')), 'should preserve known_marketplaces.json');
      assert.ok(existsSync(join(pluginsDir, 'cache')), 'should preserve cache/');
      assert.ok(existsSync(join(pluginsDir, 'marketplaces')), 'should preserve marketplaces/');
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });
});

describe('readInstalledPlugins', () => {
  it('reads plugin metadata from installed_plugins.json', () => {
    const testDir = join(tmpdir(), `cpm-test-readplugins-${Date.now()}`);
    const pluginsDir = join(testDir, 'plugins');
    mkdirSync(pluginsDir, { recursive: true });
    writeFileSync(join(pluginsDir, 'installed_plugins.json'), JSON.stringify({
      version: 2,
      plugins: {
        'my-plugin@org-mkt': [{
          scope: 'user',
          installPath: '/some/path',
          version: '1.0.0',
          installedAt: '2026-01-01T00:00:00.000Z',
          lastUpdated: '2026-01-01T00:00:00.000Z'
        }]
      }
    }));

    try {
      const plugins = readInstalledPlugins(testDir);
      assert.strictEqual(plugins.length, 1);
      assert.strictEqual(plugins[0].name, 'my-plugin');
      assert.strictEqual(plugins[0].marketplace, 'org-mkt');
      assert.strictEqual(plugins[0].version, '1.0.0');
      assert.strictEqual(plugins[0].relativePath, 'plugins/cache/org-mkt/my-plugin/1.0.0');
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });
});

describe('registerPlugins', () => {
  it('writes installed_plugins.json to global dir and enabledPlugins to profile dir', () => {
    const globalDir = join(tmpdir(), `cpm-test-global-${Date.now()}`);
    const profileDir = join(tmpdir(), `cpm-test-profile-${Date.now()}`);
    mkdirSync(join(profileDir, 'plugins', 'cache', 'org-mkt', 'my-plugin', '1.0.0'), { recursive: true });
    writeFileSync(join(profileDir, 'plugins', 'cache', 'org-mkt', 'my-plugin', '1.0.0', 'README.md'), 'hi');

    // Point registerPlugins at our test global dir
    const origEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = globalDir;

    try {
      registerPlugins(profileDir, [{
        name: 'my-plugin',
        marketplace: 'org-mkt',
        version: '1.0.0',
        relativePath: 'plugins/cache/org-mkt/my-plugin/1.0.0'
      }]);

      // installed_plugins.json should be in global dir
      const installed = JSON.parse(readFileSync(join(globalDir, 'plugins', 'installed_plugins.json'), 'utf-8'));
      assert.strictEqual(installed.version, 2);
      assert.ok(installed.plugins['my-plugin@org-mkt'], 'should have plugin entry');
      assert.strictEqual(installed.plugins['my-plugin@org-mkt'][0].scope, 'user');
      assert.strictEqual(installed.plugins['my-plugin@org-mkt'][0].installPath, join(globalDir, 'plugins', 'cache', 'org-mkt', 'my-plugin', '1.0.0'));

      // Plugin cache files should be copied to global dir
      assert.ok(existsSync(join(globalDir, 'plugins', 'cache', 'org-mkt', 'my-plugin', '1.0.0', 'README.md')), 'should copy cache files to global dir');

      // enabledPlugins should be in profile dir
      const settings = JSON.parse(readFileSync(join(profileDir, 'settings.json'), 'utf-8'));
      assert.strictEqual(settings.enabledPlugins['my-plugin@org-mkt'], true);
    } finally {
      process.env.CLAUDE_CONFIG_DIR = origEnv;
      if (origEnv === undefined) delete process.env.CLAUDE_CONFIG_DIR;
      rmSync(globalDir, { recursive: true, force: true });
      rmSync(profileDir, { recursive: true, force: true });
    }
  });
});
