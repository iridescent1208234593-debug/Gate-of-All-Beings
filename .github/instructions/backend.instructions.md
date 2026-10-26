---
applyTo: "services/**/*.py,services/**/*.cjs,apps/**/*.py,apps/*/server/**/*.js,apps/*/server/**/*.mjs,apps/*/server/**/*.ts,apps/juling/server.js,packages/**/*.py,tools/**/*.py"
---

- Trace the real request route, authentication/session owner, persistence path, and mounted proxy before changing an endpoint.
- Keep user data separate from code artifacts. Tests must set `IRIDESCENTLY_PROJECT_ROOT` to a temporary fixture; never point tests at production databases.
- Bound request bodies and image dimensions/types at every layer. Prefer multipart Blob/File transport for binary data; avoid Base64 inside JSON for large images.
- Preserve existing DB schemas and account/session contracts unless the task explicitly authorizes a migration. Do not log secrets or private user data.
- Run the affected Python/Node tests and syntax/build checks; identify external proxy limits that local source cannot prove.
