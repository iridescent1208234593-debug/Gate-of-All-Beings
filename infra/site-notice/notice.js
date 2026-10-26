/* 西木会馆 · 站点公告（统一弹窗）
 * 布局：整张卡片以万圣节插画为背景（cover），叠纸色半透明蒙版保证文字可读
 * 配色：全部取自设计系统 design-system.css
 *   --qc-panel #fbf8f2  --qc-bg #f5f0e8  --qc-border #d4cfbe
 *   --qc-text  #3a4a3e  --qc-dim #7a8a7e  --qc-accent #5a9e8f
 * 插画：美术组 海苔 老师作画
 * 规则：同一 version 只弹一次（cookie 跨子站共享）；iframe 内不显示。 */
(function () {
  "use strict";

  var C = {
    panel: "#fbf8f2", bg: "#f5f0e8", border: "#d4cfbe",
    text: "#3a4a3e", dim: "#7a8a7e", accent: "#5a9e8f", onAccent: "#ffffff"
  };

  var CONFIG = {
    version: "20261025i",
    title: "站点公告",
    subtitle: "西木会馆 · 众生之门",
    items: [
      ["站点入口调整", "打开 iridescently.xyz 会直接进入西木会馆；节气画廊搬到 /gallery.html。"],
      ["新增与修复", "世界地图已上线（门庭 → 世界地图）；头像显示、上传压缩、图片预览均已修复。"],
      ["关于支持", "PayPal 赞助暂时停用，恢复时间待定。感谢每一位愿意支持的朋友。"],
      ["欢迎反馈", "遇到任何异常，请把页面和操作时间告诉我们，能显著加快定位。"]
    ],
    primary: { label: "进入西木会馆", href: "https://huiguan.iridescently.xyz/" },
    dismiss: "我知道了",
    bg: "/__notice-bg.webp",
    watermark: "美术组 · 海苔 老师作画"
  };

  var COOKIE = "lxh_notice_" + CONFIG.version;
  if (window.self !== window.top) return;
  if (("; " + document.cookie).indexOf("; " + COOKIE + "=1") !== -1) return;

  function remember() {
    try { document.cookie = COOKIE + "=1; domain=.iridescently.xyz; path=/; max-age=31536000; SameSite=Lax; Secure"; } catch (e) {}
  }

  function build() {
    var shade = document.createElement("div");
    shade.id = "__lxh_notice";
    shade.setAttribute("role", "dialog");
    shade.setAttribute("aria-modal", "true");
    shade.style.cssText = [
      "position:fixed","inset:0","z-index:2147483200",
      "background:rgba(58,74,62,.45)","backdrop-filter:blur(4px)","-webkit-backdrop-filter:blur(4px)",
      "display:flex","align-items:center","justify-content:center",
      "padding:14px","box-sizing:border-box","overflow:auto",
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif"
    ].join(";");

    // 整卡背景 = 插画 + 纸色蒙版（上方薄、下方厚，保证正文区域清晰）
    var card = document.createElement("div");
    card.style.cssText = [
      "position:relative","max-width:560px","width:100%","max-height:calc(100vh - 28px)",
      "display:flex","flex-direction:column","overflow:hidden","border-radius:14px",
      "border:1px solid " + C.border,
      "box-shadow:0 22px 60px rgba(58,74,62,.32)",
      "background-image:linear-gradient(180deg, rgba(251,248,242,.58) 0%, rgba(251,248,242,.86) 34%, rgba(251,248,242,.95) 62%, rgba(251,248,242,.97) 100%), url('" + CONFIG.bg + "')",
      "background-size:cover, cover",
      "background-position:center top, center top",
      "background-repeat:no-repeat, no-repeat",
      "background-color:" + C.panel
    ].join(";");

    var body = document.createElement("div");
    body.style.cssText = "flex:1 1 auto;min-height:0;overflow:auto;padding:22px 22px 18px;box-sizing:border-box";

    var h = document.createElement("div");
    h.textContent = CONFIG.title;
    h.style.cssText = "font-size:19px;font-weight:700;color:" + C.text + ";letter-spacing:.06em;margin-bottom:2px;font-family:'Noto Serif SC','Songti SC',serif;text-shadow:0 1px 8px rgba(251,248,242,.9)";
    body.appendChild(h);

    var sub = document.createElement("div");
    sub.textContent = CONFIG.subtitle;
    sub.style.cssText = "font-size:11.5px;color:" + C.dim + ";letter-spacing:.16em;margin-bottom:14px;text-shadow:0 1px 6px rgba(251,248,242,.9)";
    body.appendChild(sub);

    CONFIG.items.forEach(function (row) {
      var item = document.createElement("div");
      item.style.cssText = "margin:0 0 9px;padding:9px 12px;border-radius:8px;background:rgba(251,248,242,.90);border:1px solid rgba(212,207,190,.9)";
      var t = document.createElement("div");
      t.textContent = row[0];
      t.style.cssText = "font-weight:600;color:" + C.text + ";margin-bottom:2px;font-size:13.5px";
      var d = document.createElement("div");
      d.textContent = row[1];
      d.style.cssText = "color:" + C.dim + ";font-size:13.2px;line-height:1.7";
      item.appendChild(t); item.appendChild(d); body.appendChild(item);
    });

    var actions = document.createElement("div");
    actions.style.cssText = "display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:9px;margin-top:14px";

    if (CONFIG.primary && CONFIG.primary.href) {
      var go = document.createElement("a");
      go.href = CONFIG.primary.href;
      go.textContent = CONFIG.primary.label;
      go.style.cssText = "text-align:center;padding:11px 14px;border-radius:8px;text-decoration:none;font-size:14.5px;font-weight:700;background:" + C.accent + ";color:" + C.onAccent + ";box-shadow:0 4px 14px rgba(90,158,143,.3)";
      actions.appendChild(go);
    }
    var ok = document.createElement("button");
    ok.type = "button";
    ok.textContent = CONFIG.dismiss;
    ok.style.cssText = "padding:11px 14px;border-radius:8px;border:1px solid " + C.border + ";background:rgba(251,248,242,.95);color:" + C.text + ";font-size:14px;font-weight:600;cursor:pointer;font-family:inherit";
    actions.appendChild(ok);
    body.appendChild(actions);

    var mark = document.createElement("div");
    mark.textContent = CONFIG.watermark;
    mark.style.cssText = "margin-top:12px;text-align:right;font-size:10.5px;letter-spacing:.06em;color:" + C.dim + ";text-shadow:0 1px 6px rgba(251,248,242,.9)";
    body.appendChild(mark);

    card.appendChild(body);

    function close() {
      remember();
      shade.remove();
      document.documentElement.style.overflow = "";
      if (document.body) document.body.style.overflow = "";
    }
    ok.onclick = close;
    shade.addEventListener("click", function (e) { if (e.target === shade) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    shade.appendChild(card);
    return shade;
  }

  function show() {
    if (document.getElementById("__lxh_notice")) return;
    document.documentElement.style.overflow = "hidden";
    if (document.body) document.body.style.overflow = "hidden";
    document.body.appendChild(build());
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", show); else show();
})();
