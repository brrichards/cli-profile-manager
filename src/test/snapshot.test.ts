import { describe, it } from 'node:test';
import assert from 'node:assert';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync, readFileSync } from 'fs';
import { deriveContents, getFilesToArchive, cleanProfileContent, readInstalledPlugins, registerPlugins, unregisterCpmPlugins } from '../providers/claude/snapshot.js';
import { PLUGIN_INFRA_DIRS } from '../providers/claude/constants.js';

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

    // Create every entry from PLUGIN_INFRA_DIRS as either a dir or file
    for (const entry of PLUGIN_INFRA_DIRS) {
      if (entry.endsWith('.json')) {
        mkdirSync(pluginsDir, { recursive: true });
        writeFileSync(join(pluginsDir, entry), '{}');
      } else {
        mkdirSync(join(pluginsDir, entry, 'nested'), { recursive: true });
        writeFileSync(join(pluginsDir, entry, 'nested', 'file.txt'), 'content');
      }
    }

    try {
      const files = getFilesToArchive(testDir);
      for (const entry of PLUGIN_INFRA_DIRS) {
        assert.ok(!files.some(f => f === `plugins/${entry}` || f.startsWith(`plugins/${entry}/`)),
          `should exclude plugins/${entry}`);
      }
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });
});

describe('cleanProfileContent', () => {
  it('preserves all plugin infrastructure files including .json files', () => {
    const testDir = join(tmpdir(), `cpm-test-clean-${Date.now()}`);
    const pluginsDir = join(testDir, 'plugins');

    // Create every entry from PLUGIN_INFRA_DIRS
    for (const entry of PLUGIN_INFRA_DIRS) {
      if (entry.endsWith('.json')) {
        mkdirSync(pluginsDir, { recursive: true });
        writeFileSync(join(pluginsDir, entry), '{}');
      } else {
        mkdirSync(join(pluginsDir, entry), { recursive: true });
      }
    }

    try {
      cleanProfileContent(testDir);
      for (const entry of PLUGIN_INFRA_DIRS) {
        assert.ok(existsSync(join(pluginsDir, entry)), `should preserve ${entry}`);
      }
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
  it('writes installed_plugins.json and cache files to global dir', () => {
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

      // settings.json should NOT be modified by registerPlugins (enabledPlugins is handled by settings.json being part of the profile)
      assert.ok(!existsSync(join(profileDir, 'settings.json')), 'should not create settings.json');
    } finally {
      process.env.CLAUDE_CONFIG_DIR = origEnv;
      if (origEnv === undefined) delete process.env.CLAUDE_CONFIG_DIR;
      rmSync(globalDir, { recursive: true, force: true });
      rmSync(profileDir, { recursive: true, force: true });
    }
  });

  it('writes cpm_installed_plugins.json manifest after registration', () => {
    const globalDir = join(tmpdir(), `cpm-test-manifest-${Date.now()}`);
    const profileDir = join(tmpdir(), `cpm-test-profile-${Date.now()}`);
    mkdirSync(join(profileDir, 'plugins', 'cache', 'org-mkt', 'my-plugin', '1.0.0'), { recursive: true });
    writeFileSync(join(profileDir, 'plugins', 'cache', 'org-mkt', 'my-plugin', '1.0.0', 'README.md'), 'hi');

    const origEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = globalDir;

    try {
      registerPlugins(profileDir, [{
        name: 'my-plugin',
        marketplace: 'org-mkt',
        version: '1.0.0',
        relativePath: 'plugins/cache/org-mkt/my-plugin/1.0.0'
      }]);

      const manifestPath = join(globalDir, 'plugins', 'cpm_installed_plugins.json');
      assert.ok(existsSync(manifestPath), 'manifest should exist after registerPlugins');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      assert.deepStrictEqual(manifest.plugins, ['my-plugin@org-mkt']);
    } finally {
      process.env.CLAUDE_CONFIG_DIR = origEnv;
      if (origEnv === undefined) delete process.env.CLAUDE_CONFIG_DIR;
      rmSync(globalDir, { recursive: true, force: true });
      rmSync(profileDir, { recursive: true, force: true });
    }
  });

  it('does not include version-skipped plugins in manifest', () => {
    const globalDir = join(tmpdir(), `cpm-test-vskip-${Date.now()}`);
    const profileDir = join(tmpdir(), `cpm-test-profile-${Date.now()}`);
    mkdirSync(join(profileDir, 'plugins', 'cache', 'mkt', 'my-plugin', '1.0.0'), { recursive: true });
    writeFileSync(join(profileDir, 'plugins', 'cache', 'mkt', 'my-plugin', '1.0.0', 'index.js'), '');

    // Pre-existing newer version in global dir
    mkdirSync(join(globalDir, 'plugins'), { recursive: true });
    writeFileSync(join(globalDir, 'plugins', 'installed_plugins.json'), JSON.stringify({
      version: 2,
      plugins: {
        'my-plugin@mkt': [{ scope: 'user', installPath: '/x', version: '2.0.0', installedAt: '', lastUpdated: '' }]
      }
    }));

    const origEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = globalDir;

    try {
      registerPlugins(profileDir, [{
        name: 'my-plugin', marketplace: 'mkt', version: '1.0.0',
        relativePath: 'plugins/cache/mkt/my-plugin/1.0.0'
      }]);

      // Newer version should be preserved
      const installed = JSON.parse(readFileSync(join(globalDir, 'plugins', 'installed_plugins.json'), 'utf-8'));
      assert.strictEqual(installed.plugins['my-plugin@mkt'][0].version, '2.0.0', 'should keep newer version');

      // Manifest should NOT include the skipped plugin
      const manifest = JSON.parse(readFileSync(join(globalDir, 'plugins', 'cpm_installed_plugins.json'), 'utf-8'));
      assert.deepStrictEqual(manifest.plugins, [], 'manifest should not include version-skipped plugins');
    } finally {
      process.env.CLAUDE_CONFIG_DIR = origEnv;
      if (origEnv === undefined) delete process.env.CLAUDE_CONFIG_DIR;
      rmSync(globalDir, { recursive: true, force: true });
      rmSync(profileDir, { recursive: true, force: true });
    }
  });
});

describe('unregisterCpmPlugins', () => {
  it('removes tracked plugins from installed_plugins.json and deletes cache dirs', () => {
    const globalDir = join(tmpdir(), `cpm-test-unreg-${Date.now()}`);
    const pluginsDir = join(globalDir, 'plugins');
    const cpmCacheDir = join(pluginsDir, 'cache', 'mkt', 'cpm-plugin', '1.0.0');
    const userCacheDir = join(pluginsDir, 'cache', 'mkt', 'user-plugin', '1.0.0');
    mkdirSync(cpmCacheDir, { recursive: true });
    mkdirSync(userCacheDir, { recursive: true });
    writeFileSync(join(cpmCacheDir, 'index.js'), '');
    writeFileSync(join(userCacheDir, 'index.js'), '');

    // installed_plugins.json has both CPM and user plugins
    writeFileSync(join(pluginsDir, 'installed_plugins.json'), JSON.stringify({
      version: 2,
      plugins: {
        'cpm-plugin@mkt': [{ scope: 'user', installPath: cpmCacheDir, version: '1.0.0', installedAt: '', lastUpdated: '' }],
        'user-plugin@mkt': [{ scope: 'user', installPath: userCacheDir, version: '1.0.0', installedAt: '', lastUpdated: '' }]
      }
    }));

    // CPM manifest tracks only the CPM plugin
    writeFileSync(join(pluginsDir, 'cpm_installed_plugins.json'), JSON.stringify({
      plugins: ['cpm-plugin@mkt']
    }));

    const origEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = globalDir;

    try {
      unregisterCpmPlugins();

      // User plugin should remain
      const installed = JSON.parse(readFileSync(join(pluginsDir, 'installed_plugins.json'), 'utf-8'));
      assert.ok(installed.plugins['user-plugin@mkt'], 'user plugin should remain');
      assert.ok(!installed.plugins['cpm-plugin@mkt'], 'CPM plugin should be removed');

      // CPM cache dir should be deleted
      assert.ok(!existsSync(cpmCacheDir), 'CPM plugin cache dir should be deleted');
      // User cache dir should remain
      assert.ok(existsSync(userCacheDir), 'user plugin cache dir should remain');

      // Manifest should be cleared
      const manifest = JSON.parse(readFileSync(join(pluginsDir, 'cpm_installed_plugins.json'), 'utf-8'));
      assert.deepStrictEqual(manifest.plugins, []);
    } finally {
      process.env.CLAUDE_CONFIG_DIR = origEnv;
      if (origEnv === undefined) delete process.env.CLAUDE_CONFIG_DIR;
      rmSync(globalDir, { recursive: true, force: true });
    }
  });

  it('is a no-op when no manifest exists', () => {
    const globalDir = join(tmpdir(), `cpm-test-noop-${Date.now()}`);
    const pluginsDir = join(globalDir, 'plugins');
    mkdirSync(pluginsDir, { recursive: true });

    writeFileSync(join(pluginsDir, 'installed_plugins.json'), JSON.stringify({
      version: 2,
      plugins: { 'user-plugin@mkt': [{ scope: 'user', installPath: '/x', version: '1.0.0', installedAt: '', lastUpdated: '' }] }
    }));

    const origEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = globalDir;

    try {
      unregisterCpmPlugins();

      // installed_plugins.json should be unchanged
      const installed = JSON.parse(readFileSync(join(pluginsDir, 'installed_plugins.json'), 'utf-8'));
      assert.ok(installed.plugins['user-plugin@mkt'], 'user plugin should remain unchanged');
    } finally {
      process.env.CLAUDE_CONFIG_DIR = origEnv;
      if (origEnv === undefined) delete process.env.CLAUDE_CONFIG_DIR;
      rmSync(globalDir, { recursive: true, force: true });
    }
  });
});

describe('CPM plugin tracking round-trip', () => {
  it('switching from Profile A to Profile B removes A plugins and installs B plugins', () => {
    const globalDir = join(tmpdir(), `cpm-test-roundtrip-${Date.now()}`);
    const profileDirA = join(tmpdir(), `cpm-test-profA-${Date.now()}`);
    const profileDirB = join(tmpdir(), `cpm-test-profB-${Date.now()}`);

    // Profile A has plugin-x and plugin-y
    mkdirSync(join(profileDirA, 'plugins', 'cache', 'mkt', 'plugin-x', '1.0.0'), { recursive: true });
    mkdirSync(join(profileDirA, 'plugins', 'cache', 'mkt', 'plugin-y', '1.0.0'), { recursive: true });
    writeFileSync(join(profileDirA, 'plugins', 'cache', 'mkt', 'plugin-x', '1.0.0', 'index.js'), '');
    writeFileSync(join(profileDirA, 'plugins', 'cache', 'mkt', 'plugin-y', '1.0.0', 'index.js'), '');

    // Profile B has plugin-z
    mkdirSync(join(profileDirB, 'plugins', 'cache', 'mkt', 'plugin-z', '2.0.0'), { recursive: true });
    writeFileSync(join(profileDirB, 'plugins', 'cache', 'mkt', 'plugin-z', '2.0.0', 'index.js'), '');

    const origEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = globalDir;

    try {
      // Install Profile A
      registerPlugins(profileDirA, [
        { name: 'plugin-x', marketplace: 'mkt', version: '1.0.0', relativePath: 'plugins/cache/mkt/plugin-x/1.0.0' },
        { name: 'plugin-y', marketplace: 'mkt', version: '1.0.0', relativePath: 'plugins/cache/mkt/plugin-y/1.0.0' }
      ]);

      // Verify Profile A is installed
      let installed = JSON.parse(readFileSync(join(globalDir, 'plugins', 'installed_plugins.json'), 'utf-8'));
      assert.ok(installed.plugins['plugin-x@mkt'], 'plugin-x should be installed');
      assert.ok(installed.plugins['plugin-y@mkt'], 'plugin-y should be installed');

      // Switch to Profile B: unregister old, register new
      unregisterCpmPlugins();
      registerPlugins(profileDirB, [
        { name: 'plugin-z', marketplace: 'mkt', version: '2.0.0', relativePath: 'plugins/cache/mkt/plugin-z/2.0.0' }
      ]);

      // Only Profile B plugin should remain
      installed = JSON.parse(readFileSync(join(globalDir, 'plugins', 'installed_plugins.json'), 'utf-8'));
      assert.ok(!installed.plugins['plugin-x@mkt'], 'plugin-x should be removed');
      assert.ok(!installed.plugins['plugin-y@mkt'], 'plugin-y should be removed');
      assert.ok(installed.plugins['plugin-z@mkt'], 'plugin-z should be installed');

      // Profile A cache dirs should be gone (version-specific dirs that installPath points to)
      assert.ok(!existsSync(join(globalDir, 'plugins', 'cache', 'mkt', 'plugin-x', '1.0.0')), 'plugin-x cache should be deleted');
      assert.ok(!existsSync(join(globalDir, 'plugins', 'cache', 'mkt', 'plugin-y', '1.0.0')), 'plugin-y cache should be deleted');

      // Manifest should reflect Profile B
      const manifest = JSON.parse(readFileSync(join(globalDir, 'plugins', 'cpm_installed_plugins.json'), 'utf-8'));
      assert.deepStrictEqual(manifest.plugins, ['plugin-z@mkt']);
    } finally {
      process.env.CLAUDE_CONFIG_DIR = origEnv;
      if (origEnv === undefined) delete process.env.CLAUDE_CONFIG_DIR;
      rmSync(globalDir, { recursive: true, force: true });
      rmSync(profileDirA, { recursive: true, force: true });
      rmSync(profileDirB, { recursive: true, force: true });
    }
  });
});

