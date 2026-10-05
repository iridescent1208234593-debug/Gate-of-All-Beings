## File deletion and cleanup policy

When the user explicitly identifies files, directories, assets, compatibility code,
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
