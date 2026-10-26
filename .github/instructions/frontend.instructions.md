---
applyTo: "portal/**/*.html,portal/**/*.css,portal/**/*.js,portal/**/*.ts,portal/**/*.tsx,server/app/src/**/*.html,server/app/src/**/*.css,server/app/src/**/*.js,server/app/src/**/*.ts,server/app/src/**/*.tsx,shared/**/*.js,shared/**/*.ts,shared/**/*.tsx"
---

- Trace the actual page entry, router/host mapping, shared navigation, theme tokens, and data/API contract before editing UI.
- Reuse `packages/shared-ui`, `packages/shared-session`, and `packages/shared-types` when their contracts fit. Keep module-only visuals local until a second stable consumer exists.
- Preserve mobile, keyboard, focus-visible, reduced-motion, loading/error, and existing permission behavior. Do not expose admin routes through ordinary navigation.
- For color changes, preserve source HEX/data as the truth; derive surfaces and text explicitly instead of applying global filters or opacity.
- Run the affected module's existing tests and build. For interactive changes, use a browser flow when available and report anything not exercised.
