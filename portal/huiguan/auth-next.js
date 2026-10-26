(function (root) {
  const domains = typeof module === 'object' && module.exports
    ? require('../../packages/site-domains/index.js') : root.IridescentlyDomains;
  if (!domains) throw new Error('Load /shared/site-domains/index.js before auth-next.js');
  const safeAuthNext = raw => domains.safeReturn(raw);
  if (typeof module === 'object' && module.exports) module.exports = safeAuthNext;
  if (root) root.safeAuthNext = safeAuthNext;
})(typeof window === 'undefined' ? null : window);
