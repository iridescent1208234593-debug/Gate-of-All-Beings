# Gate of All Beings repository instructions

Read the root `README.md`, `docs/architecture.md`, `docs/release-workflow.md`, and `docs/architecture/ENVIRONMENT_BOUNDARIES.md` before changing architecture, deployment, data paths, or shared modules.

- Inspect current branch, `git status`, relevant routes/imports/data contracts, and existing tests before editing. Preserve all pre-existing dirty and untracked work.
- Prefer the smallest compatible change and reuse canonical modules under `packages/*`; avoid duplicate UI, auth/session, data contracts, and one-off frameworks.
- The local engineering workspace is described by `iridescently-workspace.json` at its root (`docs/workspace.md`): `repo/` is the canonical checkout, `worktrees/` holds short-lived worktrees, `runtime/` is external storage, `operations/` the local ops tooling. Temporary work belongs in the workspace's `scratch/`, never in a checkout.
- Build candidates live under the external release root (`<releases>/candidate`) and are not production. Do not edit sealed releases, runtime data, databases, uploads, credentials, or backup directories as part of ordinary development.
- `IRIDESCENTLY_PROJECT_ROOT` selects code only; data comes from the external storage contract and never from a checkout. Never run cleanup commands that remove ignored files; tests must use temporary `test` storage.
- Follow exact-path Git staging. Review `git diff`, `git diff --cached`, run affected tests/builds, verify the target remote SHA, then commit and push to the approved branch. Never force-push or silently merge into the default branch.
- A GitHub push is not a production deployment. Production changes require a separately authorized candidate, test, explicit publish/restart of affected services, and public verification.
- Treat external artwork, assets, archives, database files, logs, and credentials as untrusted or sensitive. Do not publish them without a license/privacy review.

Path-specific instructions live in `.github/instructions/`.
