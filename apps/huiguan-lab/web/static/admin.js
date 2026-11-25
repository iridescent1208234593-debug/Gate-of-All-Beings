(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const t = (s) => (s ? new Date(s * 1000).toLocaleString() : "-");
  async function api(path, opts = {}) {
    const r = await fetch(path, { credentials: "same-origin", ...opts,
      headers: { "Content-Type": "application/json", "X-Lab-Admin": "1", ...(opts.headers || {}) } });
    if (r.status === 401) { show(false); throw new Error("login"); }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || r.status);
    return data;
  }
  const post = (path, body) => api(path, { method: "POST", body: JSON.stringify(body || {}) });
  function show(ok) { $("login").hidden = ok; $("main").hidden = !ok; }

  $("loginBtn").onclick = async () => {
    try { await post("/admin/api/login", { password: $("pw").value }); $("pw").value = ""; show(true); refresh(); }
    catch (e) { $("loginMsg").textContent = e.message === "locked" ? "已锁定 15 分钟" : "密码错误"; }
  };
  $("mk").onclick = async () => {
    const d = await post("/admin/api/codes", { label: $("label").value, role: $("role").value, count: +$("count").value });
    $("newCodes").innerHTML = '<p>新测试码只显示这一次，请立即复制发给对应玩家：</p><div class="new-codes">' +
      d.created.map((c) => esc(c.id) + "  " + esc(c.code)).join("<br>") + "</div>";
    refresh();
  };
  $("report").onclick = () => { location.href = "/admin/api/report"; };
  $("snap").onclick = async () => { $("snapshot").hidden = false; $("snapshot").textContent = JSON.stringify(await api("/admin/api/snapshot?space=hall"), null, 1); };

  window.codeAction = async (id, action) => {
    if (action === "revoke" && !confirm("撤销后该测试码永久失效，现有会话和联机立即断开。确定？")) return;
    const d = await post(`/admin/api/codes/${id}/${action}`);
    alert(`完成：删除会话 ${d.sessions_removed}，断开连接 ${d.connections_closed}`); refresh();
  };
  window.spaceAction = async (sid, action, kind) => {
    const body = {};
    if (kind === "public" && ["pause", "resume"].includes(action)) {
      if (prompt(`这会影响公共会馆的所有玩家。输入空间 ID「${sid}」确认`) !== sid) return;
      body.confirm = sid;
    }
    if (action === "advance") body.ticks = +(prompt("推进多少个世界小时（1-30）", "6") || 0);
    if (action === "spawn_npc") body.species = prompt("测试生物名称", "Spirit") || "Spirit";
    try { await post(`/admin/api/space/${sid}/${action}`, body); } catch (e) { alert(e.message); }
    refresh();
  };
  window.kick = async (pid) => { if (confirm("断开该玩家？")) { await post(`/admin/api/kick/${pid}`); refresh(); } };
  window.art = async (id, d) => { await post(`/admin/api/art/${id}/${d}`); refresh(); };
  window.skills = async (pid, what) => {
    const body = what === "all" ? { unlock_all: true } : what === "reset" ? { reset: true } : { points: +(prompt("发放多少技能点", "10") || 0) };
    if (what === "reset" && !confirm("重置该玩家的技能树？")) return;
    try { await post(`/admin/api/skills/${pid}`, body); } catch (e) { alert(e.message); }
  };

  let entityRows = [], entityCatalog = [], geometry = null, backdrop = null;
  const entityFields = {species:'entityName', kind:'entityKind', asset:'entityAsset', x:'entityX', z:'entityZ',
    height:'entityHeight', behavior:'entityBehavior', speed:'entitySpeed', stage:'entityStage', grow_seconds:'entityGrow'};
  function fillEntity(n) {
    $("entityId").value = n.id || "";
    for (const [key, id] of Object.entries(entityFields)) if (n[key] !== undefined) $(id).value = n[key];
    $("entityVisible").checked = n.visible !== false;
    $("entityMsg").textContent = n.id ? "正在编辑 " + n.species : "新对象：点选位置后保存";
    drawMap();
  }
  $("newEntity").onclick = () => fillEntity({id:"", species:"新生物", visible:true});
  $("entityAsset").onchange = () => {
    const a = entityCatalog.find(a => a.id === $("entityAsset").value);
    if (!a) return;
    $("entityName").value = a.name;
    $("entityKind").value = a.category === "plant" ? "plant" : a.category === "creature" ? "creature" : "prop";
    if (a.category === "plant") $("entityBehavior").value = "idle";
    if (a.display_height) $("entityHeight").value = a.display_height;
  };
  $("entityForm").onsubmit = async e => {
    e.preventDefault();
    const body = {visible:$("entityVisible").checked};
    for (const [key,id] of Object.entries(entityFields)) body[key] = $(id).value;
    if ($("entityId").value) body.id = $("entityId").value;
    try {
      const d = await post(`/admin/api/entities/${encodeURIComponent($("entitySpace").value)}`, body);
      fillEntity(d.entity); $("entityMsg").textContent = "已保存，在线玩家同步更新"; await refreshEntities();
    } catch(e) { $("entityMsg").textContent = e.message; }
  };
  $("entities").onclick = async e => {
    const b = e.target.closest("button[data-entity]"); if (!b) return;
    const n = entityRows.find(n => n.id === b.dataset.entity); if (!n) return;
    if (b.dataset.remove) {
      if (!confirm(`移除「${n.species}」？`)) return;
      await post(`/admin/api/entities/${encodeURIComponent(n.space)}`, {id:n.id, delete:true}); await refreshEntities();
    } else fillEntity(n);
  };
  $("entitySpace").onchange = async () => {
    const sid = $("entitySpace").value;
    geometry = await api(`/admin/api/geometry/${encodeURIComponent(sid)}`);
    $("entityPlot").innerHTML = '<option value="">自由摆放</option>' + (geometry.planting_plots || []).map((p,i) => `<option value="${i}">第 ${p.row} 行 · 第 ${p.column} 列</option>`).join('');
    backdrop = null;
    if (geometry.painted_ground) {
      const img = new Image(); img.onload = () => { backdrop = img; drawMap(); };
      img.src = `/admin/api/backdrop/${encodeURIComponent(sid)}.png`;
    }
    $("entityX").value = geometry.spawn[0]; $("entityZ").value = geometry.spawn[2]; $("entityId").value = "";
    await refreshEntities();
  };
  // [x0, z0, width, height] in metres; the hall now reaches north (negative z) into the painted home field
  function mapRect() { return geometry?.map_rect || [0, 0, ...(geometry?.painted_size || [geometry?.bounds.max[0]+.5 || 32, geometry?.bounds.max[2]+.5 || 22])]; }
  function mapSize() { const r = mapRect(); return [r[2], r[3]]; }
  $("entityPlot").onchange = () => {
    const i = $("entityPlot").value; if (i === "") return;
    const p = geometry.planting_plots[+i];
    $("entityX").value = p.x.toFixed(3); $("entityZ").value = p.z.toFixed(3);
    $("entityKind").value = 'plant'; $("entityBehavior").value = 'idle'; drawMap();
  };
  $("entityMap").addEventListener("pointerdown", e => {
    if (!geometry) return;
    const r = e.currentTarget.getBoundingClientRect(), [w,h] = mapSize();
    const [x0,z0] = mapRect();
    $("entityX").value = (x0+(e.clientX-r.left)/r.width*w).toFixed(1);
    $("entityZ").value = (z0+(e.clientY-r.top)/r.height*h).toFixed(1); drawMap();
  });
  function drawMap() {
    const c = $("entityMap"), ctx = c.getContext("2d"), [x0,z0,w,h] = mapRect();
    const tall = Math.round(c.width*h/w); if (c.height !== tall) c.height = tall;    // keep metres square
    const X = x => (x-x0)/w*c.width, Z = z => (z-z0)/h*c.height;
    ctx.clearRect(0,0,c.width,c.height);
    if (geometry?.grass_rect) { const g = geometry.grass_rect; ctx.fillStyle = "#8aa86a"; ctx.fillRect(X(g[0]),Z(g[1]),g[2]/w*c.width,g[3]/h*c.height); }
    if (backdrop) { const o = geometry.painted_origin || [0,0], s = geometry.painted_size; ctx.drawImage(backdrop,X(o[0]),Z(o[1]),s[0]/w*c.width,s[1]/h*c.height); }
    ctx.fillStyle = "#9a403966";
    for (const poly of geometry?.blocked_polygons || []) {
      ctx.beginPath(); poly.forEach(([x,z],i) => ctx[i ? 'lineTo' : 'moveTo'](X(x),Z(z))); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = "#3d6f8a88";
    for (const o of geometry?.obstacles || []) if (o.kind === "water") { ctx.beginPath(); ctx.arc(X(o.position[0]),Z(o.position[2]),o.radius/w*c.width,0,Math.PI*2); ctx.fill(); }
    ctx.font = "12px sans-serif";
    for (const n of entityRows) {
      ctx.fillStyle = n.visible ? (n.kind === "plant" ? "#e4f88c" : "#f8eedb") : "#555";
      const x=X(n.x), y=Z(n.z);
      ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#17251c"; ctx.fillText(n.species,x+7,y);
    }
    ctx.strokeStyle="#df5338"; ctx.lineWidth=2;
    const x=X(+$("entityX").value), y=Z(+$("entityZ").value);
    ctx.strokeRect(x-7,y-7,14,14);
  }
  async function refreshEntities() {
    const sid = $("entitySpace").value; if (!sid) return;
    const d = await api(`/admin/api/entities?space=${encodeURIComponent(sid)}`); entityRows=d.entities;
    $("entities").innerHTML = '<tr><th>名称</th><th>类型</th><th>位置</th><th>行为</th><th>显示</th><th></th></tr>' + entityRows.map(n =>
      `<tr><td>${esc(n.species)}</td><td>${esc(n.kind)}</td><td>${n.x.toFixed(1)}, ${n.z.toFixed(1)}</td><td>${esc(n.behavior)}</td><td>${n.visible?'是':'隐藏'}</td><td><button data-entity="${esc(n.id)}">编辑</button><button data-entity="${esc(n.id)}" data-remove="1">移除</button></td></tr>`).join('');
    $("r4Entities").textContent = `R4 自然演化生物：${d.r4.length} 个，沿用上方的世界暂停/恢复控制。此处摆放的 LAB 对象使用游走/跟随和分阶段生长。`;
    drawMap();
  }
  async function refreshCatalog(selectId) {
    entityCatalog = (await api('/admin/api/catalog')).assets;
    const chosen = selectId || $("entityAsset").value;
    $("entityAsset").innerHTML = entityCatalog.map(a => `<option value="${esc(a.id)}">${esc(a.name)}${a.author?' · '+esc(a.author):''}</option>`).join('');
    if (entityCatalog.some(a=>a.id===chosen)) $("entityAsset").value=chosen;
  }
  document.addEventListener('lab-art-uploaded', async e => {
    await refreshCatalog(e.detail.id); $("entityAsset").onchange(); $("entityId").value='';
  });

  async function refresh() {
    let o;
    try { o = await api("/admin/api/overview"); } catch (e) { return; }
    show(true);
    const oldSpace = $("entitySpace").value;
    $("entitySpace").innerHTML = o.spaces.map(s => `<option value="${esc(s.id)}">${esc(s.title)}</option>`).join('');
    if (oldSpace) $("entitySpace").value = oldSpace;
    if (!geometry) { await refreshCatalog(); await $("entitySpace").onchange(); }
    else await refreshEntities();
    $("ver").textContent = `服务端 ${o.server_version} · 客户端 ${o.client_version}`;
    const s = o.system, h = o.hub;
    const tiles = [["在线玩家", h.online], ["Tick p50 / p99 ms", `${h.tick_ms_p50} / ${h.tick_ms_p99}`],
      ["主机 CPU %", s.host_cpu_percent], ["网关 CPU %", s.gateway_cpu_percent], ["网关内存 MB", s.gateway_rss_mb],
      ["主机可用内存 MB", s.host_mem_available_mb], ["上行 / 下行 kbps", `${s.net.sent_kbps} / ${s.net.recv_kbps}`],
      ["WS 拒绝握手", o.ws_handshake_rejects], ["重连", h.counters.reconnects], ["纠正移动", h.counters.rejected_moves],
      ["错误", h.counters.errors], ["R4", o.r4.online ? "在线" : "离线 " + esc(o.r4.error)]];
    $("tiles").innerHTML = tiles.map(([k, v]) => `<div class="tile"><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join("");
    const codes = (await api("/admin/api/codes")).codes;
    $("codes").innerHTML = "<tr><th>ID</th><th>备注</th><th>角色</th><th>状态</th><th>昵称</th><th>使用</th><th>最近使用</th><th>会话</th><th>在线</th><th></th></tr>" +
      codes.map((c) => `<tr><td>${esc(c.id)}</td><td>${esc(c.label)}</td><td>${esc(c.role)}</td><td>${esc(c.status)}</td><td>${esc(c.nickname)}</td><td>${c.use_count}</td><td>${t(c.last_used_at)}</td><td>${c.sessions}</td><td>${c.online ? "●" : ""}</td><td>` +
        (c.status === "active" ? `<button data-call="codeAction('${esc(c.id)}','disable')">停用</button>` : c.status === "disabled" ? `<button data-call="codeAction('${esc(c.id)}','enable')">恢复</button>` : "") +
        (c.status !== "revoked" ? `<button class="danger" data-call="codeAction('${esc(c.id)}','revoke')">撤销</button>` : "") + "</td></tr>").join("");
    $("players").innerHTML = "<tr><th>PID</th><th>昵称</th><th>空间</th><th>客户端</th><th>位置</th><th>RTT</th><th>在线 s</th><th>纠正</th><th>发送/接收 KB</th><th></th></tr>" +
      o.players.map((p) => `<tr><td>${esc(p.pid)}</td><td>${esc(p.nick)}</td><td>${esc(p.space)}</td><td>${esc(p.client)} ${esc(p.version)}</td><td>${p.x.toFixed(1)}, ${p.z.toFixed(1)}</td><td>${p.rtt_ms}</td><td>${p.connected_s}</td><td>${p.corrections}</td><td>${p.sent_kb} / ${p.recv_kb}</td><td><button data-call="kick('${esc(p.pid)}')">断开</button> <button data-call="skills('${esc(p.pid)}','points')">发技能点</button> <button data-call="skills('${esc(p.pid)}','all')">解锁全部技能</button> <button data-call="skills('${esc(p.pid)}','reset')">重置技能</button></td></tr>`).join("");
    $("spaces").innerHTML = "<tr><th>ID</th><th>类型</th><th>名称</th><th>拥有者</th><th>受邀</th><th>R4 分支</th><th>在线</th><th>暂停</th><th>调试</th></tr>" +
      o.spaces.map((sp) => `<tr><td>${esc(sp.id)}</td><td>${esc(sp.kind)}</td><td>${esc(sp.title)}</td><td>${esc(sp.owner_pid)}</td><td>${esc(sp.guests.join(", "))}</td><td>${esc((sp.r4_branch || "").slice(0, 10))}</td><td>${sp.online}</td><td>${sp.paused ? "是" : ""}</td><td>` +
        `<button data-call="spaceAction('${esc(sp.id)}','${sp.paused ? "resume" : "pause"}','${esc(sp.kind)}')">${sp.paused ? "恢复" : "暂停"}</button>` +
        (sp.kind === "private" ? `<button data-call="spaceAction('${esc(sp.id)}','advance','private')">推进时间</button>` : "") +
        `<button data-call="spaceAction('${esc(sp.id)}','spawn_npc','${esc(sp.kind)}')">生成测试生物</button><button data-call="spaceAction('${esc(sp.id)}','clear_npcs','${esc(sp.kind)}')">清除测试生物</button></td></tr>`).join("");
    $("r4").textContent = JSON.stringify(o.r4, null, 1);
    const art = (await api("/admin/api/art")).assets;
    $("art").innerHTML = "<tr><th>预览</th><th>名称</th><th>类别</th><th>尺寸</th><th>状态</th><th></th></tr>" +
      art.map((a) => `<tr><td><img src="/admin/api/art/${esc(a.id)}.png" style="max-height:64px"></td><td>${esc(a.filename)}</td><td>${esc(a.category)}</td><td>${a.width}×${a.height}</td><td>${esc(a.status)}</td><td>` +
        (a.status === "pending" ? `<button data-call="art('${esc(a.id)}','approve')">通过</button><button class="danger" data-call="art('${esc(a.id)}','reject')">拒绝</button>` : "") + "</td></tr>").join("");
    const logs = await api("/admin/api/logs");
    $("errors").textContent = "错误与异常\n" + logs.errors.map((e) => `${t(e.at)} ${JSON.stringify(e)}`).join("\n");
    $("security").textContent = "安全事件\n" + logs.security.map((e) => `${t(e.at)} ${e.kind} ${e.ip_hint} ${e.code_id || ""} ${e.detail}`).join("\n");
    $("audit").textContent = "管理员操作\n" + logs.audit.map((e) => `${t(e.at)} ${e.actor} ${e.action} ${e.target} ${e.detail}`).join("\n");
    $("tail").textContent = "网关日志\n" + logs.log_tail.join("\n");
  }
  document.addEventListener("click", (event) => {
    const el = event.target.closest("[data-call]");
    if (!el) return;
    const m = /^(\w+)\((.*)\)$/.exec(el.getAttribute("data-call"));
    if (!m || !["codeAction", "spaceAction", "kick", "art", "skills"].includes(m[1])) return;
    const args = m[2].split(",").map((a) => a.trim().replace(/^'|'$/g, ""));
    window[m[1]](...args);
  });
  refresh(); setInterval(refresh, 5000);
})();
