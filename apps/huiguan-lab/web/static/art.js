(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  $("up").onclick = async () => {
    const f = $("file").files[0];
    if (!f) return;
    $("msg").textContent = "上传中…";
    const r = await fetch("/api/art", { method: "POST", credentials: "same-origin", body: f,
      headers: { "X-Art-Category": $("cat").value, "X-Art-Name": encodeURIComponent(f.name).slice(0, 120) } });
    const d = await r.json().catch(() => ({}));
    $("msg").textContent = r.ok ? "已提交，等待审核" : "失败：" + (d.error || r.status);
  };
  async function list() {
    const r = await fetch("/api/art/approved", { credentials: "same-origin" });
    if (!r.ok) return;
    const d = await r.json();
    $("list").innerHTML = d.assets.map((a) => `<div class="tile"><img src="/api/art/file/${esc(a.id)}" style="max-width:100%;max-height:120px"><span>${esc(a.category)} · ${esc(decodeURIComponent(a.filename))}</span></div>`).join("") || "<p>暂无</p>";
  }
  list();
})();
