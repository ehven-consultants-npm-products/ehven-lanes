# `@ehven/lanes`

CSS-first masonry for unequal-height peer items, with zero runtime dependencies. Use the stylesheet alone for progressive CSS layout, or add the optional horizontal enhancement for consecutive placement across columns with uneven card tops in supported browsers.

## Install and use

Use the project's normal package manager, for example:

```sh
npm install @ehven/lanes@1.1.0
```

Import one stylesheet once through the existing CSS pipeline:

```css
@import '@ehven/lanes/lanes.css';
/* Or: @import '@ehven/lanes/lanes.css' layer(layout); */
```

```html
<div class="ehven-lanes">
  <article>First item</article>
  <article>Second item</article>
  <article>Third item</article>
</div>
```

Only direct children become lane items. Compatible bundlers also accept the root export; `/lanes.min.css` is the minified alternative.

## Horizontal ordering

```html
<div class="ehven-lanes" data-ehven-lanes-order="horizontal">
  <!-- Independent, single-lane peer items -->
</div>
```

In native supporting browsers, successive cards cycle across columns and stack below their own column predecessor, retaining uneven tops. Direction follows LTR/RTL. This is cyclic placement, not shortest-column packing.

The stylesheet alone uses native cyclic Grid Lanes where supported. Otherwise it uses aligned Grid rows: each new row starts below the preceding row's tallest card. **To obtain uneven-top horizontal placement across the supported browsers, also load the optional enhancement:**

```js
import { enhanceLanes } from '@ehven/lanes/enhance';

const container = document.querySelector('.ehven-lanes[data-ehven-lanes-order="horizontal"]');
const layout = container instanceof HTMLElement ? enhanceLanes(container) : undefined;
```

Run this browser code after the container exists, for example in a module script. The stylesheet is still required. Native-capable browsers keep native placement; other supported browsers use the dependency-free JavaScript renderer. Importing CSS does not load JavaScript automatically.

| Mode | Stylesheet alone | With the enhancement initialized |
| --- | --- | --- |
| Omitted or `vertical` | CSS Columns baseline, enhanced to automatic native Grid Lanes where supported | Unchanged |
| `horizontal` | Cyclic, uneven-top placement (A) natively; aligned rows (B) otherwise | Cyclic, uneven-top placement (A) |
| `rows` | Aligned rows (B) | Unchanged |

The enhancement updates on container resizing, card growth, insertion/removal and text changes. It never rearranges the DOM or changes tabindex. Each card stacks below the preceding card in its own cyclic column; it does not choose the shortest column.

The returned controller provides `refresh()` for a CSS-only setting change that does not otherwise trigger an observation, and `destroy()` before unmounting. Destroy disconnects observers, cancels queued work and restores only helper-owned styles. Use `enhanceLanes(container, { force: true })` to exercise the JavaScript path even in native-capable browsers; repeated calls return the same controller with its initial options.

The optional renderer targets ordinary direct-child boxes in horizontal writing mode, including LTR/RTL. Use the package gap instead of item margins, and let it control card width and placement. Spanning, self-positioned cards and consumer transforms that determine layout size are outside this contract. It requires ResizeObserver, MutationObserver and requestAnimationFrame. If those browser capabilities are absent, initialization throws before changing layout; the CSS layout remains available.

Set `data-ehven-lanes-order="rows"` for aligned rows everywhere. Omitted or unrecognized values preserve the original fallback/enhancement behavior. Ordered modes require single-lane children without explicit placement, spanning or CSS `order`. Consumer UI can change the attribute without measuring or reordering cards.

## Configure

Put overrides in your project stylesheet, imported after the package. Never edit `node_modules`.

```css
.project-list {
  --ehven-lanes-lane-minimum: 16rem;
  --ehven-lanes-gap: 1.25rem;
  --ehven-lanes-flow-tolerance: 3rem;
}
```

Apply `project-list` alongside `ehven-lanes`, or set inherited defaults on an ancestor.

| Custom property | Default | Effect |
|---|---|---|
| `--ehven-lanes-lane-minimum` | `18rem` | Preferred responsive lane minimum |
| `--ehven-lanes-gap` | `1rem` | Separation between items |
| `--ehven-lanes-flow-tolerance` | `normal` (native equivalent of `1em`) | Original native mode's placement tolerance |

