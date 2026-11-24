import { test, expect, gotoOk } from './lib/fixtures';
import { loginWithFreshAccount } from './lib/steps';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Tests de singe : clics, saisies et navigations aléatoires (graine fixe => rejouable) sur la recette, compte de test.
// Hors du passage normal : MONKEY=1 npx playwright test monkey  (MONKEY_SEEDS=1,2,3  MONKEY_STEPS=120  MONKEY_OUT=dossier)
// Les saisies texte sont préfixées e2e- : le nettoyage les rattrape (le compte e2e- créé emporte le reste en cascade).

const ROUTES = [
  '/', '/accounts', '/transactions', '/transactions/import', '/analyses', '/budgets', '/budgets/fixed',
  '/echeances', '/settings', '/categories', '/tags', '/smart-rules', '/recurring',
];
const TEXTS = ['', ' ', 'e2e-monkey', 'e2e-' + 'x'.repeat(300), "e2e-l'apostrophe \"guillemets\"", 'e2e-<b>html</b><script>alert(1)</script>',
  'e2e-😀🧾€', 'e2e-%s%d{{x}}${x}', 'e2e-‮rtl'];
const NUMBERS = ['0', '-0', '-12,34', '12.345', '1e999', '-99999999999', '999999999999999', 'abc', '0,001', '--1', '١٢٣', ' 5 ', ''];
const DATES = ['', '1900-01-01', '2999-12-31', '2026-02-30', 'not-a-date'];
const EXCLUDED = /déconnexion|logout|se déconnecter/i;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const seeds = (process.env.MONKEY_SEEDS ?? '1').split(',').map(Number);
const steps = Number(process.env.MONKEY_STEPS ?? 120);
const outDir = process.env.MONKEY_OUT ?? 'test-results/monkey';

for (const seed of seeds) {
  test(`singe graine ${seed}`, async ({ page, baseURL }) => {
    test.skip(!process.env.MONKEY, 'MONKEY=1 pour lancer les tests de singe');
    test.setTimeout(steps * 8_000 + 120_000);
    const rand = rng(seed);
    const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
    const log: string[] = [];
    const issues: { step: number; kind: string; detail: string; url: string; recent: string[] }[] = [];
    let step = 0;
    const issue = (kind: string, detail: string) => issues.push({ step, kind, detail: detail.slice(0, 500), url: page.url(), recent: log.slice(-6) });

    page.on('pageerror', (e) => issue('pageerror', e.message));
    page.on('console', (m) => { if (m.type() === 'error') issue('console.error', m.text()); });
    page.on('response', (r) => {
      const u = r.url();
      if (r.status() >= 500) issue(`http ${r.status()}`, `${r.request().method()} ${u}`);
      else if (r.status() >= 400 && /cloudfunctions|supabase\.co\/(rest|rpc)/.test(u) && r.status() !== 401) issue(`http ${r.status()}`, `${r.request().method()} ${u}`);
    });
    page.on('dialog', (d) => { log.push(`dialog ${d.type()} « ${d.message().slice(0, 60)} » → ${rand() < 0.5 ? 'accept' : 'dismiss'}`); (rand() < 0.5 ? d.accept() : d.dismiss()).catch(() => {}); });

    await loginWithFreshAccount(page);
    const origin = new URL(baseURL!).origin;

    for (step = 1; step <= steps; step++) {
      const r = rand();
      try {
        if (r < 0.2 || !page.url().startsWith(origin)) {
          const route = pick(ROUTES);
          log.push(`goto ${route}`);
          await gotoOk(page, route);
        } else if (r < 0.65) {
          const els = await page.locator('button:visible:not([disabled]), a[href]:visible, [role="tab"]:visible, [role="checkbox"]:visible, [role="switch"]:visible, [role="combobox"]:visible, [role="option"]:visible, [role="menuitem"]:visible, input[type="checkbox"]:visible').all();
          if (!els.length) { log.push('rien à cliquer'); continue; }
          const el = pick(els);
          const name = ((await el.getAttribute('aria-label').catch(() => null)) || (await el.innerText({ timeout: 1000 }).catch(() => '')) || '').trim().slice(0, 50);
          const href = await el.getAttribute('href').catch(() => null);
          if (EXCLUDED.test(name) || (href && /^https?:/.test(href) && !href.startsWith(origin)) || (await el.getAttribute('download').catch(() => null)) !== null) { log.push(`ignore « ${name} »`); continue; }
          log.push(`clic « ${name || href || '?'} »`);
          await el.click({ timeout: 3000 });
        } else if (r < 0.92) {
          const inputs = await page.locator('input:visible:not([disabled]):not([readonly]):not([type=file]):not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea:visible').all();
          if (!inputs.length) { log.push('rien à saisir'); continue; }
          const el = pick(inputs);
          const type = (await el.getAttribute('type')) ?? 'text';
          const label = (await el.getAttribute('aria-label')) || (await el.getAttribute('name')) || (await el.getAttribute('id')) || type;
          const value = type === 'number' || /montant|amount/i.test(label) ? pick(NUMBERS)
            : type === 'date' ? pick(DATES)
            : type === 'email' ? 'e2e-monkey@example.invalid'
            : type === 'password' ? 'e2e-monkey'
            : pick(TEXTS);
          log.push(`saisie ${label} (${type}) = ${JSON.stringify(value.slice(0, 40))}`);
          await el.fill(value, { timeout: 3000 }).catch(async () => { await el.click({ timeout: 2000 }); await page.keyboard.type(value.slice(0, 40)); });
          if (rand() < 0.4) { log.push('Enter'); await page.keyboard.press('Enter'); }
        } else {
          const key = pick(['Escape', 'Enter', 'Tab', 'Tab', 'ArrowDown', 'Space']);
          log.push(`touche ${key}`);
          await page.keyboard.press(key);
        }
        await page.waitForTimeout(400);
        const body = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
        if (/Application error|client-side exception|Internal Server Error|Something went wrong|Une erreur est survenue|Unhandled Runtime Error/i.test(body))
          issue('écran d’erreur', body.slice(0, 300));
        if (/NaN|undefined|\[object Object\]|Infinity/.test(body))
          issue('valeur suspecte affichée', (body.match(/.{0,60}(NaN|undefined|\[object Object\]|Infinity).{0,60}/)?.[0] ?? '').replace(/\s+/g, ' '));
      } catch (e) {
        const msg = String(e);
        // Clic ou saisie qui échoue (élément détaché, recouvert) : bruit du singe, pas un bug.
        if (!/Timeout|detached|not attached|intercepts pointer|not visible|not an <input>|Target closed|not editable/i.test(msg)) issue('exception', msg);
        log.push(`  ↳ échec action : ${msg.split('\n')[0].slice(0, 80)}`);
      }
      if (/\/login/.test(page.url())) { issue('déconnecté', 'retour sur /login pendant le parcours'); break; }
    }

    fs.mkdirSync(outDir, { recursive: true });
    // Regroupe les doublons (même type + détail) pour un rapport lisible.
    const grouped = new Map<string, (typeof issues)[number] & { count: number }>();
    for (const i of issues) { const k = `${i.kind}|${i.detail}`; const g = grouped.get(k); if (g) g.count++; else grouped.set(k, { ...i, count: 1 }); }
    fs.writeFileSync(path.join(outDir, `seed-${seed}.json`), JSON.stringify({ seed, steps, issues: [...grouped.values()], log }, null, 2));
    expect([...grouped.values()].map((i) => `${i.kind}: ${i.detail.slice(0, 120)}`), `voir ${outDir}/seed-${seed}.json`).toEqual([]);
  });
}
