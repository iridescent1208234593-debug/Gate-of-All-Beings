// 西木会馆 Toy 页面：只调用 B站 Toy SDK 的站内跳转与二维码，不访问任何站外地址。
(function () {
  'use strict';
  var links = JSON.parse(document.getElementById('toy-links').textContent || '[]');
  var sdk = window.toy;
  var follow = document.getElementById('follow');
  var actions = document.getElementById('actions');
  var hint = document.getElementById('env-hint');

  function supports(ability) {
    if (!sdk || typeof sdk.isSupport !== 'function') return Promise.resolve(false);
    return sdk.isSupport(ability).catch(function () { return false; });
  }

  if (links.length) {
    follow.hidden = false;
    supports('navigate').then(function (canNavigate) {
      links.forEach(function (link) {
        var button = document.createElement('button');
        button.type = 'button';
        button.textContent = link.label;
        button.disabled = !canNavigate;
        // navigate 必须在用户手势里同步发起，这里直接在 click 中调用。
        button.addEventListener('click', function () {
          sdk.navigate({ type: link.type, id: link.id, extra: { from: 'toy' } }).catch(function () {
            hint.textContent = '跳转没有成功，请稍后再试。';
            hint.hidden = false;
          });
        });
        actions.appendChild(button);
      });
      hint.hidden = canNavigate;
    });
  }

  // 桌面端显示本 Toy 首页二维码，方便换到手机继续看；二维码内容由平台生成，只能指向本 Toy。
  if (window.matchMedia('(min-width: 768px)').matches) {
    supports('getQrCode').then(function (ok) {
      if (!ok) return;
      return sdk.getQrCode({ size: 400 }).then(function (result) {
        document.getElementById('qr').src = result.base64;
        document.getElementById('handoff').hidden = false;
      });
    }).catch(function () { /* 二维码只是便利功能，失败时保持隐藏 */ });
  }
})();
