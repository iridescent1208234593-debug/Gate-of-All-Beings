# Asset registry

`services/platform/asset_registry.py` indexes existing files in external `source`, `managed` and `cache` asset roots. SQLite lives under the persistent data root at `assets/registry.sqlite3`; metadata does not belong inside an asset tree.

Records contain a stable asset ID, metadata version, module/type, relative storage key, SHA-256, byte size, MIME, timestamps, provenance, author, license, content ID, access scope and optional original-asset reference. Content references are explicit `(reference_type, reference_id)` rows. Unknown rights remain unknown; importing files never infers a license or makes uploads public.

`register_file()` validates real paths under the selected root and hashes file bytes. Version allocation is serialized in a SQLite transaction. Repeating identical metadata and bytes returns the existing version. Connections use `contextlib.closing`, including queries and initialization, so Windows can rename/delete temporary databases immediately after use. `get_record(id, version)` reads historical metadata. Version history does not preserve overwritten original bytes; storage retention/backup remains a separate concern.

`resolve_path()` requires an explicit authorization callback for private and unlisted files. Public metadata alone does not expose an HTTP route. The existing original-image routes still enforce account/content policy; registry metadata is not a substitute for those checks. Tampered keys that escape a root are rejected again during resolution.

The importer walks existing regular files, rejects symbolic links and records deterministic IDs per storage class, module and relative key. It copies, rewrites and deletes no assets. Repeating an interrupted import is safe. A changed file creates a metadata version. A manifest records every ID/hash/size and the total count/bytes.

```powershell
python -X utf8 services/platform/asset_registry.py import "$env:IRIDESCENTLY_ASSETS_ROOT/managed" `
  --database "$env:IRIDESCENTLY_DATA_ROOT/assets/registry.sqlite3" `
  --storage-class managed --module huiguan --asset-type original `
  --access-scope private --manifest "registry-managed-manifest.json"
```

Set external environment roots first, or pass fully resolved explicit paths. Use distinct module imports for provenance when source assets and user uploads have different ownership. New registry CLI manifests are operational evidence and may contain private file names; keep real manifests in the external operations verification directory, not Git.

The registry supplies indexing, versioned metadata, references and safe resolution. It does not generate derivatives, grant user permissions, manage remote object stores or delete unreferenced originals. The local storage migrator owns verified copy, WAL-safe database backup and rollback.

`python -m unittest discover -s server -p test_asset_registry.py -v` covers metadata/version/hash behavior, outside paths and tampered keys, private/unlisted authorization, preview references, concurrent/idempotent imports and the Windows connection lifecycle.
