---
applyTo: "tools/ops/run-ops.mjs,tools/release/publish-release.mjs,tools/runtime/local-runtime.py,tools/runtime/storage-migrate.py,tools/runtime/backup-storage.py,tools/runtime/relocate-storage.py,docs/release-workflow.md,docs/workspace.md"
---

- Read-only status is the default for production inspection. Do not restart services, modify DNS, change proxy limits, publish candidates, or access database contents without explicit authorization.
- Keep build candidates, active production snapshots, runtime data, and backups distinct. Inspect `sourceHead`, `sourceDirty`, manifest hashes, and active release before release decisions.
- Use the existing operations scripts and release manager; do not invent a parallel deployment path.
- Never commit external storage roots (data, assets, cache, releases, backups), production databases, uploads, backup copies, secrets, logs, migration manifests, or external operations-directory contents.
- After an authorized release, verify the active release ID, affected service health, public routes/assets, and rollback path. A successful build or push alone is not deployment evidence.
