import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const metadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const options = Object.fromEntries(process.argv.slice(2).filter(value => value !== '--').map(value => {
  assert.match(value, /^--(?:browser|output|screenshots)=.+$/, 'Unknown browser-check option');
  return value.slice(2).split(/=(.*)/s).slice(0, 2);
}));
const engines = { chromium, firefox, webkit };
const selected = options.browser ? [options.browser] : Object.keys(engines);
assert.ok(selected.every(name => engines[name]), 'Use chromium, firefox or webkit');
const work = await mkdtemp(join(tmpdir(), 'lanes-browser-'));
const results = [];
const heights = [210, 100, 150, 120, 215, 105, 165, 130, 195];
const colors = ['#79a7db', '#8ac9b0', '#e5bb6f', '#de9693', '#b0a0d2', '#7ebec9', '#acbe7d', '#d4a377', '#94a3ba'];
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) <= 1, `${message}: ${actual} vs ${expected}`);

async function geometry(page) {
  return page.evaluate(() => {
    const container = document.querySelector('.ehven-lanes');
    const outer = container.getBoundingClientRect();
    const style = getComputedStyle(container);
    const boxes = [...container.children].filter(item => getComputedStyle(item).display !== 'none').map(item => {
      const box = item.getBoundingClientRect();
      return { id: item.id, x: box.x - outer.x, y: box.y - outer.y, width: box.width, height: box.height, fragments: item.getClientRects().length };
    });
    return { display: style.display, gap: parseFloat(style.columnGap), width: outer.width, boxes,
      native: CSS.supports('display', 'grid-lanes'), cyclic: CSS.supports('fit-tolerance', 'infinite') || CSS.supports('flow-tolerance', 'infinite'),
      fit: style.getPropertyValue('fit-tolerance'), flow: style.getPropertyValue('flow-tolerance') };
  });
}

function checkOrdered(value, columns, cyclic, rtl = false) {
  const { boxes, gap } = value;
  for (let i = 0; i < boxes.length; i++) {
    const card = boxes[i];
    assert.equal(card.fragments, 1, 'Cards cannot fragment');
    assert.ok(card.x >= -1 && card.x + card.width <= value.width + 1, 'Card stays inside container');
    if (i < columns) near(card.y, 0, 'First group starts at top');
    if (i % columns) near(card.x, boxes[i - 1].x + (rtl ? -1 : 1) * (card.width + gap), 'Consecutive cards advance across columns');
    if (i >= columns) {
      near(card.x, boxes[i - columns].x, 'Column cycle is stable');
      const previous = boxes[i - columns];
      const previousRow = boxes.slice((Math.floor(i / columns) - 1) * columns, Math.floor(i / columns) * columns);
      const expected = cyclic ? previous.y + previous.height + gap : Math.max(...previousRow.map(item => item.y + item.height)) + gap;
      near(card.y, expected, cyclic ? 'Card stacks below its own column predecessor (A)' : 'Row clears its tallest predecessor (B)');
    }
  }
}

async function fixture(page, css, mode, rtl = false) {
  const attribute = mode ? ` data-ehven-lanes-order="${mode}"` : '';
  const cards = heights.map((height, i) => `<article id="card-${i + 1}" tabindex="0" aria-label="Card ${i + 1}" style="height:${height}px;background:${colors[i]}"></article>`).join('');
  await page.setContent(`<html lang="en" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>body{margin:34px;font:16px sans-serif}article{box-sizing:border-box;border-radius:10px} .ehven-lanes{width:650px;--ehven-lanes-lane-minimum:180px;--ehven-lanes-gap:22px}${css}</style></head><body><div class="ehven-lanes"${attribute}>${cards}</div></body></html>`);
}

