import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

describe('mobile readability', () => {
  it('every text below 12px has a 12px minimum on mobile (max-lg:text-xs or larger)', () => {
    const offenders: string[] = [];
    for (const file of sources(root)) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        // desktop-only elements (hidden lg:...) are not shown on mobile
        if (/text-\[(\d|1[01])px\]/.test(line) && !/max-lg:text-(xs|sm|base)/.test(line) && !/hidden lg:/.test(line)) {
          offenders.push(`${file.replace(root, 'src')}:${i + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it('bottom navigation: no truncated label, safe-area padding', () => {
    const nav = readFileSync(join(root, 'shared/ui/layout/bottom-nav.tsx'), 'utf8');
    expect(nav).not.toMatch(/truncate/);
    expect(nav).not.toMatch(/text-\[10px\]/);
    expect(nav).toMatch(/safe-area-inset-bottom/);
  });
});
