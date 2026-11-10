/* 西木会馆 · 横屏游玩提示
 *
 * 用途：玩法页（众生之门及各模块）在手机竖屏下体验极差。
 * 本组件在竖屏 + 触屏设备时盖一层提示，引导用户横屏；
 * 用户点击后尝试 全屏 + 方向锁定，失败则回退为手动旋转提示。
 *
 * 用法：
 *   <script src="/shared/shared-ui/landscape-hint.js" defer></script>
 *   // 或在任意时刻手动控制
 *   IridescentlyLandscape.enable() / disable()
 *
 * 设计：宣纸底 + 墨绿字 + 金色描边，与站点设计系统一致。
 */
(function () {
  "use strict";

  var ID = "__qc_rotate";
  var enabled = false;
  var dismissed = false;
  var overlay = null;

  var CSS = [
    "#" + ID + "{position:fixed;inset:0;z-index:2147483600;display:none;place-items:center;",
    "padding:24px;background:rgba(20,34,28,.92);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);",
    "color:#f4eedf;font:14px/1.7 \"LXGW WenKai\",\"Noto Serif SC\",\"Songti SC\",serif;letter-spacing:.04em;text-align:center;box-sizing:border-box}",
    "#" + ID + ".on{display:grid}",
    "#" + ID + " .rc-wrap{max-width:340px}",
    "#" + ID + " .rc-icon{width:84px;height:84px;margin:0 auto 18px;position:relative}",
    "#" + ID + " .rc-phone{position:absolute;inset:14px 24px;border:2px solid rgba(230,192,106,.9);border-radius:10px;",
    "transition:transform .5s cubic-bezier(.4,0,.2,1);animation:qc-rotate-hint 2.6s ease-in-out infinite}",
    "#" + ID + " .rc-phone::after{content:'';position:absolute;left:50%;bottom:5px;transform:translateX(-50%);",
    "width:12px;height:2px;border-radius:2px;background:rgba(230,192,106,.9)}",
    "@keyframes qc-rotate-hint{0%,42%{transform:rotate(0)}58%,92%{transform:rotate(-90deg)}100%{transform:rotate(0)}}",
    "#" + ID + " h2{margin:0 0 8px;font-size:17px;font-weight:600;color:#f4eedf}",
    "#" + ID + " p{margin:0 0 18px;font-size:13px;color:rgba(244,238,223,.78)}",
    "#" + ID + " button{font:inherit;font-size:14px;letter-spacing:.08em;padding:11px 26px;border-radius:10px;cursor:pointer;",
    "border:1px solid rgba(230,192,106,.85);background:rgba(230,192,106,.14);color:#f4eedf;transition:background .18s}",
    "#" + ID + " button:hover{background:rgba(230,192,106,.26)}",
    "#" + ID + " .rc-skip{margin-left:8px;border-color:rgba(244,238,223,.28);background:transparent;color:rgba(244,238,223,.7)}",
    "#" + ID + " .rc-skip:hover{background:rgba(244,238,223,.08)}",
    "#" + ID + " .rc-tip{margin-top:14px;font-size:12px;color:rgba(244,238,223,.5)}",
    "@media (orientation:landscape){#" + ID + "{display:none !important}}"
  ].join("");

  function isTouchPhone() {
    // 只用「主指针是否粗糙」判断触摸设备：带触屏的笔记本 maxTouchPoints 也大于 0，
    // 用它会把这些设备在窄窗口下误判成手机。
    var coarse = window.matchMedia ? window.matchMedia("(pointer: coarse)").matches : null;
    var touch = coarse === null
      ? (("ontouchstart" in window) || navigator.maxTouchPoints > 0)
      : coarse;
    var small = Math.min(window.innerWidth, window.innerHeight) <= 820;
    return touch && small;
  }

  function isPortrait() {
    if (window.matchMedia) return window.matchMedia("(orientation:portrait)").matches;
    return window.innerHeight > window.innerWidth;
  }

  function build() {
    if (overlay) return overlay;
    var st = document.createElement("style");
    st.id = ID + "_css";
    st.textContent = CSS;
    document.head.appendChild(st);

    overlay = document.createElement("div");
    overlay.id = ID;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "请横屏游玩");
    overlay.innerHTML =
      '<div class="rc-wrap">' +
        '<div class="rc-icon"><span class="rc-phone"></span></div>' +
        '<h2>请横屏游玩</h2>' +
        '<p>玩法画面按横屏设计，竖屏下按钮与画面会挤在一起。</p>' +
        '<button type="button">转到横屏</button>' +
        '<button type="button" class="rc-skip">仍然竖屏浏览</button>' +
        '<div class="rc-tip">若没有自动旋转，请在系统中开启屏幕旋转后重新进入</div>' +
      "</div>";
    overlay.querySelector("button").addEventListener("click", goLandscape);
    // 提示只该劝阻，不该把人锁在当前页面：竖屏下必须留一条能离开的出口。
    overlay.querySelector(".rc-skip").addEventListener("click", function () {
      dismissed = true;
      overlay.classList.remove("on");
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  function goLandscape() {
    // 只做温和引导：不申请全屏、不锁方向，避免强制翻转影响其它页面
    var tip = overlay && overlay.querySelector(".rc-tip");
    if (tip) tip.textContent = "请把手机横向转动；若画面没有跟着转，请打开系统的「自动旋转」";
    var btn = overlay && overlay.querySelector("button");
    if (btn) { btn.textContent = "知道了"; btn.onclick = function () { overlay.classList.remove("on"); }; }
    sync();
  }

  function sync() {
    if (!enabled) { if (overlay) overlay.classList.remove("on"); return; }
    var need = !dismissed && isTouchPhone() && isPortrait();
    if (need) {
      build();
      overlay.classList.add("on");
    } else if (overlay) {
      overlay.classList.remove("on");
    }
  }

  function enable() { dismissed = false; enabled = true; sync(); }
  function disable() {
    dismissed = false;
    enabled = false;
    if (overlay) overlay.classList.remove("on");
  }

  window.IridescentlyLandscape = { enable: enable, disable: disable, active: function () { return enabled; } };

  // 带 data-auto 的 script 标签自动启用
  var self = document.currentScript;
  if (self && "auto" in self.dataset) {
    if (document.body) enable();
    else document.addEventListener("DOMContentLoaded", enable, { once: true });
  }

  window.addEventListener("resize", sync, { passive: true });
  window.addEventListener("orientationchange", function () { setTimeout(sync, 120); }, { passive: true });
})();