try {
  const response = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--offline', '--json', '--pack-destination', work], { cwd: root, encoding: 'utf8', timeout: 30000 }));
  const entries = Array.isArray(response) ? response : Object.values(response);
  assert.equal(entries.length, 1);
  const packed = entries[0];
  assert.ok(packed.size <= 8 * 1024, 'Packed budget: 8 KiB');
  assert.ok(packed.unpackedSize <= 24 * 1024, 'Unpacked budget: 24 KiB');
  await writeFile(join(work, 'package.json'), '{"private":true}');
  execFileSync('npm', ['install', '--ignore-scripts', '--offline', '--no-audit', '--no-fund', '--no-package-lock', join(work, packed.filename)], { cwd: work, timeout: 30000, stdio: 'pipe' });
  const require = createRequire(join(work, 'package.json'));
  const variants = await Promise.all(['lanes.css', 'lanes.min.css'].map(async name => ({ name, css: await readFile(require.resolve('@ehven/lanes/' + name), 'utf8') })));
  const legacy = await readFile(join(root, 'qa/fixtures/legacy.css'), 'utf8');
  for (const name of selected) {
    const browser = await engines[name].launch();
    try {
      const context = await browser.newContext({ viewport: { width: 760, height: 850 } });
      let requests = 0;
      context.on('request', () => requests++);
      const page = await context.newPage();
      const observations = [];
      for (const variant of variants) {
        await fixture(page, variant.css, '');
        const defaults = await geometry(page);
        await page.locator('.ehven-lanes').evaluate(element => { element.classList.remove('ehven-lanes'); element.removeAttribute('style'); });
        assert.equal(await page.locator('body > div').evaluate(element => getComputedStyle(element).display), 'block', 'Removing the class removes package layout');
        assert.equal(await page.locator('body > div').evaluate(element => element.children.length), heights.length, 'Removal preserves consumer content');
        await fixture(page, legacy, '');
        assert.deepEqual((await geometry(page)).boxes, defaults.boxes, 'Unconfigured legacy layout geometry stays unchanged');
        await fixture(page, variant.css, 'unknown');
        assert.deepEqual((await geometry(page)).boxes, defaults.boxes, 'Unknown mode retains the existing default');
        for (const forcedFallback of [false, true]) {
          const css = forcedFallback ? variant.css.replace(/@supports\s*\(display:\s*grid-lanes\)/g, '@supports (display: unavailable-lanes-test)') : variant.css;
          for (const mode of ['horizontal', 'rows']) {
            for (const rtl of [false, true]) {
              await fixture(page, css, mode, rtl);
              const initial = await geometry(page);
              const cyclic = mode === 'horizontal' && initial.native && initial.cyclic && !forcedFallback;
              assert.equal(initial.display, cyclic ? 'grid-lanes' : 'grid', 'Mode must select the documented native/fallback layout');
              checkOrdered(initial, 3, cyclic, rtl);
              if (cyclic) assert.ok(initial.boxes[4].y < initial.boxes[3].y, 'A has uneven card tops, matching the approved reference');
              if (options.screenshots && !rtl && !forcedFallback) {
                await mkdir(resolve(options.screenshots), { recursive: true });
                await page.screenshot({ path: join(resolve(options.screenshots), `${name}-${variant.name}-${mode}.png`), fullPage: true });
              }
              await page.evaluate(() => document.activeElement?.blur());
              for (let i = 0; i < heights.length; i++) {
                await page.keyboard.press('Tab');
                assert.equal(await page.evaluate(() => document.activeElement.id), `card-${i + 1}`, 'Focus follows original DOM sequence');
              }
              await page.locator('#card-1').evaluate(element => { element.style.height = '310px'; });
              checkOrdered(await geometry(page), 3, cyclic, rtl);
              for (const [width, columns] of [[420, 2], [180, 1]]) {
                await page.locator('.ehven-lanes').evaluate((element, value) => { element.style.width = value + 'px'; }, width);
                checkOrdered(await geometry(page), columns, cyclic, rtl);
              }
              await page.locator('.ehven-lanes').evaluate(element => { element.style.width = '650px'; element.style.setProperty('--ehven-lanes-gap', '0px'); });
              checkOrdered(await geometry(page), 3, cyclic, rtl);
              await page.locator('#card-2').evaluate(element => { element.style.display = 'none'; });
              checkOrdered(await geometry(page), 3, cyclic, rtl);
              await page.locator('.ehven-lanes').evaluate(element => { const child = document.createElement('article'); child.style.height = '75px'; element.append(child); });
              checkOrdered(await geometry(page), 3, cyclic, rtl);
              await page.locator('.ehven-lanes').evaluate(element => { element.replaceChildren(); });
              assert.equal((await geometry(page)).boxes.length, 0);
              observations.push({ variant: variant.name, mode, rtl, forcedFallback, display: initial.display, cyclic, contracts: 'placement, dynamic height, resize, zero gap, hide/append/empty, containment, focus' });
            }
          }
        }
        await fixture(page, variant.css, '');
        if (defaults.native) {
          await page.locator('.ehven-lanes').evaluate(element => { element.style.setProperty('--ehven-lanes-flow-tolerance', '100000px'); });
          const tolerance = await geometry(page);
          assert.ok(tolerance.fit === '100000px' || tolerance.flow === '100000px', 'Existing tolerance hook reaches the native property');
          checkOrdered(tolerance, 3, true);
        }
        for (const mode of ['', 'horizontal', 'rows']) {
          await fixture(page, variant.css, mode);
          const samples = await page.evaluate(() => {
            const container = document.querySelector('.ehven-lanes');
            return Array.from({ length: 5 }, () => {
              const start = performance.now();
              const items = Array.from({ length: 1000 }, (_, i) => { const item = document.createElement('article'); item.style.height = `${50 + i % 7 * 15}px`; return item; });
              container.replaceChildren(...items); container.getBoundingClientRect();
              return performance.now() - start;
            });
          });
          assert.ok(Math.max(...samples) <= 2000, 'Each 1000-card layout sample stays within 2000ms');
          observations.push({ variant: variant.name, mode: mode || 'default', workload: 1000, samplesMs: samples, maximumMs: Math.max(...samples) });
        }
      }
      assert.equal(requests, 0, 'CSS/layout fixtures make no network requests');
      results.push({ browser: name, version: browser.version(), requests, observations });
      await context.close();
    } finally { await browser.close(); }
  }
  const bytes = await readFile(join(work, packed.filename));
  const report = { schemaVersion: 1, observedAt: new Date().toISOString(), target: { name: metadata.name, version: metadata.version, sha256: createHash('sha256').update(bytes).digest('hex'), integrity: packed.integrity }, packedBytes: packed.size, unpackedBytes: packed.unpackedSize, results };
  if (options.output) { await mkdir(resolve(options.output, '..'), { recursive: true }); await writeFile(resolve(options.output), JSON.stringify(report, null, 2) + '\n'); }
  console.log(JSON.stringify(report, null, 2));
} finally { await rm(work, { recursive: true, force: true }); }
