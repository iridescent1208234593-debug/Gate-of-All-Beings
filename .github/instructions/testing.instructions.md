---
applyTo: "**/*test*.*,**/tests/**/*,**/verify_*.py,package.json,**/package.json"
---

- Select tests from the root/workspace scripts and run the smallest relevant suite first, followed by affected build/type checks.
- Use temporary ports and temporary databases/media roots. Do not call live user, production, OAuth, or external payment data from tests.
- Do not convert an unavailable test, browser, or toolchain into a pass. Report skipped checks and their reason.
- For image export/upload changes, verify the exported dimensions, request size and response, save/reopen flow, and exact source colors; use realistic mobile viewport coverage.
- For module lifecycle changes, test repeated mount/unmount and confirm listeners, RAFs, workers, timers, and resources are disposed.
