/* Superseded by the design-system site bar. Kept so cached pages that still load this file get the same bar. */
(function () {
  if (window.IridescentlyNav || document.querySelector('script[data-iridescently-nav]')) return;
  var script = document.createElement('script');
  script.src = '/shared/shared-ui/site-nav.js?v=20261027z';
  script.dataset.iridescentlyNav = '';
  if (/^huiguan\./.test(location.hostname) && /^\/(?:index\.html)?$/.test(location.pathname)) script.dataset.variant = 'overlay';
  document.body.appendChild(script);
})();
