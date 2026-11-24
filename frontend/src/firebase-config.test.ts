import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// La fonction SSR générée par firebase-tools (256 Mo par défaut) dépasse sa mémoire sous navigation soutenue (500/503).
const MIN_MEMORY_MIB = 512;

describe('firebase.json : fonction de rendu serveur Next', () => {
  it(`alloue au moins ${MIN_MEMORY_MIB} MiB (hosting.frameworksBackend.memory)`, () => {
    const path = resolve(process.cwd(), '../firebase.json'); // vitest tourne depuis frontend/
    const config = JSON.parse(readFileSync(path, 'utf8'));
    const memory: string | undefined = config.hosting?.frameworksBackend?.memory;
    const mib = memory?.endsWith('GiB')
      ? parseInt(memory, 10) * 1024
      : memory?.endsWith('MiB')
        ? parseInt(memory, 10)
        : 256; // défaut firebase-tools
    expect(mib).toBeGreaterThanOrEqual(MIN_MEMORY_MIB);
  });

  it('construit la codebase backend avant chaque deploy (functions[].predeploy)', () => {
    // Sans predeploy, firebase-tools envoie functions/dist tel qu'il est sur le disque (périmé).
    const path = resolve(process.cwd(), '../firebase.json');
    const config = JSON.parse(readFileSync(path, 'utf8'));
    const backend = config.functions?.find((f: { codebase?: string }) => f.codebase === 'backend');
    const predeploy: string[] = [].concat(backend?.predeploy ?? []);
    expect(predeploy.some((cmd) => /\brun build\b/.test(cmd))).toBe(true);
  });
});
