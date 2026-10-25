(function (root, factory) {
  const safeAuthNext = factory();
  if (typeof module === 'object' && module.exports) module.exports = safeAuthNext;
  if (root) root.safeAuthNext = safeAuthNext;
})(typeof window === 'undefined' ? null : window, function () {
  const allowedHosts = new Set([
    'iridescently.xyz', 'www.iridescently.xyz', 'huiguan.iridescently.xyz', 'oc.iridescently.xyz',
    'spirit.iridescently.xyz', 'zszm.iridescently.xyz', 'game.iridescently.xyz', 'juling.iridescently.xyz',
    'lingjing.iridescently.xyz', 'pc.iridescently.xyz', 'pc-www.iridescently.xyz', 'pc-huiguan.iridescently.xyz',
    'pc-oc.iridescently.xyz', 'pc-spirit.iridescently.xyz', 'pc-zszm.iridescently.xyz', 'pc-game.iridescently.xyz',
    'pc-juling.iridescently.xyz', 'pc-lingjing.iridescently.xyz',
  ]);

  return function safeAuthNext(raw) {
    if (typeof raw !== 'string' || !raw.startsWith('https://')) return '';
    const authority = raw.slice(8).split(/[/?#]/, 1)[0];
    try {
      const url = new URL(raw);
      if (url.protocol !== 'https:' || url.username || url.password || url.port ||
          authority.toLowerCase() !== url.hostname || !allowedHosts.has(url.hostname.toLowerCase())) return '';
      return url.href;
    } catch {
      return '';
    }
  };
});
