## Start here

- Repository layout: `docs/repository-layout.md`. Local engineering workspace (repo, worktrees,
  runtime storage, operations, originals, evidence, archive): `docs/workspace.md`. Branch rules:
  `docs/development/BRANCH_STRATEGY.md`. Local services and HK publishing: `docs/operations.md`.
  Recovery: `docs/recovery.md`. Security: `docs/security/README.md` (which documents are current
  rules and which are dated history; live production state comes only from fresh read-only evidence).
- Re-check the live Git and disk state before acting; documents and handoffs record the state when
  they were written.

## Boundaries

- Production (Hong Kong data, uploads, nginx, systemd, releases), Cloudflare, DNS, Tunnels and
  production OAuth registrations are changed only with the owner's explicit authorization.
- Code never selects data: storage comes from `IRIDESCENTLY_STORAGE_ROOT` /
  `IRIDESCENTLY_ENVIRONMENT` or the workspace manifest; tests use temporary `test` storage only.
- Keep the Host/Origin/CSP/WebSocket model: one explicit domain map, per-root sessions and cookies,
  no wildcard or suffix host checks, no global Origin gate on navigation.
- No force-push or history rewrite on shared branches; collaborators' branches are not merged,
  deleted or rewritten before review.

## File deletion and cleanup policy

This policy covers files tracked by Git in this repository. Runtime data, uploads, databases,
secrets, original artwork and music, collaborators' originals, evidence, and anything outside the
repository are never deleted as "cleanup": move them to the workspace `archive/` with a verified
inventory, or leave them and record the question for the owner.

When the user explicitly identifies tracked files, directories, assets, compatibility code,
experiments, test data, generated output, or old implementations as obsolete or
requests that they be removed:

- Treat the request as explicit authorization to delete within the requested scope.
- Delete obsolete content directly.
- Do not archive, rename, move to deprecated folders, or create backup copies unless
  the user explicitly asks for preservation.
- Do not ask for confirmation again when the deletion scope is clear.
- Use Git as the default recovery mechanism for tracked project files.
- Before deleting a shared subsystem or a large directory, inspect references and
  dependencies first.
- After deletion, search for stale references and remove or repair them as needed.
- Run relevant tests, builds, or validation when practical.
- Report `git status` or the equivalent resulting changes.
- Never expand deletion beyond the user-requested scope without a technical reason.

When replacing an old implementation with a new one, prefer removing the superseded
implementation once the replacement is verified instead of accumulating compatibility
layers indefinitely.
