import { describe, it } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'child_process';
import { join } from 'path';

const CLI = join(import.meta.dirname, '..', 'src', 'cli.js');

describe('CLI smoke test', () => {
  it('--help exits 0 and shows expected commands', () => {
    const output = execSync(`node ${CLI} --help`, { encoding: 'utf-8' });
    assert.ok(output.includes('save'), 'should list save command');
    assert.ok(output.includes('load'), 'should list load command');
    assert.ok(output.includes('install'), 'should list install command');
    assert.ok(output.includes('publish'), 'should list publish command');
    assert.ok(output.includes('list'), 'should list list command');
  });

  it('--version outputs a version string', () => {
    const output = execSync(`node ${CLI} --version`, { encoding: 'utf-8' });
    assert.match(output.trim(), /^\d+\.\d+\.\d+$/);
  });
});
