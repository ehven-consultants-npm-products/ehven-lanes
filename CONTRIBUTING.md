# Contributing

Lanes is CSS-only and framework-independent. Its source is `src/lanes.css`; `dist/` is generated.

Use Node.js 24.22.1 and pnpm 11.22.0.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm run check
pnpm exec playwright install chromium firefox webkit
pnpm run check:browser
```

Browser tests use synthetic cards and exercise the installed package, native and fallback placement, LTR/RTL, resizing, dynamic content, keyboard order and size/layout budgets. Engine coverage is documented in the README.

Include a reproducible example with bug reports. Use private vulnerability reporting for security issues. Product changes should preserve documented interfaces or include the appropriate version and migration information.
