# Installation workflows

`@ehven/lanes` is a CSS package. The HTML contract is the same on every platform:

```html
<div class="ehven-lanes">
  <article>First item</article>
  <article>Second item</article>
  <article>Third item</article>
</div>
```

Only direct children become lane items.

## Package-manager installation

Install with the package manager already used by the project.

### pnpm

```sh
pnpm add @ehven/lanes
```

### npm

```sh
npm install @ehven/lanes
```

### Yarn

```sh
yarn add @ehven/lanes
```

Import the readable stylesheet:

```css
@import '@ehven/lanes/lanes.css';
```

Importing the package root is also supported by compatible bundlers:

```css
@import '@ehven/lanes';
```

The explicit `/lanes.css` subpath is recommended because it states the asset type clearly.

## Cascade layers

The package does not declare its own cascade layer. A consuming project may assign one:

```css
@layer reset, tokens, base, layout, components, utilities;

@import '@ehven/lanes/lanes.css' layer(layout);
```

This lets each project retain control of its cascade architecture.

## Astro

Install the package:

```sh
pnpm add @ehven/lanes
```

Import it from a global project stylesheet:

```css
@import '@ehven/lanes/lanes.css' layer(layout);
```

Then use the class in any `.astro` component:

```astro
<section class="ehven-lanes">
  {
    items.map((item) => (
      <article>
        <h2>{item.title}</h2>
        <p>{item.description}</p>
      </article>
    ))
  }
</section>
```

No Astro integration or hydrated client component is required.

## Starlight

Import the package through a stylesheet already registered in Starlight's `customCss` configuration.

For example:

```css
/* src/styles/starlight.css */
@import '@ehven/lanes/lanes.css' layer(layout);
```

```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Documentation',
      customCss: [
        './src/styles/starlight.css',
      ],
    }),
  ],
});
```

The class can then be used in Astro components, MDX components, or supported HTML markup within documentation content.

## WordPress with a Node build

Install the package in the theme or plugin project:

```sh
pnpm add @ehven/lanes
```

Import it through the project's primary CSS entry point:

```css
@import '@ehven/lanes/lanes.css';
```

Let the existing build system generate the public theme or plugin asset.

## WordPress without a Node build

Download `lanes.min.css` from a versioned GitHub Release and store it locally, for example:

```text
assets/vendor/ehven-lanes/lanes.min.css
```

Enqueue it from a theme:

```php
<?php

add_action(
    'wp_enqueue_scripts',
    static function (): void {
        wp_enqueue_style(
            'ehven-lanes',
            get_theme_file_uri(
                '/assets/vendor/ehven-lanes/lanes.min.css'
            ),
            array(),
            '1.1.0'
        );
    }
);
```

Self-hosting the versioned file avoids making page rendering depend on a third-party CDN.

## Static HTML

Download and store the stylesheet with the site:

```html
<link
  rel="stylesheet"
  href="/assets/vendor/ehven-lanes/lanes.min.css"
/>
```

Alternatively, use the version-pinned npm CDN URL:

```html
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/@ehven/lanes@1.1.0/dist/lanes.min.css"
/>
```

## Webflow

Add the version-pinned stylesheet link to the project's site-wide `<head>` custom code:

```html
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/@ehven/lanes@1.1.0/dist/lanes.min.css"
/>
```

Add `ehven-lanes` to the Webflow element that wraps the peer items.

For stronger delivery-chain control, replace the CDN URL with an owned public asset endpoint after that service is provisioned.

## Configuration

Put overrides in your project stylesheet, imported after the package. Never edit `node_modules`.

Set package custom properties on the lanes container or any ancestor:

```css
.portfolio-list {
  --ehven-lanes-lane-minimum: 20rem;
  --ehven-lanes-gap: 1.5rem;
  --ehven-lanes-flow-tolerance: 4rem;
}
```

Custom properties inherit, so site-wide defaults may be established at `:root`:

