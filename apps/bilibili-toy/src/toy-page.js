// 西木会馆 Toy 页面：B站 站内跳转、本 Toy 二维码，以及从会馆只读接口实时读取档案室。
(function () {
  'use strict';
  var config = JSON.parse(document.getElementById('toy-links').textContent || '{}');
  var links = config.navigate || [];
  var hosts = config.hosts || [];
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

  // ---- 档案室：只接受批准主机上的 https 地址，用户文字一律当纯文本，并去掉其中的网址 ----
  function approved(value) {
    try {
      var url = new URL(value);
      return url.protocol === 'https:' && hosts.indexOf(url.hostname) >= 0 ? url.href : '';
    } catch (error) { return ''; }
  }
  function plain(value, limit) {
    var text = String(value || '').replace(/(?:https?:)?\/\/\S+/gi, '').replace(/\s+/g, ' ').trim();
    return text.length > limit ? text.slice(0, limit) + '…' : text;
  }
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }
  function card(item, official) {
    var article = el('article', 'oc');
    var name = plain(item.name, 40) || '未命名';
    var image = approved(item.image);
    if (image) {
      var img = el('img');
      img.src = image;
      img.alt = name;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', function () { img.replaceWith(el('span', 'oc-initial', name.charAt(0))); });
      article.appendChild(img);
    } else {
      article.appendChild(el('span', 'oc-initial', name.charAt(0)));
    }
    var body = el('div', 'oc-body');
    body.appendChild(el('b', '', name));
    if (!official) body.appendChild(el('small', '', '作者：' + (plain(item.user_name, 30) || '会馆用户')));
    var meta = [item.species, item.type, item.gender].map(function (v) { return plain(v, 20); }).filter(Boolean).join(' · ');
    if (meta) body.appendChild(el('small', '', meta));
    if (!official && item.story) body.appendChild(el('p', '', plain(item.story, 80)));
    var href = approved(item.url);
    if (href) {
      var a = el('a', '', official ? '查看档案' : '在会馆查看完整档案');
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener';
      body.appendChild(a);
    }
    article.appendChild(body);
    return article;
  }
  function fill(list, gridId, headingId, official) {
    var grid = document.getElementById(gridId);
    (list || []).forEach(function (item) { grid.appendChild(card(item, official)); });
    document.getElementById(headingId).hidden = !(list && list.length);
  }

  var status = document.getElementById('archive-status');
  if (config.archive && approved(config.archive) && status) {
    fetch(config.archive, { credentials: 'omit', mode: 'cors', referrerPolicy: 'no-referrer' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        if (!data || data.schema_version !== 1) throw new Error('unexpected archive');
        fill((data.fan || []).slice(0, 10), 'fan-grid', 'fan-h', false);
        fill((data.official || []).slice(0, 24), 'official-grid', 'official-h', true);
        status.textContent = '档案来自会馆的公开内容，随会馆实时更新。';
      })
      .catch(function () {
        status.textContent = '档案暂时没有读到，可以点下面的链接去会馆查看。';
      });
  }
})();
