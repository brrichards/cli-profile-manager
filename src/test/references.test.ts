import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

// Walk up from dist/test/ to the project root
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..', '..');
const OLD_REPO = 'brennanr9/claude-profile-manager';

function collectFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, extensions));
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

describe('repo reference cleanup', () => {
  const extensions = ['.ts', '.mjs', '.json', '.md', '.yml'];
  const files = collectFiles(ROOT, extensions);

  it('no source files reference the old repo', () => {
    const violations: string[] = [];
    for (const file of files) {
      if (file.includes('/test/') || file.includes('package-lock')) continue;
      const content = readFileSync(file, 'utf-8');
      if (content.includes(OLD_REPO)) {
        violations.push(file.replace(ROOT + '/', ''));
      }
    }
    assert.deepStrictEqual(violations, [], `Files still referencing ${OLD_REPO}: ${violations.join(', ')}`);
  });
});
