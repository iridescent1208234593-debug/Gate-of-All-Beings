# Batch 6 runtime writer inventory

Every path below is relative to `<IRIDESCENTLY_STORAGE_ROOT>/<IRIDESCENTLY_ENVIRONMENT>/`.
Source and immutable release code are never selected as data roots. Services reject
an absent/mismatched `data/.storage-ready.json`; test fixtures explicitly initialize
temporary `test` storage. The production/staging marker is produced only after a
verified migration manifest.

| Writer/owner | Persistent target | Generated or temporary target |
| --- | --- | --- |
| Huiguan accounts, sessions, account profiles, email/recovery/security, points, tasks and cloud saves | `data/huiguan/users.db` (including SQLite journal/WAL sidecars) | — |
| Huiguan OC role sheets | default `data/huiguan/characters.json`; explicitly activated SQL uses `data/huiguan/users.db` `oc_*` tables | backend fence and atomic JSON temporary sibling |
| Imported legacy game saves | `data/huiguan/game_saves.json` retained as migration source | — |
| Huiguan uploads, avatars and showcase documents | `assets/managed/huiguan/uploads/`, `assets/managed/huiguan/store/` | — |
| Editable worldview, image moderation and sticker metadata | `data/worldview/worldview_luoxiaohei_v4.db` | — |
| New worldview image/sticker uploads | `assets/managed/worldview/images/` | — |
| Public image derivatives | — | `cache/huiguan/previews/`, `cache/huiguan/thumbs/` |
| Cards OAuth user cache and feedback votes | `data/cards/users.db`, `data/cards/update-feedback.sqlite3` | — |
| Card balance editor | `data/cards/card-balance/config.json`, adjacent `backups/` | lock and atomic temporary files in the same external directory |
| Juling soul progression | `data/juling/save.db`; legacy `save.json` preserved | — |
| Homepage gallery interactions | `data/homepage/homepage-gallery.sqlite3` | SQLite sidecars |
| Homepage editable links/thanks | `data/homepage/config/{links,thanks}.json` and previous `.bak` | atomic `.tmp` sibling |
| Spirit local settings | `data/spirit/spirit-settings.json` | atomic `.tmp` sibling |
| Scraping observation logs | — | `cache/logs/scraping/`, bounded rotating process logs |
| Asset registry index | `data/assets/registry.sqlite3` | import manifests in the external backup/verification area |
| Local launcher (`tools/runtime/local-runtime.py`) | — | `cache/runtime/local-runtime.json`, per-service working directories under `cache/runtime/`, logs under `cache/logs/local-runtime/` |
| Storage backups (`tools/runtime/backup-storage.py`) | `backups/snapshots/<UTC stamp>/` with a hashed manifest | — |
| Local data migration (`tools/runtime/storage-migrate.py`) | `backups/<migration>/manifest.json`; detached originals under `backups/<migration>/original-source/` | — |
| Private shared email/SSO configuration | `data/secrets/server.env` | — |

`assets/source/` contains supplied originals. The editable worldview database is a
separate persistent database even though the old implementation stored it beside
source images. Historical absolute image references are translated only through
`legacy_asset_roots` recorded by verified migration, with a containment check against
approved source/managed image roots. The database itself does not need a path rewrite.
An unavailable worldview database is opened with SQLite `mode=rw` and is never silently
recreated as an empty file.

Juling requires the configured SQLite runtime. An unavailable or damaged database
fails startup rather than silently switching storage formats. Existing JSON values
are imported idempotently in one transaction without deleting the original JSON.

Operations that accept an explicit fixture directory (balance store, spirit
middleware, account database helpers) are internal test seams; production adapters
select the unified storage helpers and require readiness. Files written by build,
publish, verifier and migration commands are covered by the release/migration runbooks.

## Layout and lifecycle

```
<IRIDESCENTLY_STORAGE_ROOT>/<environment>/
  data/      persistent databases, JSON records, secrets; .storage-ready.json
  assets/    source/ (supplied originals)  managed/ (user uploads, showcase store, new worldview images)
  cache/     previews, thumbnails, gallery WebP, logs, launcher state - safe to delete and rebuild
  releases/  candidate/ (build output)  store/<release-id>/ (immutable)  channels/<environment>.json
  backups/   migration evidence, recovery originals, snapshots
```

Checkout, `git clean`, builds, sealing and rollback only touch the source tree, `releases/candidate` or the channel pointer; none of them can reach `data/` or `assets/`. A rollback selects older code and keeps the current data, so schema changes stay additive (the Huiguan `sessions_db.audience` column defaults to the pre-existing root). `test` requires an explicit temporary `IRIDESCENTLY_STORAGE_ROOT`, and `tools/checks/regression.py` and CI always create one; nothing in the test suites can select production data.

The local `production` environment lives under `<工作区>\runtime`. Its migration copied 4,620 files (6.30 GiB, six SQLite databases via the SQLite backup API) from the former in-tree layout of `E:\Projects`, verified every file hash and each database's logical dump, and then detached the untracked originals into `backups/batch6-migration-20261025/original-source/`. `storage-migrate.py verify` re-checks targets against the manifest and the recovery originals; `restore-source` copies originals back without overwriting later data. Old build outputs and release snapshots still in `E:\Projects\.releases` are not runtime data and are left for the unchanged Hong Kong release tooling.

Regression checks use synthetic identities/images and disposable storage:
`services/platform/tests/test_account_progress.py`, `services/platform/tests/test_task_chains.py`,
`services/platform/tests/test_game_save_scope.py`, `services/platform/tests/test_gallery_interactions.py`,
`services/platform/tests/test_site_admin.py`, `services/platform/tests/test_huiguan_oauth_session.py`, `services/platform/tests/test_storage_paths.py`,
`services/platform/tests/test_storage_migration.py`, `services/platform/tests/test_operations_tools.py`, `services/platform/tests/test_runtime_services.py`,
`apps/huiguan/tests/test_original_image_access.py`, the remaining Huiguan API tests,
Cards identity/balance tests and Spirit settings tests. Run Python fixture modules in
separate processes: they deliberately configure their own environment and import-time
service state.

## OC backend fence

All OC reads/writes, including Cards candidates, use `services/platform/oc_store.py`.
`IRIDESCENTLY_OC_BACKEND` defaults to `json`; it never selects SQL automatically or dual-writes.
`data/huiguan/characters-storage-state.json` must agree with the selected backend; `frozen`
rejects OC access. Only offline, explicitly confirmed operations in `tools/runtime/oc-storage.py`
change the fence. Older binaries do not honor it and must be stopped by the operator.
SQL mutation and its gallery/poster/registration-point effects use the same users.db transaction.
The pre-cutover JSON remains a protected source; after SQL accepts writes, rollback must export
and reconcile current SQL data before JSON can be reactivated. See
[OC storage](storage/oc-sql-storage.md) and [manual runbook](storage/oc-sql-runbook.md).
