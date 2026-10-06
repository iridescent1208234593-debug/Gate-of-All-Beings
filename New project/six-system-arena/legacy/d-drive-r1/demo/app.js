/**
 * 六大系数值可视化示例页逻辑（原生 ES module，零依赖）
 *
 * 数据流：fetch data/character-stats.json（v4 库只读派生结果，431 个有效角色）
 *        → src/ui/{radar6,bars6,badge,icons,system-icons}.js 渲染
 * 所有渲染函数均为纯函数（字符串进、字符串出），因此同样可被 zszm 的 React 侧复用。
 */

import { SIX_SYSTEMS, SIX_SYSTEM_IDS, RADAR_AXIS_ORDER } from '../src/world/six-systems.js';
import { FIVE_ELEMENTS, FIVE_ELEMENT_IDS } from '../src/world/elements.js';
import { buildRadar6SVG } from '../src/ui/radar6.js';
import { buildBars6SVG, buildDuelBarsSVG } from '../src/ui/bars6.js';
import { buildSystemBadgeRow, buildElementBadge, buildGradeBadge, injectBadgeStyles } from '../src/ui/badge.js';
import { iconHTML } from '../src/ui/icons.js';
import { CARD_ICON_META, SYSTEM_ICON_KEYS, ELEMENT_ICON_KEYS, systemIcon } from '../src/ui/system-icons.js';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);

const state = { data: null, list: [], query: '', sort: 'composite', currentId: 1, opponentId: null };

/* ---------------- 一 · 图标墙 ---------------- */
function renderIconWalls() {
  $('#icon-wall-official').innerHTML = SIX_SYSTEM_IDS.map((id) => {
    const key = SYSTEM_ICON_KEYS[id];
    const meta = CARD_ICON_META[key] || {};
    return (
      `<figure title="官方 card 图标 ${meta.file || key}">${systemIcon(id, { size: 64, title: SIX_SYSTEMS[id].name })}` +
      `<figcaption><span class="sysname">${esc(SIX_SYSTEMS[id].name)}</span><br>${esc(meta.glyph || '')} · ${esc(key)}.svg</figcaption></figure>`
    );
  }).join('');

  $('#icon-wall-replica').innerHTML = SIX_SYSTEM_IDS.map(
    (id) =>
      `<figure>${iconHTML(`sys_${id}`, { size: 40, title: SIX_SYSTEMS[id].name })}` +
      `<figcaption>${esc(SIX_SYSTEMS[id].name)}<br>复刻 32px</figcaption></figure>`,
  ).join('');

  $('#icon-wall-elements').innerHTML = FIVE_ELEMENT_IDS.map((id) => {
    const key = ELEMENT_ICON_KEYS[id];
    return (
      `<figure title="官方 card 图标 ${key}.svg">${iconHTML(`ele_${id}`, { size: 36, title: FIVE_ELEMENTS[id].name })}` +
      `<figcaption>${esc(FIVE_ELEMENTS[id].name)} · ${esc(FIVE_ELEMENTS[id].trait)}<br>五行（独立轴）</figcaption></figure>`
    );
  }).join('');
}

/* ---------------- 二 · 角色列表与详情 ---------------- */
function refreshList() {
  const q = state.query.trim().toLowerCase();
  let rows = state.list;
  if (q) {
    rows = rows.filter((c) =>
      [c.name, c.aliases, String(c.id), c.species, c.affiliation].some((t) => String(t || '').toLowerCase().includes(q)),
    );
  }
  const sorters = {
    composite: (a, b) => (b.rating?.composite ?? -1) - (a.rating?.composite ?? -1),
    name: (a, b) => String(a.name).localeCompare(String(b.name), 'zh-Hans-CN'),
    id: (a, b) => a.id - b.id,
  };
  rows = [...rows].sort(sorters[state.sort] || sorters.composite);
  const show = rows.slice(0, 200);

  $('#list').innerHTML = show
    .map(
      (c) =>
        `<li data-id="${c.id}" aria-current="${c.id === state.currentId}" class="${c.status !== 'active' ? 'is-merged' : ''}">` +
        `<span class="rank">${c.rating?.grade ?? '-'}</span>` +
        `<span class="nm">${esc(c.name)}${c.status !== 'active' ? `（${esc(c.status)}）` : ''}</span>` +
        `<span class="gd">${num(c.rating?.composite)}</span></li>`,
    )
    .join('');
  $('#list-count').textContent =
    `共 ${rows.length} 条匹配（有效 ${state.list.length} 条；列表最多显示 200 条，可用搜索收窄）`;
}

