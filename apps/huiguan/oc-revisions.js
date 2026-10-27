/* Revisions are transport metadata, never part of the author's OC data. */
(function(root) {
  const versions = Object.create(null);
  root.OCRevisions = {
    reset(records) {
      for (const key of Object.keys(versions)) delete versions[key];
      for (const record of records || []) this.accept(record);
    },
    accept(record) {
      if (record && Number.isInteger(record._oc_version)) versions[record.code] = record._oc_version;
    },
    version(code) { return versions[code] || 0; },
    snapshot() { return {...versions}; },
    renamed(previous, record) { if (previous && previous !== record.code) delete versions[previous]; this.accept(record); }
  };
})(typeof window === 'undefined' ? globalThis : window);
