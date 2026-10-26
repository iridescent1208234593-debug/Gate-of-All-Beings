# Gate of All Beings repository instructions

Read the root `README.md`, `docs/architecture.md`, `docs/release-workflow.md`, and `docs/architecture/ENVIRONMENT_BOUNDARIES.md` before changing architecture, deployment, data paths, or shared modules.

- Inspect current branch, `git status`, relevant routes/imports/data contracts, and existing tests before editing. Preserve all pre-existing dirty and untracked work.
- Prefer the smallest compatible change and reuse canonical modules under `shared/*`; avoid duplicate UI, auth/session, data contracts, and one-off frameworks.
- `E:\Projects` is the source repository; formal worktrees are under `E:\Projects-worktrees`; independent projects and operations are under `E:\External Projects`. Temporary work belongs outside the repository.
- Build output under `.releases/candidate` is not production. Do not edit `.releases/production`, runtime data, databases, uploads, credentials, or backup directories as part of ordinary development.
- `IRIDESCENTLY_PROJECT_ROOT` currently points to the repository root and may resolve user data there. Never run cleanup commands that remove ignored files; tests must use temporary data roots.
- Follow exact-path Git staging. Review `git diff`, `git diff --cached`, run affected tests/builds, verify the target remote SHA, then commit and push to the approved branch. Never force-push or silently merge into the default branch.
- A GitHub push is not a production deployment. Production changes require a separately authorized candidate, test, explicit publish/restart of affected services, and public verification.
- Treat external artwork, assets, archives, database files, logs, and credentials as untrusted or sensitive. Do not publish them without a license/privacy review.

Path-specific instructions live in `.github/instructions/`.