function renderDetail() {
  const c = state.list.find((x) => x.id === state.currentId) || state.list[0];
  if (!c) return;
  const r = c.rating || {};
  const conf = { tagged: '有结构化标签（最可信）', textual: '文本命中', baseline: '仅基准分（未觉醒/待考据）' }[c.confidence] || c.confidence;

  $('#detail').innerHTML =
    `<div class="detail-head">` +
    buildGradeBadge(r.grade, { size: 64, power: r.power }) +
    `<div><h3>${esc(c.name)}</h3><div class="alias">${esc(c.aliases || '—')} · id ${c.id}</div></div>` +
    buildElementBadge(c.element) +
    `</div>` +
    `<div class="kv">` +
    `<span>类别 <b>${esc(c.category || '—')}</b></span><span>物种 <b>${esc(c.species || '—')}</b></span>` +
    `<span>归属 <b>${esc(c.affiliation || '—')}</b></span><span>境界 <b>${esc(c.realm || '未判定')}</b></span>` +
    `<span>证据等级 <b>${esc(conf)}</b></span><span>状态 <b>${esc(c.status)}</b></span>` +
    `</div>` +
    `<div class="viz-row">` +
    `<div class="viz" style="background:#2b2b30;border-color:#4a4a52"><h4 style="color:#d9cfae">六维雷达</h4>` +
    buildRadar6SVG({ systems: c.systems, showValues: true, showCenter: true, grade: r.grade, power: r.power }) +
    `</div>` +
    `<div class="viz"><h4>六系条形（含档位）</h4>${buildBars6SVG({ systems: c.systems })}` +
    `<div class="kv" style="margin-top:8px"><span>综合 <b>${r.composite}</b></span><span>均分 <b>${r.average}</b></span>` +
    `<span>最强 <b>${esc(SIX_SYSTEMS[r.peakSystem]?.name || '-')} ${num(r.peak)}</b></span>` +
    `<span>副强 <b>${esc(SIX_SYSTEMS[r.secondarySystem]?.name || '-')} ${num(r.secondary)}</b></span>` +
    `<span>专精度 <b>${r.focus}</b></span><span>均衡度 <b>${r.balance}</b></span></div>` +
    `</div></div>` +
    `<div style="margin-top:12px">${buildSystemBadgeRow(c.systems, { size: 54 })}</div>` +
    renderTags(c) +
    renderEvidence(c);
}

function renderTags(c) {
  const named = (c.skillTags || []).filter((t) => t.named).map((t) => {
    const sys = SIX_SYSTEMS[t.system]?.name || t.system;
    return `<span class="tag" title="${esc(t.raw)} · 来源 ${esc(t.source)}">${esc(sys)}·${esc(t.branch || '?')}</span>`;
  });
  const plain = (c.skillTags || []).filter((t) => !t.named).map((t) => `<span class="tag">${esc(SIX_SYSTEMS[t.system]?.name || t.system)}</span>`);
  const dual = (c.dualTags || []).map((t) => `<span class="tag is-dual" title="${esc(t.raw || '')}">双系·${esc(t.name || t.raw || '')}</span>`);
  const loose = (c.looseSkills || []).slice(0, 12).map((s) => `<span class="tag is-loose" title="未标注系别的能力名">${esc(s.name)}</span>`);
  const html = [...named, ...dual, ...plain, ...loose].join('');
  return `<div style="margin-top:10px"><b style="font-size:13px">技能标签</b><div class="tags">${html || '<span class="tip">无</span>'}</div></div>`;
}

function renderEvidence(c) {
  const ev = c.evidence || {};
  const kw = Object.entries(ev.matchedKeywords || {})
    .filter(([, v]) => v)
    .map(([k, v]) => `<span class="tag">${esc(k)}×${Array.isArray(v) ? v.length : v}</span>`)
    .join('');
  const snippets = (ev.abilitySnippets || []).slice(0, 6).map((s) => `<li>${esc(typeof s === 'string' ? s : s.text || s.raw || JSON.stringify(s))}</li>`).join('');
  return (
    `<details style="margin-top:10px"><summary style="font-size:13px;cursor:pointer">派生证据（可追溯 / 可推翻）</summary>` +
    `<div class="kv" style="margin-top:8px"><span>来源表 <b>${esc((ev.sourceTables || []).join(', '))}</b></span>` +
    `<span>文本长度 <b>${esc(ev.textLength ?? '-')}</b></span>` +
    `<span>空间系归零 <b>${esc((ev.innateZeroed || []).join(',') || '无')}</b></span></div>` +
    `<div class="tags">${kw || '<span class="tip">未命中系名关键词</span>'}</div>` +
    (snippets ? `<ul style="font-size:12px;color:#7d7460">${snippets}</ul>` : '') +
    `</details>`
  );
}

/* ---------------- 三 · 对镜对比条 ---------------- */
function renderOpponentOptions() {
  const opts = [...state.list]
    .sort((a, b) => (b.rating?.composite ?? 0) - (a.rating?.composite ?? 0))
    .slice(0, 300)
    .map((c) => `<option value="${c.id}">${esc(c.name)}（${c.rating?.grade ?? '-'} · ${num(c.rating?.composite)}）</option>`)
    .join('');
  const sel = $('#opponent');
  sel.innerHTML = opts;
  if (state.opponentId == null) state.opponentId = state.currentId;
  sel.value = String(state.opponentId);
}