```css
:root {
  --ehven-lanes-lane-minimum: 18rem;
  --ehven-lanes-gap: 1rem;
}
```

## Lists

The package deliberately does not reset list styling. If a list is used as the container, reset it in project CSS when appropriate:

```css
ul.ehven-lanes {
  margin: 0;
  padding: 0;
  list-style: none;
}
```

## Item margins

The package uses the direct children's block-end margin to create vertical separation in the Multi-column fallback. Native Grid Lanes replaces that margin with `gap`.

Ordered modes use `gap` and remove that item margin. Supply valid nonnegative lengths; invalid settings follow CSS invalid-value handling.

Treat each direct child as the layout item. If content needs independent outer margins, place that content inside a direct-child wrapper.

## Ordering

Add `data-ehven-lanes-order="horizontal"` to cycle consecutive single-lane items across columns in browsers supporting native Grid Lanes and infinite tolerance. Each subsequent item in a column starts below its own predecessor, preserving unequal heights. Unsupported browsers render aligned horizontal Grid rows, with each row below its tallest predecessor. Use `data-ehven-lanes-order="rows"` for aligned rows consistently. Omit the attribute to preserve the original fallback/enhancement behavior.

Keep direct children in meaningful source order and avoid explicit column placement, spanning and `order` overrides in ordered modes. Resizing or hiding/appending items recalculates placement using visible items and the current column count. Reserve image dimensions or aspect ratios when possible to reduce shifting as media loads. Layout only controls card boxes; the consumer remains responsible for long-text wrapping and overflowing inner content.

The existing `--ehven-lanes-flow-tolerance` hook controls native placement only in the original mode. Horizontal mode uses infinite native tolerance deliberately, and rows mode has no masonry tolerance. The package maps the existing hook to both old and new browser property names.

UI can change the attribute without reordering/measuring cards. Test focus and comprehension; do not add positive tabindex. No switch UI ships. Initialize the optional enhancement for horizontal placement in browsers lacking the native features.


## Reliable horizontal placement

Import the stylesheet through the existing pipeline, set `data-ehven-lanes-order="horizontal"`, then initialize the optional module in browser code:

```js
import { enhanceLanes } from '@ehven/lanes/enhance';
const container = document.querySelector('.ehven-lanes[data-ehven-lanes-order="horizontal"]');
const layout = container instanceof HTMLElement ? enhanceLanes(container) : undefined;
```

This keeps native cyclic placement where available and supplies cyclic, uneven-top placement elsewhere in the supported browser matrix. Without initialization, the CSS-only fallback remains aligned rows. `rows` always retains aligned rows; omitted/vertical retains the existing progressive default. Direction follows LTR/RTL. Only ordinary direct-child, single-lane boxes in horizontal writing mode are supported.

The module uses ResizeObserver, MutationObserver and requestAnimationFrame; it has no runtime imports, remote calls or automatic document-wide initialization. It responds to responsive sizing, text/content changes, hidden cards, insertions/removals and order-attribute changes. Use gap for spacing, not item margins or self-positioning. Existing DOM and keyboard order remain intact.

Call `layout?.refresh()` after a stylesheet-only change to lane minimum/gap if it does not cause a resize or DOM observation. Call `layout?.destroy()` before a component unmounts. Repeated initialization returns the existing controller; the first options apply. `{force:true}` selects the JS path even with native support for testing. Importing the module during SSR is safe; calling it requires a live HTML container. TypeScript declarations accompany the module.

In Astro, put the initialization in a processed `<script>` so the module is bundled. With client-side navigation, destroy before the old content is removed and initialize after new content is mounted. Other frameworks use the same two lifecycle points. Keep the helper optional; do not replace the site's existing CSS pipeline.

For static HTML or WordPress without a JS build pipeline, download `enhance.mjs` together with the CSS from the same release, verify SHA256SUMS, serve the module as JavaScript, and use a module script with the equivalent initialization. Remove/destroy the helper and its import to return to CSS-only behavior.
