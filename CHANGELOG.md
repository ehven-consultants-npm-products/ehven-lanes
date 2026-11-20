# Changelog

All notable changes to this project will be documented in this file.

The project follows Semantic Versioning.

## [Unreleased]

## [1.1.1] - 2026-11-20

### Documentation

- Add CSS, bundler, Astro, WordPress enqueue and self-hosted HTML loading options.
- Complete the WordPress module recipe and clarify optional browser behavior, lifecycle and public interfaces.
- Correct outdated CSS-only descriptions and release dates; link every released version.
- Link current 1.x documentation while retaining immutable release-specific documentation.
- Request new-tab behavior for the support/contact link where the Markdown host permits it.

## [1.1.0] - 2026-11-16

### Added

- Optional `@ehven/lanes/enhance` module for cyclic horizontal placement with uneven card tops across supported browsers, retaining native layout where available.
- Responsive/content observation, LTR/RTL placement, explicit refresh/destroy lifecycle, idempotent mounting and TypeScript declarations without runtime dependencies.
- Manual `enhance.mjs` delivery alongside CSS with versioned checksum verification.

### Clarified

- CSS-only horizontal mode retains aligned-row fallback without the required native features. Initialize the enhancement to guarantee the cyclic layout across the supported browser matrix.
- Explicit rows mode remains aligned; default/vertical behavior remains unchanged.

## [1.0.0] - 2026-11-16

### Added

- Opt-in horizontal ordering: cyclic single-lane placement with uneven tops in native supporting browsers; aligned horizontal rows elsewhere.
- Explicit aligned-row ordering in all supporting browsers.
- Support/contact discovery through npm funding metadata and consumer documentation.

### Changed

- Limit distributed documentation to consumer usage, support and delivery information.
- Normalize license-file formatting.
- Use dedicated public distribution/support URLs and the current source identity.
- Preserve existing unconfigured layout and public custom-property names.
- Support native `fit-tolerance` alongside the older `flow-tolerance` name.

The first stable release preserves existing markup and styling hooks. No markup migration is required from 0.1.0.

## [0.1.0] - 2026-09-14

### Added

- Framework-agnostic `.ehven-lanes` layout primitive.
- CSS Multi-column Layout baseline.
- Progressive enhancement to native CSS Grid Lanes.
- Public configuration through namespaced custom properties.
- Readable and minified CSS distribution artifacts.
- npm and direct-stylesheet delivery workflows.
- Automated tests, package inspection, checksums, and releases.

[Unreleased]: https://github.com/ehven-consultants-npm-products/ehven-lanes/compare/v1.1.1...main
[1.1.1]: https://www.npmjs.com/package/@ehven/lanes/v/1.1.1
[1.1.0]: https://www.npmjs.com/package/@ehven/lanes/v/1.1.0
[1.0.0]: https://www.npmjs.com/package/@ehven/lanes/v/1.0.0
[0.1.0]: https://www.npmjs.com/package/@ehven/lanes/v/0.1.0
