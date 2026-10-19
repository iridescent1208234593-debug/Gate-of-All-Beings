(function(){
  if(document.getElementById('ir-server-switch'))return;
  var host=location.hostname,pc=host==='pc.iridescently.xyz'||host.startsWith('pc-');
  var a=document.createElement('a');a.id='ir-server-switch';
  a.textContent=(pc?'本机新版':'香港稳定版')+' · 切换服务器';
  a.href='/__server/select?return='+encodeURIComponent(location.pathname+location.search+location.hash);
  var floating='position:fixed;left:14px;bottom:14px;z-index:2147483000;padding:9px 14px;border:1px solid #9eae9f;border-radius:999px;background:#fbf8f2;color:#294e42;font:13px/1.5 system-ui;box-shadow:0 3px 18px #0002;text-decoration:none';
  a.style.cssText=floating;
  document.body.appendChild(a);
  function place(){var panel=document.querySelector('#qc-nav .qc-more-panel');if(panel){if(a.parentNode!==panel)panel.prepend(a);a.style.cssText='display:block;text-decoration:none';}else{if(a.parentNode!==document.body)document.body.appendChild(a);a.style.cssText=floating;}}
  new MutationObserver(place).observe(document.body,{childList:true,subtree:true});place();
  if(pc)document.addEventListener('click',function(event){
    var link=event.target.closest('a[href]');
    if(!link||link.id==='stable'||link.hasAttribute('data-server-choice')||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.target==='_blank'||link.hasAttribute('download'))return;
    var url=new URL(link.href,location.href),names=['iridescently.xyz','www.iridescently.xyz','huiguan.iridescently.xyz','oc.iridescently.xyz','spirit.iridescently.xyz','zszm.iridescently.xyz','game.iridescently.xyz','juling.iridescently.xyz','lingjing.iridescently.xyz'];
    if(!names.includes(url.hostname)||url.searchParams.has('openauth')||url.pathname.startsWith('/api/')||url.pathname.startsWith('/auth/'))return;
    url.hostname=url.hostname==='iridescently.xyz'?'pc.iridescently.xyz':'pc-'+url.hostname.split('.')[0]+'.iridescently.xyz';
    event.preventDefault();location.assign(url.href);
  });
})();
