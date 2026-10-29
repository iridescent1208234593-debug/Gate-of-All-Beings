/* 西木会馆 · 站点公告弹窗 v3
 *
 * 本版改动：
 *   1. 删除底部两个按钮 —— 关闭只靠右上角 ×
 *   2. 小眼睛移到左上角，× 在右上角
 *   3. 贺图完整展示（<img> + object-fit:contain，不裁切、不变形）
 *   4. 去掉滚动条（内容与图同高，超出隐藏）
 *   5. 动画：图片淡入后，内容由右（宽屏）/由下（窄屏）滑入，条目逐个错峰出现
 *
 * 配色：design-system/colors.html ｜ 插画：美术组 · 海苔 老师作画
 */
(function () {
  "use strict";

  var CONFIG = {
    version: "20261029f",
    title: "站点公告",
    subtitle: "西木会馆 · 众生之门",
    items: [
        ["域名迁移预告", "站点将逐步启用 iridescently.cn 作为正式地址，请提前更新收藏夹；旧地址后续会跳转"],
          ["名号规范", "官方角色名不得用作账号名或设表名；违规条目已清理。受影响账号请用绑定邮箱找回或联系管理员"],
        ["数值后台修复", "历练与数值编辑恢复正常，此前「数值后台未启动」已解决"],
        ["邮箱验证码", "发送间隔放宽到 30 秒，每个账号每小时可发 10 次"],
        ["灵质空间修复", "软体宠物与联机功能恢复正常"],
        ["点赞上线", "每张贺图都可以点赞，每人最多给 5 张图点赞"],
        ["留言功能", "给贺图点过赞就能留言，每 60 分钟一条"],
        ["节气画廊修复", "3D 画廊恢复正常显示，贺图可正常查看"],
        ["登录注册分离", "登录不再自动建号，新账号请点「注册账号」"],
        ["手机端优化", "公告弹窗与横屏提示适配手机，小屏更好用"],],
    art: "/__notice-bg.webp",
    watermark: "美术组 · 海苔 老师作画"
  };

  // 公告规则：最多 20 条，新的在最上面，旧的依次向下；新增内容必须提升 version。
  var MAX_ITEMS = 20;
  if (CONFIG.items && CONFIG.items.length > MAX_ITEMS) {
    CONFIG.items = CONFIG.items.slice(0, MAX_ITEMS);
  }
  var COOKIE = "lxh_notice_" + CONFIG.version;
  if (window.self !== window.top) return;
  if (("; " + document.cookie).indexOf("; " + COOKIE + "=1") !== -1) return;

  var CSS = ""
  + "#__lxh_notice{position:fixed;inset:0;z-index:2147483200;opacity:0;transition:opacity .38s ease;will-change:opacity;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;background:rgba(48,62,54,.55);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif}"
  + "#__lxh_notice.is-open{opacity:1}#__lxh_notice.is-closing{opacity:0;transition:opacity .34s ease}#__lxh_notice.is-closing .nc{opacity:0;transform:scale(.972) translateY(6px);transition:opacity .3s ease,transform .36s cubic-bezier(.16,1,.3,1)}#__lxh_notice.is-closing .nc-body{opacity:0;transform:translateY(10px);transition:opacity .22s ease,transform .26s ease}#__lxh_notice *{box-sizing:border-box}"
  /* 卡片 = 图片高度，无滚动 */
  + "#__lxh_notice .nc{position:relative;width:min(92vw,468px);max-height:calc(100vh - 24px);border-radius:16px;overflow:hidden;background:#0f1418;border:1px solid rgba(212,207,190,.5);box-shadow:0 26px 70px rgba(20,28,24,.55);line-height:0;opacity:0;transform:scale(.962) translateY(8px);transition:opacity .5s ease,transform .62s cubic-bezier(.16,1,.3,1);will-change:transform,opacity}"
  + "#__lxh_notice.is-open .nc{opacity:1;transform:none}#__lxh_notice .nc-art{display:block;width:100%;height:auto;max-height:calc(100vh - 24px);object-fit:contain;opacity:0;transform:scale(1.045);transition:opacity .8s ease .06s,transform 1.25s cubic-bezier(.16,1,.3,1) .06s;will-change:transform,opacity;line-height:0}"
  + "#__lxh_notice.is-img .nc-art{opacity:1;transform:none}"
  /* 内容层：覆盖在图片下部，无滚动 */
  + "#__lxh_notice .nc-body{position:absolute;left:0;right:0;bottom:0;padding:12px 14px 10px;line-height:1.6;overflow:hidden;background:linear-gradient(180deg,rgba(251,248,242,0) 0%,rgba(251,248,242,.88) 18%,rgba(251,248,242,.97) 34%,#fbf8f2 60%);opacity:0;transform:translateY(16px);transition:opacity .62s ease .2s,transform .78s cubic-bezier(.16,1,.3,1) .2s;pointer-events:none;will-change:transform,opacity}"
  + "#__lxh_notice .nc-body.on{opacity:1;transform:none;pointer-events:auto}"
  + "#__lxh_notice .nc-title{font-family:'Noto Serif SC','Songti SC',serif;font-size:17px;font-weight:700;letter-spacing:.06em;color:#3a4a3e;margin:0 0 1px;display:block}"
  + "#__lxh_notice .nc-sub{font-size:10.5px;letter-spacing:.16em;color:#7a8a7e;margin-bottom:8px;display:block}"
  + "#__lxh_notice .nc-list{max-height:min(46vh,320px);overflow-y:auto;overflow-x:hidden;margin:2px 0 4px;padding-right:6px;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:rgba(122,138,126,.45) transparent;scrollbar-width:thin;scrollbar-color:#d4cfbe rgba(0,0,0,0);-webkit-overflow-scrolling:touch}#__lxh_notice .nc-list::-webkit-scrollbar{width:4px}#__lxh_notice .nc-list::-webkit-scrollbar-track{background:transparent}#__lxh_notice .nc-list::-webkit-scrollbar-thumb{background:#d4cfbe;border-radius:2px}#__lxh_notice .nc-list::-webkit-scrollbar-thumb:hover{background:#bdb6a0}#__lxh_notice .nc-item{display:block;padding:3px 8px;border-radius:6px;background:rgba(245,240,232,.94);border:1px solid #d4cfbe;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:0;transform:translateY(10px) scale(.985);transition:opacity .55s ease,transform .6s cubic-bezier(.16,1,.3,1);content-visibility:auto}"
        + "#__lxh_notice .nc-list::-webkit-scrollbar{width:5px}"
        + "#__lxh_notice .nc-list::-webkit-scrollbar-track{background:transparent}"
        + "#__lxh_notice .nc-list::-webkit-scrollbar-thumb{background:rgba(122,138,126,.35);border-radius:99px}"
  + "#__lxh_notice .nc-body.on .nc-item{opacity:1;transform:none}"
  + "#__lxh_notice .nc-item{display:block!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important;overflow-wrap:anywhere!important;line-height:1.42!important;margin:0 0 4px}"
  + "#__lxh_notice .nc-item:last-child{margin-bottom:0}"
  + "#__lxh_notice .nc-item b{display:inline!important;white-space:normal!important;line-height:1.42!important;font-size:12px;color:#3a4a3e;margin-right:5px}"
  + "#__lxh_notice .nc-item span{display:inline!important;white-space:normal!important;overflow-wrap:anywhere!important;text-overflow:clip!important;font-size:11.5px;line-height:1.42;color:#7a8a7e}"
  + "#__lxh_notice .nc-mark{display:block;margin-top:5px;text-align:right;font-size:9.5px;letter-spacing:.05em;color:#7a8a7e}"
  /* 左上：小眼睛；右上：关闭 */
  + "#__lxh_notice .nc-btn{position:absolute;top:9px;width:32px;height:32px;display:grid;place-items:center;border:1px solid rgba(251,248,242,.55);border-radius:50%;background:rgba(12,18,20,.45);color:#fbf8f2;cursor:pointer;padding:0;z-index:4;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);transition:background .2s,transform .2s;line-height:0}"
  + "#__lxh_notice .nc-btn:hover{background:rgba(12,18,20,.66);transform:scale(1.07)}"
  + "#__lxh_notice .nc-btn svg{width:16px;height:16px;display:block}"
  + "#__lxh_notice .nc-eye{left:9px}"
  + "#__lxh_notice .nc-x{right:9px}"
  /* 只看贺图 */
  + "#__lxh_notice.is-artonly .nc-body{opacity:0;transform:translateY(14px);pointer-events:none}"
  /* 平板 */
  + "@media(max-width:899px){#__lxh_notice .nc{width:min(88vw,420px)}#__lxh_notice .nc-body{transform:translateY(22px)}}"
  + "@media(prefers-reduced-motion:reduce){#__lxh_notice,#__lxh_notice .nc,#__lxh_notice .nc-art,#__lxh_notice .nc-body,#__lxh_notice .nc-item{transition-duration:.01ms !important;transform:none !important;opacity:1 !important}}"
  + "@media(max-width:599px){#__lxh_notice{padding:8px}#__lxh_notice .nc{width:min(94vw,400px);border-radius:13px}#__lxh_notice .nc-body{padding:10px 11px 8px}#__lxh_notice .nc-title{font-size:15.5px}#__lxh_notice .nc-item{padding:3px 7px;margin-bottom:3px}#__lxh_notice .nc-item b{font-size:11.4px;margin-right:4px}#__lxh_notice .nc-item span{font-size:10.9px;line-height:1.5}#__lxh_notice .nc-btn{width:29px;height:29px;top:7px}#__lxh_notice .nc-eye{left:7px}#__lxh_notice .nc-x{right:7px}#__lxh_notice .nc-btn svg{width:14px;height:14px}}";
  CSS += "@media (max-width:520px){"+"#__lxh_notice{padding:10px}"+"#__lxh_notice .nc{width:calc(100vw - 20px);max-width:100%;max-height:calc(100dvh - 20px)}"+"#__lxh_notice .nc-body{left:0;right:0;padding:10px 11px 8px}"+"#__lxh_notice .nc-list{max-height:46dvh;overflow-y:auto;-webkit-overflow-scrolling:touch}"+"#__lxh_notice .nc-item{white-space:normal;line-height:1.5;padding:5px 8px;margin-bottom:4px}"+"#__lxh_notice .nc-item span{font-size:11.5px;word-break:break-word}"+"#__lxh_notice .nc-title{font-size:15px}"+"#__lxh_notice .nc-sub{font-size:10px;margin-bottom:6px}";
  CSS += "@media (max-width:520px){"+"#__lxh_notice{overflow-x:hidden}"+"#__lxh_notice .nc{width:calc(100vw - 16px)!important;max-width:calc(100vw - 16px)!important;margin:0 auto}"+"#__lxh_notice .nc-art{width:100%!important;max-width:100%!important;height:auto!important}"+"#__lxh_notice .nc-body,#__lxh_notice .nc-list{max-width:100%!important;left:0;right:0}"+"#__lxh_notice .nc-item b{display:block;margin:0 0 2px}"+"#__lxh_notice .nc-item span{display:block}"+"#__lxh_notice .nc-item{white-space:normal!important;overflow:visible}";
  CSS += "@media (max-height:520px){"+"#__lxh_notice .nc-art{display:none!important}"+"#__lxh_notice .nc{width:min(96vw,520px);max-height:calc(100dvh - 16px);background:#fbf8f2}"+"#__lxh_notice .nc-body{position:relative;background:#fbf8f2;max-height:none}"+"#__lxh_notice .nc-list{max-height:calc(100dvh - 120px);overflow-y:auto}"+"#__lxh_notice .nc-item{white-space:normal}";

  function el(t, c) { var n = document.createElement(t); if (c) n.className = c; return n; }

  var EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M1.8 12S5.4 5.6 12 5.6 22.2 12 22.2 12 18.6 18.4 12 18.4 1.8 12 1.8 12Z"/><circle cx="12" cy="12" r="3.1"/></svg>';
  var EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M3 3l18 18"/><path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c6.6 0 10.2 6 10.2 6a17 17 0 0 1-3.3 4"/><path d="M6.3 7.5A16.6 16.6 0 0 0 1.8 12S5.4 18 12 18a9.7 9.7 0 0 0 4.2-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  var X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  function remember() {
    try {
    // 按当前域名推导根域：站点同时存在于 .xyz / .cn / .dpdns.org
    var _roots = ["iridescently.dpdns.org", "iridescently.xyz", "iridescently.cn"];
    var _host = (location.hostname || "").toLowerCase();
    var _root = "";
    for (var _i = 0; _i < _roots.length; _i++) {
      var _r = _roots[_i];
      if (_host === _r || _host.slice(-(_r.length + 1)) === "." + _r) { _root = _r; break; }
    }
    // 1 小时后再提醒；同一版本内容关闭后不再打扰
    document.cookie = COOKIE + "=1; " + (_root ? "domain=." + _root + "; " : "") + "path=/; max-age=3600; SameSite=Lax";
  } catch (e) {}
  }

  function build() {
    var shade = el("div"); shade.id = "__lxh_notice";
    shade.setAttribute("role", "dialog");
    shade.setAttribute("aria-modal", "true");

    var card = el("div", "nc");
    var art = el("img", "nc-art");
    art.alt = CONFIG.watermark;
    art.decoding = "async";

    var body = el("div", "nc-body");
    var t = el("span", "nc-title"); t.textContent = CONFIG.title; body.appendChild(t);
    var s = el("span", "nc-sub"); s.textContent = CONFIG.subtitle; body.appendChild(s);
    var list = el("div", "nc-list");
    CONFIG.items.forEach(function (row, i) {
      var it = el("div", "nc-item");
      it.style.transitionDelay = (0.16 + i * 0.07) + "s";
      var b = el("b"); b.textContent = row[0];
      var p = el("span"); p.textContent = row[1];
      it.appendChild(b); it.appendChild(p); list.appendChild(it);
    });
    body.appendChild(list);
    var mk = el("span", "nc-mark"); mk.textContent = CONFIG.watermark; body.appendChild(mk);

    var eye = el("button", "nc-btn nc-eye");
    eye.type = "button"; eye.innerHTML = EYE;
    eye.setAttribute("aria-label", "只看贺图");
    eye.setAttribute("title", "只看贺图 / 显示文字");

    var x = el("button", "nc-btn nc-x");
    x.type = "button"; x.innerHTML = X;
    x.setAttribute("aria-label", "关闭");
    x.setAttribute("title", "关闭");

    card.appendChild(art); card.appendChild(body); card.appendChild(eye); card.appendChild(x);
    shade.appendChild(card);

    eye.onclick = function (ev) {
      ev.stopPropagation();
      var on = shade.classList.toggle("is-artonly");
      eye.innerHTML = on ? EYE_OFF : EYE;
      eye.setAttribute("aria-label", on ? "显示文字" : "只看贺图");
    };

    var closing = false;
    function close() {
      if (closing) return;
      closing = true;
      remember();
      shade.classList.add("is-closing");
      setTimeout(function () {
        shade.remove();
        document.documentElement.style.overflow = "";
        if (document.body) document.body.style.overflow = "";
      }, 380);
    }
    x.onclick = close;
    shade.addEventListener("click", function (e) { if (e.target === shade) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

    // 动画：图片先淡入 → 内容再滑入 → 条目错峰
    var reveal = function () {
      shade.classList.add("is-open");
      setTimeout(function () { shade.classList.add("is-img"); }, 60);
      setTimeout(function () {
        body.classList.add("on");
      }, 340);
    };
    art.onload = reveal;
    art.onerror = function () { setTimeout(reveal, 300); };
    art.src = CONFIG.art;
    if (art.complete && art.naturalWidth) reveal();
    setTimeout(reveal, 1400);

    return shade;
  }

  function show() {
    if (document.getElementById("__lxh_notice")) return;
    if (!document.getElementById("__lxh_notice_css")) {
      var st = document.createElement("style"); st.id = "__lxh_notice_css"; st.textContent = CSS;
      document.head.appendChild(st);
    }
    document.documentElement.style.overflow = "hidden";
    if (document.body) document.body.style.overflow = "hidden";
    document.body.appendChild(build());
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", show); else show();
})();
