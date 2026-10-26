# Source, build candidates and releases

Batch 6 uses `services/platform/storage_paths.py` and `services/platform/runtime-paths.cjs` as one storage contract. `IRIDESCENTLY_PROJECT_ROOT` selects source code only; it never selects user databases, uploads or deployed output. `IRIDESCENTLY_STORAGE_ROOT` selects an external parent, with separate `development`, `staging`, `production` and `test` environments. Test mode requires an explicit temporary storage parent.

Each environment has sibling `data`, `assets`, `cache`, `releases` and `backups` roots. Explicit `IRIDESCENTLY_DATA_ROOT`, `IRIDESCENTLY_ASSETS_ROOT`, `IRIDESCENTLY_CACHE_ROOT`, `IRIDESCENTLY_RELEASE_ROOT` and `IRIDESCENTLY_BACKUP_ROOT` overrides must remain outside source and must not overlap each other. Service startup requires the verified storage readiness marker; a new empty production data directory does not become a healthy new installation.

| Command | Output below the selected environment release root |
| --- | --- |
| `npm run build:homepage` | `candidate/homepage` |
| `npm run build:cards` | `candidate/cards` |
| `npm run build:world-map` | `candidate/world-map` |
| `npm run build:modules` | `candidate/modules` |
| `npm run build:release` | modules and homepage candidates |
| `npm run build:site` | committed source snapshot in `candidate/site` |

Build implementations live in the Git repository under `scripts/`, `server/app/scripts/` and `apps/www/scripts/`. The external Operations build entry points load these versioned scripts from the selected checkout. Building does not require old local production directories or already deployed modules. Cards' optional historical nested copies of management/ecology are no longer copied from deployed output; these modules are built independently.

The homepage consumes originals from `assets/source/罗小黑战记数据库/罗小黑节气贺图（gallery素材）`, or explicit `GALLERY_DIR`. WebP previews are generated under `cache/homepage/gallery-previews`. Only previews enter the public homepage candidate; originals remain behind the authenticated original-image API. Builds may use temporary fixture originals without any production database. The optional Slay image input is declared in `tools/build/module-assets.json` or `IRIDESCENTLY_SLAY_IMAGES_DIR`; missing configured assets fail explicitly.

`build:site` exports Git HEAD for `portal`, `server` and `shared`. It excludes dependencies, generated modules/homepage output, gallery-engine, uploads/store, databases/SQLite sidecars, character/save data, environment secrets and logs. An uncommitted Python edit is not silently copied into the exported snapshot. Generated gate code is then built from the selected checkout, so `sourceDirty` still records whether that checkout has uncommitted changes. Release acceptance requires a final clean committed rebuild.

Every candidate manifest records the repository URL without credentials, branch, source commit, dirty state, build command, Node/platform information, time and SHA-256 of every output file. Homepage also records its external source asset file count and a deterministic combined SHA-256. `verifyCandidate()` rejects changed file sets and changed bytes. Caller metadata cannot replace the source commit or hashes.

Building and recording a manifest do not activate a release. A deployment controller must select an immutable version from this external release root and pass the same external storage environment to all services. Replacing code, checkout or release pointers cannot replace persistent data. A code rollback selects older code and retains the current data roots; schema compatibility must be checked before activation. Production publishing, service restarts and traffic changes remain separate operational actions.

For a local release, build `site`, `modules` and `homepage` from the same clean commit, then run `npm run release:seal`. The publisher verifies all candidates, copies source to `releases/store/<id>/site`, overlays modules/homepage, verifies copied bytes, and records a complete `manifest.json` beside the site directory. It then atomically updates `releases/channels/<environment>.json` with `current`, `previous`, a relative `site` path and the manifest SHA-256. It never renames an existing release or writes persistent data. A channel lock prevents concurrent activations; an orphan lock after interruption requires inspection before retrying.

`npm run release:rollback -- <release-id>` verifies the stored file set and hashes, then selects that existing release by updating only the channel. The local launcher reads the channel and starts services separately; sealing/rollback do not restart services. The former partial `publish:*` commands, which overwrote source-tree output, were removed; build the three candidates and seal one complete release instead. The external Operations `publish-release.mjs` delegates to this same local implementation.

The historical v2 pointer-switch proposal in `release-architecture-v2.md` describes release activation mechanics; its old `.releases` paths and source-root data contract are superseded by this storage contract. This Batch does not modify Hong Kong production routing or run a live domain migration.

## Local runtime

`python scripts/local-runtime.py start` verifies storage readiness, the environment channel, the release ID format and the stored manifest hashes, then starts only loopback services from `releases/store/<id>/site`: portal 8080, Cards OAuth 5174, card balance 5178, Juling 5177 and Spirit 4173. Children receive the same storage environment, so each one re-checks readiness itself. It refuses occupied ports, partial runtimes and a running older release; `status` and `stop` act only on processes it recorded. It never starts tunnels, changes DNS or contacts Hong Kong. A production-environment portal accepts only approved hosts with a loopback `X-Forwarded-Proto: https`, so local checks send those headers, for example `curl -H "Host: zszm.iridescently.cn" -H "X-Forwarded-Proto: https" http://127.0.0.1:8080/api/sso-user`.

Checks: `node scripts/test-release-artifacts.mjs` verifies external test isolation, commit tracing and tamper rejection. `python -m unittest discover -s server -p test_source_export.py -v` proves snapshot export uses committed code and excludes fixture secrets/data.

`node scripts/test-publish-release.mjs` verifies clean-candidate enforcement, immutable assembly, current/previous pointer rollback, tamper rejection and preservation of external fixture data.
