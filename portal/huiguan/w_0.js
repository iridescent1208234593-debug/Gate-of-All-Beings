
(function() {
  // 添加 body class
  document.body.classList.add('has-topnav');
  
  // 根据当前域名高亮对应链接
  var hostname = window.location.hostname;
  var siteMap = {
    'iridescently.xyz': 'main',
    'huiguan.iridescently.xyz': 'huiguan',
    'oc.iridescently.xyz': 'oc',
    'psyche.iridescently.xyz': 'psyche',
    'zszm.iridescently.xyz': 'zszm'
  };
  var currentSite = siteMap[hostname] || 'main';
  
  // 高亮当前站点链接
  var links = document.querySelectorAll('.topnav a[data-site]');
  for (var i = 0; i < links.length; i++) {
    if (links[i].getAttribute('data-site') === currentSite) {
      links[i].classList.add('active');
    }
  }
})();
