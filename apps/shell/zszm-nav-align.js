/* 众生之门（卡牌 SPA）导航覆盖
 *
 * 背景：zszm 根页由 dist/modules/cards 的 React 包渲染，导航是构建时打进
 * bundle 的一份副本，不读 packages/shared-ui/site-nav.js。改公共脚本对它无效，
 * 需要重新构建模块才会更新。
 *
 * 本脚本在导航挂载后做一次对齐：主栏顺序改为 西木会馆 → 众生之门 → 节气画廊，
 * 节气画廊指向真正可访问的 /homepage.html，并把「更多」面板重建为分组结构。
 * 纯 DOM 修正，不改 bundle；重构模块后可删除本文件。
 */
(function () {
  "use strict";
  var NEW_ORDER = ["西木会馆", "众生之门", "节气画廊"];
  var GROUPS = [
    { title: "会馆", items: [
      ["角色画廊", "https://huiguan.iridescently.xyz/gallery.html"],
      ["同人画廊", "https://huiguan.iridescently.xyz/fan.html"],
      ["官方角色档案", "https://huiguan.iridescently.xyz/works.html"],
      ["表情包收录", "https://huiguan.iridescently.xyz/stickers.html"],
      ["人物关系图", "https://huiguan.iridescently.xyz/relation.html"],
      ["配色海报工坊", "https://huiguan.iridescently.xyz/haibao/"]
    ] },
    { title: "玩法", items: [
      ["众生之门 · 门庭", "https://zszm.iridescently.xyz/"],
      ["聚灵", "https://zszm.iridescently.xyz/app/shell/m/juling"],
      ["灵境会馆 · 据点经营", "https://zszm.iridescently.xyz/#management"]
    ] },
    { title: "其他", items: [
      ["佳霖馆长设定", "https://oc.iridescently.xyz/"],
      ["连接与鸣谢", "https://iridescently.xyz/connections.html"]
    ] }
  ];

  function fix() {
    var nav = document.getElementById("qc-nav");
    if (!nav) return false;
    var links = nav.querySelector(".qc-links");
    if (!links) return false;

    // 1) 主栏顺序与链接
    var items = [].slice.call(links.querySelectorAll(":scope > a"));
    if (!items.length) return false;
    var byLabel = {};
    items.forEach(function (a) { byLabel[a.textContent.trim().replace(/\s*beta\s*$/, "")] = a; });
    if (!byLabel["西木会馆"] || !byLabel["众生之门"] || !byLabel["节气画廊"]) return false;

    var gallery = byLabel["节气画廊"];
    gallery.href = "https://iridescently.xyz/homepage.html";

    // 已经符合顺序就不再动
    var currentOrder = items.map(function (a) { return a.textContent.trim().replace(/\s*beta\s*$/, ""); });
    var needReorder = currentOrder.join("|") !== NEW_ORDER.join("|");

    if (needReorder) {
      // 保持「更多」在最后，先移除三个站点链接再按新顺序插回
      ["西木会馆", "众生之门", "节气画廊"].forEach(function (n) { byLabel[n].remove(); });
      var more = links.querySelector(".qc-more");
      NEW_ORDER.forEach(function (n) {
        var a = byLabel[n];
        if (more) links.insertBefore(a, more); else links.appendChild(a);
      });
    }

    // 2) 重建「更多」面板为分组
    var panel = links.querySelector(".qc-more-panel");
    if (panel && !panel.dataset.qcGrouped) {
      panel.dataset.qcGrouped = "1";
      // 保留：站点快览（窄屏用）、版权声明、年份
      var kept = [];
      var legal = panel.querySelector("details");
      if (legal) kept.push(legal);
      panel.innerHTML = "";
      if (legal) panel.appendChild(legal);

      var siteHead = document.createElement("small");
      siteHead.className = "qc-panel-sites-head";
      siteHead.textContent = "站点";
      panel.insertBefore(siteHead, panel.firstChild);

      var frag = document.createDocumentFragment();
      GROUPS.forEach(function (g) {
        var h = document.createElement("small");
        h.className = "qc-panel-group";
        h.textContent = g.title;
        frag.appendChild(h);
        g.items.forEach(function (it) {
          var a = document.createElement("a");
          a.textContent = it[0];
          a.href = it[1];
          frag.appendChild(a);
        });
      });
      panel.insertBefore(frag, panel.firstChild ? panel.firstChild.nextSibling : null);

      // 分组标题样式（若 bundle 里没有）
      if (!document.getElementById("__qc_group_style")) {
        var st = document.createElement("style");
        st.id = "__qc_group_style";
        st.textContent =
          "#qc-nav .qc-panel-group{display:block;margin:10px 0 4px;padding:8px 10px 0;font-size:11px;" +
          "letter-spacing:.18em;color:var(--qc-mark,#e6c06a);opacity:.85;border-top:1px solid var(--qc-edge,rgba(246,248,248,.16))}";
        document.head.appendChild(st);
      }
    }
    return true;
  }

  // 导航由 SPA 异步挂载，轮询几次
  var tries = 0;
  var timer = setInterval(function () {
    tries += 1;
    var ok = false;
    try { ok = fix(); } catch (e) { ok = false; }
    if (ok || tries > 40) clearInterval(timer);
  }, 250);

  window.addEventListener("load", function () { try { fix(); } catch (e) {} });
})();
