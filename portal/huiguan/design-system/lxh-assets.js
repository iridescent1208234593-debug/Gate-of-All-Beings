// 罗小黑战记 · 素材库共享加载器（西木会馆设计系统）
// 用法：
//   <script src="https://huiguan.iridescently.xyz/design-system/lxh-assets.js"></script>
//   LXAssets.avatarUrl('无限')                 → 角色代表图（缩略）
//   LXAssets.avatarUrl('无限', { thumb:false }) → 原图
//   LXAssets.imageUrl(123)                     → 按 character_images.id 取图
//   await LXAssets.manifest()                  → 全量清单（角色/立绘/设计资源）
//   LXAssets.designURL('css' | 'font' | ...)   → 设计资源绝对 URL
(function (root) {
  var IS_SITE = /\.iridescently\.xyz$/.test(location.hostname);
  var BASE = IS_SITE ? 'https://huiguan.iridescently.xyz' : 'http://localhost:8089';
  var _manifest = null, _pending = null;

  function manifest() {
    if (_manifest) return Promise.resolve(_manifest);
    if (!_pending) {
      _pending = fetch(BASE + '/api/assets/manifest')
        .then(function (r) { if (!r.ok) throw new Error('manifest HTTP ' + r.status); return r.json(); })
        .then(function (m) { _manifest = m; return m; })
        .catch(function (e) { _pending = null; throw e; });
    }
    return _pending;
  }

  function abs(u) { return /^https?:/i.test(u) ? u : BASE + u; }

  // 角色代表图 URL；key 可为角色名（含别名）或数字 cid
  function avatarUrl(key, opts) {
    opts = opts || {};
    var q = /^\d+$/.test(String(key)) ? 'cid=' + key : 'name=' + encodeURIComponent(key);
    if (opts.thumb !== false) q += '&t=1';
    return BASE + '/api/assets/avatar?' + q;
  }

  // 按 character_images.id 取图 URL
  function imageUrl(id, opts) {
    opts = opts || {};
    var q = 'id=' + id;
    if (opts.thumb) q += '&t=1';
    return BASE + '/api/assets/image?' + q;
  }

  // 设计资源绝对 URL：css / ancientColors / frameDeco / logoText / font
  function designURL(key) {
    return manifest().then(function (m) { return abs(m.design[key] || ''); });
  }

  // 预加载一组角色代表图（缩略）
  function preload(keys) {
    (keys || []).forEach(function (k) {
      var link = document.createElement('link');
      link.rel = 'prefetch'; link.as = 'image'; link.href = avatarUrl(k);
      document.head.appendChild(link);
    });
  }

  root.LXAssets = { base: BASE, manifest: manifest, avatarUrl: avatarUrl, imageUrl: imageUrl, designURL: designURL, preload: preload };
})(window);