The existing tolerance hook maps to both native `flow-tolerance` and its newer `fit-tolerance` name. Horizontal mode fixes it to `infinite`; rows mode has none. Supply valid nonnegative lengths where required; CSS invalid-value handling applies.

## Manual use without Node

1. Download [lanes.min.css](https://github.com/ehven-consultants-npm-products/ehven-lanes/releases/download/v1.1.0/lanes.min.css) and [SHA256SUMS](https://github.com/ehven-consultants-npm-products/ehven-lanes/releases/download/v1.1.0/SHA256SUMS) from the same release.
2. In that directory, verify the selected file. Linux: `grep ' lanes.min.css$' SHA256SUMS | sha256sum --check`. macOS: `grep ' lanes.min.css$' SHA256SUMS | shasum -a 256 --check`. Expect `lanes.min.css: OK`.
3. Store CSS locally, retain its license notice, and load it:

```html
<link rel="stylesheet" href="/assets/vendor/ehven-lanes/lanes.min.css">
```

4. Apply the markup/settings above. Verify narrow/wide layout and actual content order.

Readable CSS is also available. Corresponding npm/direct-download CSS bytes match. An optional CDN adds a third-party dependency:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@ehven/lanes@1.1.0/dist/lanes.min.css">
```

Never use moving `latest` URLs in production.

For horizontal enhancement without a build tool, download [enhance.mjs](https://github.com/ehven-consultants-npm-products/ehven-lanes/releases/download/v1.1.0/enhance.mjs) from the same versioned release and verify its entry in `SHA256SUMS`. Serve it with a JavaScript MIME type and initialize it after the container exists:

```html
<script type="module">
  import { enhanceLanes } from '/assets/vendor/ehven-lanes/enhance.mjs';
  const container = document.querySelector('.ehven-lanes[data-ehven-lanes-order="horizontal"]');
  if (container instanceof HTMLElement) enhanceLanes(container);
</script>
```

## Compatibility and accessibility

Fallbacks require CSS Columns (default) or modern Grid with `min()` (ordered modes). Native horizontal masonry additionally requires `display: grid-lanes` and `fit-tolerance: infinite` or the older `flow-tolerance` equivalent.

DOM order is unchanged. Columns flow downward; original native mode favors shorter lanes. Horizontal masonry can place a later card higher than an earlier card in another column. Use independent peers; choose rows for strict visual row sequence. Preserve meaningful source order and verify keyboard traversal.

Verified engines: WebKit 27.2 (native and fallback), Chromium 156 and Firefox 157 (fallback). These are test-engine results, not certification of every branded browser or host version.

Recipes cover Astro, Starlight, WordPress, Webflow and static HTML; they do not certify every host version. Reserve media dimensions to reduce shifts and handle inner text overflow in consumer CSS.

The stable 1.x contract covers the class, ordering attributes, three custom properties, stylesheet exports and documented defaults. Patches preserve behavior; compatible additions use a minor; incompatible contract changes require a major and migration notes. Native layout depends on browser support; aligned rows remain the horizontal fallback. Only the latest minor of the current major receives fixes; no response-time guarantee applies. Restore an exact verified version to roll back.

## Agent-assisted integration

> Use the approved pinned version and existing stylesheet pipeline. Load one variant once; use direct-child peers and documented settings. Preserve semantic DOM/focus order and host rules. Account for native/fallback ordering; test narrow/wide layouts and report version, changes, checks and gaps.

This is consumer guidance, not an installed assistant integration.

## Support and funding

For paid integration, support or sponsorship inquiries, [contact Ehven Consultants](https://ehven.com/contact/). Sponsorship is not a support agreement. Use public issues for routine bugs and the security policy for vulnerabilities.

## Documentation

- [Installation workflows](https://github.com/ehven-consultants-npm-products/ehven-lanes/blob/v1.1.0/docs/installation.md)
- [Delivery and recovery](https://github.com/ehven-consultants-npm-products/ehven-lanes/blob/v1.1.0/docs/delivery.md)
- [Security policy](https://github.com/ehven-consultants-npm-products/ehven-lanes/blob/v1.1.0/SECURITY.md)
- [Changelog](https://github.com/ehven-consultants-npm-products/ehven-lanes/blob/v1.1.0/CHANGELOG.md)

MIT © Gilad Ehven
