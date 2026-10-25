(function (root) {
  const domains = typeof module === 'object' && module.exports
    ? require('../../shared/site-domains.js') : root.IridescentlyDomains;
  if (!domains) throw new Error('Load /shared/site-domains.js before auth-next.js');
  const safeAuthNext = raw => domains.safeReturn(raw);
  if (typeof module === 'object' && module.exports) module.exports = safeAuthNext;
  if (root) root.safeAuthNext = safeAuthNext;
})(typeof window === 'undefined' ? null : window);
