import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '..');
const OLD_REPO = 'brennanr9/claude-profile-manager';

function collectFiles(dir, extensions) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, extensions));
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

describe('repo reference cleanup', () => {
  const extensions = ['.js', '.mjs', '.json', '.md', '.yml'];
  const files = collectFiles(ROOT, extensions);

  it('no source files reference the old repo', () => {
    const violations = [];
    for (const file of files) {
      // Skip test files themselves and package-lock
      if (file.includes('/test/') || file.includes('package-lock')) continue;
      const content = readFileSync(file, 'utf-8');
      if (content.includes(OLD_REPO)) {
        violations.push(file.replace(ROOT + '/', ''));
      }
    }
    assert.deepStrictEqual(violations, [], `Files still referencing ${OLD_REPO}: ${violations.join(', ')}`);
  });
});
