(function () {
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  async function refresh() {
    const r = await fetch("/api/monitor", { credentials: "same-origin" });
    if (!r.ok) { document.body.textContent = "需要只读监控权限。"; return; }
    const o = await r.json(), h = o.hub, s = o.system;
    const tiles = [["在线玩家", h.online], ["Tick p50 / p99 ms", `${h.tick_ms_p50} / ${h.tick_ms_p99}`], ["主机 CPU %", s.host_cpu_percent],
      ["网关内存 MB", s.gateway_rss_mb], ["上行 kbps", s.net.sent_kbps], ["重连", h.counters.reconnects], ["错误", h.counters.errors],
      ["服务端", o.server_version], ["客户端", o.client_version], ["R4", o.r4.online ? "在线" : "离线"]];
    document.getElementById("tiles").innerHTML = tiles.map(([k, v]) => `<div class="tile"><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join("");
    const b = o.r4.branches || {};
    document.getElementById("r4").textContent = Object.entries(b).map(([id, x]) => `${id.slice(0, 12)}  tick=${x.model_tick}  ${JSON.stringify(x.populations)}  running=${x.runner && x.runner.enabled}`).join("\n");
  }
  refresh(); setInterval(refresh, 5000);
})();