function renderDuel() {
  const a = state.list.find((x) => x.id === state.currentId);
  const b = state.list.find((x) => x.id === state.opponentId);
  if (!a || !b) return;
  $('#duel').innerHTML =
    buildDuelBarsSVG({ a: { name: a.name, systems: a.systems }, b: { name: b.name, systems: b.systems } }) +
    `<p class="hint">镜像轴：左＝${esc(a.name)}（综合 ${num(a.rating?.composite)}），右＝${esc(b.name)}（综合 ${num(b.rating?.composite)}）。` +
    `逐系差值：${RADAR_AXIS_ORDER.map((id) => `${SIX_SYSTEMS[id].name}${num(a.systems[id]) - num(b.systems[id]) >= 0 ? '+' : ''}${num(a.systems[id]) - num(b.systems[id])}`).join(' / ')}</p>`;
}

/* ---------------- 四 · 数据健康度 ---------------- */
function renderHealth() {
  const d = state.data;
  const counts = d.counts || {};
  const per = d.stats?.perSystem || {};
  const rows = SIX_SYSTEM_IDS.map(
    (id) =>
      `<tr><td>${esc(per[id]?.name || id)}</td><td class="num">${per[id]?.mean ?? '-'}</td>` +
      `<td class="num">${per[id]?.median ?? '-'}</td><td class="num">${per[id]?.max ?? '-'}</td>` +
      `<td class="num">${per[id]?.gte60Count ?? '-'}</td><td class="num">${per[id]?.tagCount ?? '-'}</td></tr>`,
  ).join('');
  const grades = Object.entries(
    state.list.reduce((acc, c) => ((acc[c.rating?.grade || '?'] = (acc[c.rating?.grade || '?'] || 0) + 1), acc), {}),
  )
    .sort()
    .map(([g, n]) => `<span class="tag">${esc(g)} ${n}</span>`)
    .join('');
  const limits = Object.entries(d.derivationRules?.limits || {})
    .map(([k, v]) => `<span class="tag">${esc(k)} ${v}</span>`)
    .join('');

  $('#health').innerHTML =
    `<div class="kv">` +
    `<span>schema <b>v${d.schemaVersion}</b></span><span>算法 <b>${esc(d.algorithmVersion)}</b></span>` +
    `<span>总行 <b>${counts.totalRows}</b></span><span>有效 <b>${counts.active}</b></span>` +
    `<span>已合并 <b>${counts.merged}</b></span><span>有能力证据 <b>${counts.withAbilityEvidence}</b></span>` +
    `<span>有技能标签 <b>${counts.withSkillTags}</b></span>` +
    `</div>` +
    `<div class="tags">${grades}</div>` +
    `<table class="data" style="margin-top:10px"><thead><tr><th>系</th><th>均值</th><th>中位</th><th>最高</th><th>≥60 人数</th><th>标签数</th></tr></thead><tbody>${rows}</tbody></table>` +
    `<div class="tags" style="margin-top:10px">${limits}</div>` +
    `<p class="hint">数据源：<code class="k">${esc(d.source?.path || '')}</code><br>sha256：<code class="k">${esc((d.source?.sha256 || '').slice(0, 16))}…</code>（只读快照，双份库派生源表一致）</p>`;
}

/* ---------------- 启动 ---------------- */
async function boot() {
  injectBadgeStyles(document);
  renderIconWalls();
  const res = await fetch(new URL('../data/character-stats.json', import.meta.url));
  const data = await res.json();
  state.data = data;
  state.list = data.characters.filter((c) => c.status === 'active');
  state.currentId = state.list.find((c) => c.id === 1)?.id ?? state.list[0].id;

  $('#status').innerHTML =
    `数据源 <code>data/character-stats.json</code> · schema v${data.schemaVersion} · 算法 <code>${esc(data.algorithmVersion)}</code> · ` +
    `有效角色 ${data.counts.active} / 总行 ${data.counts.totalRows}`;

  refreshList();
  renderDetail();
  renderOpponentOptions();
  renderDuel();
  renderHealth();

  $('#list').addEventListener('click', (e) => {
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    state.currentId = Number(li.dataset.id);
    refreshList();
    renderDetail();
    renderDuel();
  });
  $('#q').addEventListener('input', (e) => {
    state.query = e.target.value;
    refreshList();
  });
  $('#sort').addEventListener('change', (e) => {
    state.sort = e.target.value;
    refreshList();
  });
  $('#opponent').addEventListener('change', (e) => {
    state.opponentId = Number(e.target.value);
    renderDuel();
  });
}

boot().catch((err) => {
  $('#status').innerHTML =
    `读取失败：${esc(err.message)} —— 请用 <code>node tools/serve-demo.mjs</code> 启动本地服务后访问 ` +
    `<code>http://127.0.0.1:5399/demo/</code>（file:// 直开会被浏览器拦截）。`;
});
