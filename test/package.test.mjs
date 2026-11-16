import assert from 'node:assert/strict';
import { access, readFile, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { transform } from 'lightningcss';

const projectRoot = new URL('../', import.meta.url);
const packageFile = new URL('package.json', projectRoot);
const sourceFile = new URL('src/lanes.css', projectRoot);
const readableFile = new URL('dist/lanes.css', projectRoot);
const minifiedFile = new URL('dist/lanes.min.css', projectRoot);

const packageMetadata = JSON.parse(
  await readFile(packageFile, 'utf8'),
);

const sourceCss = await readFile(sourceFile, 'utf8');
const readableCss = await readFile(readableFile, 'utf8');
const minifiedCss = await readFile(minifiedFile, 'utf8');

const banner =
  `/*! ${packageMetadata.name} v${packageMetadata.version} | ` +
  `MIT License | ${packageMetadata.homepage} */\n`;

test('the source CSS parses successfully', () => {
  assert.doesNotThrow(() => {
    transform({
      filename: 'lanes.css',
      code: Buffer.from(sourceCss),
      minify: false,
    });
  });
});

test('the public selector and custom properties remain available', () => {
  assert.match(sourceCss, /\.ehven-lanes\s*\{/);
  assert.match(sourceCss, /\.ehven-lanes\s*>\s*\*/);

  assert.match(
    sourceCss,
    /--ehven-lanes-gap/,
  );

  assert.match(
    sourceCss,
    /--ehven-lanes-lane-minimum/,
  );

  assert.match(
    sourceCss,
    /--ehven-lanes-flow-tolerance/,
  );
});

test('the baseline precedes the Grid Lanes enhancement', () => {
  const baselinePosition = sourceCss.indexOf('.ehven-lanes {');
  const enhancementPosition = sourceCss.indexOf(
    '@supports (display: grid-lanes)',
  );

  assert.notEqual(baselinePosition, -1);
  assert.notEqual(enhancementPosition, -1);
  assert.ok(baselinePosition < enhancementPosition);
});

test('the package has no external CSS runtime dependencies', () => {
  assert.doesNotMatch(sourceCss, /@import\b/i);
  assert.doesNotMatch(sourceCss, /url\s*\(/i);
});

test('the readable artifact is the banner plus the source', () => {
  assert.equal(
    readableCss,
    `${banner}${sourceCss}`,
  );
});

test('the minified artifact retains its identity banner', () => {
  assert.ok(minifiedCss.startsWith(banner));
  assert.ok(minifiedCss.endsWith('\n'));
  assert.ok(minifiedCss.length < readableCss.length);
});

test('all exported package files exist', async () => {
  const exportedFiles = new Set(
    Object.values(packageMetadata.exports),
  );

  exportedFiles.add(packageMetadata.style);
  exportedFiles.add(packageMetadata.unpkg);
  exportedFiles.add(packageMetadata.jsdelivr);

  for (const exportedFile of exportedFiles) {
    const relativePath = exportedFile.replace(/^\.\//, '');

    await assert.doesNotReject(
      access(new URL(relativePath, projectRoot)),
      `Missing exported file: ${exportedFile}`,
    );
  }
});

test('the package is configured for public publication', () => {
  assert.equal(packageMetadata.name, '@ehven/lanes');
  assert.equal(packageMetadata.license, 'MIT');
  assert.equal(packageMetadata.publishConfig.access, 'public');

  assert.deepEqual(
    packageMetadata.sideEffects,
    ['**/*.css'],
  );
});


test('the actual tarball contains only the consumer distribution allowlist', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lanes-pack-'));
  try {
    const packed = spawnSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', directory], { cwd: projectRoot, encoding: 'utf8' });
    assert.equal(packed.status, 0, packed.stderr);
    const response = JSON.parse(packed.stdout);
    const entries = Array.isArray(response) ? response : Object.values(response);
    assert.equal(entries.length, 1, 'Exactly one packed package is required');
    const info = entries[0];
    assert.equal(info.name, packageMetadata.name);
    assert.ok(Array.isArray(info.files), 'Expected the full packed-file inventory');
    assert.deepEqual(info.files.map(file => file.path).sort(), [
      'CHANGELOG.md', 'LICENSE', 'README.md', 'SECURITY.md', 'dist/enhance.mjs', 'dist/enhance.d.mts', 'dist/lanes.css', 'dist/lanes.min.css',
      'docs/delivery.md', 'docs/installation.md', 'package.json',
    ].sort());
    for (const file of info.files.filter(file => file.path.endsWith('.md'))) {
      const contents = spawnSync('tar', ['-xOzf', join(directory, info.filename), '--', 'package/' + file.path], { encoding: 'utf8' });
      assert.equal(contents.status, 0, contents.stderr);
      assert.doesNotMatch(contents.stdout, /BEGIN .*PRIVATE KEY/);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

// The module is safe to import during SSR; it touches the DOM only when called.
test('optional enhancement imports without a browser and rejects non-container input', async () => {
  const {enhanceLanes} = await import('../dist/enhance.mjs');
  assert.throws(() => enhanceLanes(null), /HTML.*container/);
});

test('the optional module is shipped unchanged and has no runtime imports', async () => {
  const source = await readFile(new URL('src/enhance.mjs', projectRoot), 'utf8');
  assert.equal(await readFile(new URL('dist/enhance.mjs', projectRoot), 'utf8'), source);
  assert.doesNotMatch(source, /(?:^|\n)import\s/);
});
