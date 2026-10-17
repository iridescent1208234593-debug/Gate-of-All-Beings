# Stage 1.8.1 — Release Pipeline Recovery

Date: 2026-10-16

## Outcome

**PARTIALLY RECOVERED.** The publisher now emits structured filesystem diagnostics without changing its copy, rename, retry, rollback, or cleanup decisions. Four isolated simulations passed. Production was not republished because the historical retry failures after the Portal process was stopped remain unexplained and the lock owner could not be identified.

## Historical Failure Evidence

The previous captured Node error was:

```text
Error: EPERM: operation not permitted, rename 'E:\Projects\.releases\production\site' -> 'E:\Projects\.releases\.promotion\previous\0'; previous production outputs restored.
```

Captured fields: `code=EPERM`, `syscall=rename`, source `E:\Projects\.releases\production\site`, destination `E:\Projects\.releases\.promotion\previous\0`. The earlier publisher output did not record numeric `errno`; it remains **NOT CAPTURED** and is not inferred here.

## Evidence and Diagnosis

- Website Manager launches the Portal with its current working directory inside `.releases/production/site/server`. The publisher renames the enclosing `site` directory and does not stop the service. A live Portal process with its working directory under the target is a high-confidence explanation for the first failure.
- Historical attempts still failed after the Portal process was stopped and a 12-second wait. The live Portal CWD therefore does not explain all observed failures; the complete root cause is **UNKNOWN**.
- Current listener check: `127.0.0.1:8080`, PID `63788`, `python.exe -u portal_server.py`. The local page returned HTTP 200. This process was not stopped during this recovery work.
- Other observed project listeners: `127.0.0.1:5174` PID `35520` (Python Cards OAuth), `127.0.0.1:5177` PID `35740` (Node), `127.0.0.1:5178` PID `46620` (Vite preview), and `127.0.0.1:4173` PID `6604` (Vite preview). Port `8765` had no listener. PID `2156` was a source-tree Python `http.server` on wildcard port `5192`; it was not a production release target. No process was stopped as part of this audit.
- No Sysinternals Handle utility was available in the checked locations. Windows Restart Manager registered the target paths but returned access denied when enumerating owners. Exact open-handle owner is **UNKNOWN**.
- Explorer windows were not open in `.releases` or the candidate. Common OneDrive, Dropbox, Google Drive, and Syncthing processes were absent. Other sync or endpoint-protection activity remains **UNKNOWN**. Defender and Windows Search were running; no matching Defender Operational event mentioned `.releases` in the inspected 48-hour window, which does not rule out transient scanning.
- Candidate, production, and promotion backup paths are all on `E:\`; ACLs showed modify access for the current user context and no read-only attributes. Filesystem type could not be read due access denied. No cross-volume move is indicated.

## Diagnostic Change

`ops/publish-release.mjs` now writes `[release-preflight]` and `[release-fs]` JSON lines to stderr. Entries include timestamp, operation, source/destination, attempt, phase, and native `errno`, `code`, `syscall`, `path`, and `dest` when an error exists. Site preflight records candidate verification, path existence, volume roots, write access, publisher working directory, whether that directory is under production, and explicitly reports `serviceLockState=NOT_QUERIED`.

Diagnostics do not decide whether to publish, stop services, alter retry limits, change the atomic swap, or suppress errors. Logging failures are swallowed so they cannot change publication behavior.

## Simulation Evidence

The copied publisher and candidate verifier ran under `work/publish-simulation-20261016/`, with independent fake project trees and small text files. Synthetic failures were injected by a test-only Node preload; its `errno=-4048` is simulated data and is not evidence for the historical failure.

| Scenario | Result |
| --- | --- |
| Normal site swap | PASS — candidate installed, promotion directory cleaned |
| One transient EPERM moving old site to backup | PASS — attempt 1 logged EPERM fields; attempt 2 succeeded; candidate installed |
| Persistent EPERM installing candidate | PASS — old production restored; promotion directory cleaned; publisher reported restored state |
| Persistent install EPERM plus persistent rollback EPERM | PASS — publisher reported rollback incomplete and retained the old site in `.promotion/previous/0` |

The production candidate was independently verified after the simulations: 1,371 files matched its manifest (`sourceHead=abdf74e8ca055046b92b52174e4fe6bb83cd5a77`, `sourceDirty=true`). Current local production remained HTTP 200 on `127.0.0.1:8080`.

## Production Action

No production publish was attempted in Stage 1.8.1. The verified candidate was not deployed. Existing production remained serving the existing snapshot. No production process was stopped, and no atomic-publisher bypass was used.

The simulations prove the diagnostics and exercise existing swap/rollback branches, but do not identify the real lock owner or reproduce a real Windows filesystem lock. A future controlled retry should wait until the remaining lock source is identified or the service lifecycle and all other relevant holders are conclusively controlled; then capture the new structured error fields if rename still fails.

## Scope and Worktree

This stage changed only the publisher diagnostics, this report, and the isolated simulation fixture/logs under `work/publish-simulation-20261016/`. No files were staged or committed. Other dirty files, including Stage 1.8 anti-scraping work and unrelated project edits, were preserved. Cloudflare settings and anti-scraping controls were not changed; Stage 2 was not started.
