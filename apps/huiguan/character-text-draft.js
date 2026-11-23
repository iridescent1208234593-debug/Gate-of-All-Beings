/* Tab-local text only. Never restore a saved character or submit from this module. */
((global) => {
  'use strict';
  const prefix = 'huiguan-new-oc-text-draft:v1:';
  const fields = ['species_detail', 'personality', 'height', 'likes', 'dislikes', 'food', 'appearance', 'background'];
  const ttl = 12 * 60 * 60 * 1000;
  function draftScope(identity) {
    if (identity?.logged_in === false) return 'guest';
    if (identity?.logged_in !== true || !['local', 'usso'].includes(identity.kind)) return null;
    const uid = typeof identity.user_id === 'number' && Number.isSafeInteger(identity.user_id)
      ? String(identity.user_id) : identity.user_id;
    return typeof uid === 'string' && /^[a-zA-Z0-9_-]{1,96}$/.test(uid) ? identity.kind + ':' + uid : null;
  }
  function draftText(value) {
    if (typeof value !== 'string' || value.length > 8192) return '';
    // Do not retain text with obvious contact identifiers; no form account fields or uploaded files enter the allowlist.
    return /@|https?:|www\.|(?:\d[\s-]*){7}/i.test(value) ? '' : value;
  }
  function create({ form, restore, discard, panel, storage, now = Date.now }) {
    let scope = null, verified = null, editing = false, acceptedExisting = false, version = 0;
    function storageRead(key) {
      if (!key) return null;
      try { return storage.getItem(key); } catch { return null; }
    }
    function read(key) {
      try {
        const serialized = storageRead(key);
        const saved = JSON.parse(serialized);
        if (!saved || !Number.isFinite(saved.time)) return null;
        if (now() - saved.time > ttl || saved.time > now()) {
          try { storage.removeItem(key); } catch { /* Read-only storage. */ }
          return null;
        }
        const values = Object.fromEntries(fields.map(key => [key, draftText(saved.values?.[key])]));
        return Object.values(values).some(Boolean) ? { serialized, values } : null;
      } catch { return null; }
    }
    const key = () => scope && !editing ? prefix + scope : null;
    const display = () => { panel.hidden = !read(key()); };
    function write() {
      const at = key();
      if (!at || (read(at) && !acceptedExisting)) return;
      const values = Object.fromEntries(fields.map(key => [key, draftText(form.elements.namedItem(key)?.value)]));
      try {
        if (Object.values(values).some(Boolean)) {
          storage.setItem(at, JSON.stringify({time: now(), version: ++version, values}));
          acceptedExisting = true;
        } else if (acceptedExisting) storage.removeItem(at);
      } catch { /* A disabled browser store must not block editing. */ }
      display();
    }
    function clearTicket(ticket) {
      if (!ticket?.key || storageRead(ticket.key) !== ticket.serialized) return false;
      try { storage.removeItem(ticket.key); } catch { return false; }
      display();
      return true;
    }
    form.addEventListener('input', event => {
      if (fields.includes(event.target.name)) write();
    });
    restore.addEventListener('click', () => {
      const saved = read(key());
      if (!saved) return;
      for (const [name, value] of Object.entries(saved.values)) {
        const control = form.elements.namedItem(name);
        if (control && !control.disabled && value) control.value = value;
      }
      acceptedExisting = true;
      restore.focus();
    });
    discard.addEventListener('click', () => {
      const at = key(), saved = read(at);
      if (saved) clearTicket({key: at, serialized: saved.serialized});
      acceptedExisting = false;
      form.elements.namedItem('personality')?.focus();
    });
    return {
      suspend() { scope = null; display(); },
      setIdentity(identity, beforeSwitch = () => {}) {
        const next = draftScope(identity);
        if (next && verified && next !== verified) beforeSwitch(verified, next);
        if (next !== verified) acceptedExisting = false;
        if (next) verified = next;
        scope = next;
        display();
      },
      setEditing(value) { editing = value; acceptedExisting = false; display(); },
      ticket() {
        const at = key();
        // An un-restored old draft is unrelated to the current submission.
        const saved = acceptedExisting && read(at);
        return saved ? {key: at, serialized: saved.serialized} : null;
      },
      clearTicket,
    };
  }

  global.HuiguanCharacterTextDraft = {create, draftScope};
})(typeof window === 'undefined' ? globalThis : window);
