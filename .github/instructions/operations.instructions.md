---
applyTo: "scripts/run-ops.mjs,.releases/**/*,docs/release-workflow.md"
---

- Read-only status is the default for production inspection. Do not restart services, modify DNS, change proxy limits, publish candidates, or access database contents without explicit authorization.
- Keep build candidates, active production snapshots, runtime data, and backups distinct. Inspect `sourceHead`, `sourceDirty`, manifest hashes, and active release before release decisions.
- Use the existing operations scripts and release manager; do not invent a parallel deployment path.
- Never commit `.releases/runtime`, production databases, uploads, backup copies, secrets, logs, or external operations-directory contents.
- After an authorized release, verify the active release ID, affected service health, public routes/assets, and rollback path. A successful build or push alone is not deployment evidence.
