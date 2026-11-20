# Consumer delivery and recovery

Install an exact version with the project's normal package manager and lockfile. Load `@ehven/lanes/lanes.css` or `/lanes.min.css` through the existing CSS-capable bundler/pipeline, or enqueue/link a verified self-hosted file. Compatible bundlers also accept the root export. Choose one variant and one loading method. The [installation recipes](https://github.com/ehven-consultants-npm-products/ehven-lanes/blob/main/docs/installation.md) cover bundler imports, Astro, WordPress and static HTML.

For no-build use, download the desired CSS and checksum manifest from the same published release:

```text
https://github.com/ehven-consultants-npm-products/ehven-lanes/releases/download/vVERSION/lanes.min.css
https://github.com/ehven-consultants-npm-products/ehven-lanes/releases/download/vVERSION/SHA256SUMS
```

Follow the README's Linux/macOS checksum commands, retain the license notice, and store/link the verified file locally, preferably in a versioned directory such as `/assets/vendor/ehven-lanes/1.1.1/`. Corresponding npm and direct-download CSS bytes are identical.

An optional version-pinned CDN adds a third-party network dependency:

```text
https://cdn.jsdelivr.net/npm/@ehven/lanes@VERSION/dist/lanes.min.css
```

Never use moving `latest` URLs in production. Restore the previously verified exact dependency or CSS file to roll back; remove imports/attributes to uninstall. Check the resulting host layout. CSS introduces no persistent runtime state. If using horizontal enhancement, destroy its controller before unmounting and remove its module import to uninstall. Report version and reproduction through the public support route.


The optional `@ehven/lanes/enhance` export is an ES module with adjacent TypeScript declarations. npm includes both. Versioned GitHub Releases also provide `enhance.mjs` and its SHA256SUMS entry for manual delivery; use the same version as the stylesheet. Host it with a JavaScript MIME type and initialize only the intended horizontal containers. Native cyclic support remains the default renderer; `{force:true}` explicitly selects JS. No remote code or runtime dependency is loaded by the module.

Documentation changes on the repository default branch do not change an already published npm tarball, its bundled README, or immutable GitHub release assets. Use the matching source tag when reproducing an older installation; current 1.x guidance lives on the default branch. npm receives revised bundled documentation with the next package publication.
