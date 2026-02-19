import { describe, it } from 'node:test';
import assert from 'node:assert';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { deriveContents, getFilesToArchive } from '../providers/claude/snapshot.js';

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
    writeFileSync(join(testDir, '.credentials'), 'creds');
    writeFileSync(join(testDir, 'random.txt'), 'not allowed');

    try {
      const files = getFilesToArchive(testDir);
      assert.ok(files.includes('CLAUDE.md'), 'should include CLAUDE.md');
      assert.ok(files.includes('commands/foo.md'), 'should include commands/foo.md');
      assert.ok(!files.includes('secrets/key.pem'), 'should not include secrets/');
      assert.ok(!files.includes('.credentials'), 'should not include .credentials');
      assert.ok(!files.includes('random.txt'), 'should not include random.txt');
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });
});
