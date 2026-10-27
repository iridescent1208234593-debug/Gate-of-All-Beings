// 罗小黑战记·重生之门 —— 「灵质修行」活动界面
// 浅色宣纸风（米黄底/驼色/teal），与 collection.html 世界观图鉴风格一致。
// 包含：主界面 / 残片解锁 / 修行图鉴 / 修行成就 / 选角 / 灵质回路战斗 六页。
import {html, Component} from '../web_modules/htm/preact/standalone.module.js'
import {
	lingzhiCharacters,
	lingzhiCards,
	allLingzhiRelics,
	lingzhiAchievements,
	lingzhiStats,
} from '../content/lingzhi-xiuxing.js'
import {
	loadProgress,
	saveProgress,
	todayRemaining,
	recordRunStart,
	settleRun,
	tryUnlock,
	claimAchievement,
	achievementProgress,
	achievementReady,
	collectionSummary,
	todayStr,
} from '../game/lingzhi-progress.js'
import {LingzhiGame, createLingzhiGame, createLingzhiCard, getLingzhiCardRewards, getLingzhiRelicRewards, getCurrRoom, isCurrRoomCompleted, isDungeonCompleted} from '../game/lingzhi-engine.js'
import {setLingzhiScene, stop as stopBgm} from './bgm.js'
import {awardSoul} from '../content/soul-legacy.js'
import {saveLingzhiSettlement} from '../content/lingzhi-bonus.js'
import {reportResult} from '/shared/shared-session/progress.js'
import {todayDaily} from '../content/daily.js'
import {dailyBattleBonus} from '../game/lingzhi-engine.js'
import {characterImages} from '../content/character-images.js'

// ============ 样式 ============
const LxzStyle = () => html`
	<style>
		.Lxz { --paper:#f7f1e3; --paper2:#efe6d2; --paper3:#e7dcc2; --camel:#a0825a; --camel2:#8b6f47; --teal:#0e7c7b; --teal-deep:#0a5f5e; --teal-glow:rgba(14,124,123,.25); --ink:#3d3226; --ink-soft:#6b5d4b; --ink-mid:rgba(61,50,38,.55); --grey:#a99f8e; --paper-line:rgba(160,130,90,.35); --paper-line2:rgba(160,130,90,.55); --gold-soft:#f3e7c9; --gold-strong:#d9b46a; --danger-text:#a33b2e; --hp-track:rgba(160,130,90,.25); --node-m-bg:#35504a; --node-m-line:#52796f; --node-m-ink:#e8f0e6; --node-c-bg:#5d4b3a; --node-c-line:#8b6f47; --node-c-ink:#f3e6cd; --node-b-bg:#6e1414; --node-b-line:#8e1f1f; --node-b-ink:#f7e8d8; }
		.Lxz { background:var(--paper); color:var(--ink); min-height:100vh; font-family:"Noto Serif SC","Songti SC",serif; padding:24px; box-sizing:border-box; }
		.Lxz * { box-sizing:border-box; }
		.Lxz button { font-family:inherit; cursor:pointer; }
		.Lxz-head { display:flex; align-items:center; gap:12px; max-width:960px; margin:0 auto 16px; }
		.Lxz-banner { display:block; max-width:960px; width:100%; margin:0 auto 16px; border-radius:14px; box-shadow:0 4px 14px var(--ink-soft); object-fit:cover; }
		.Lxz-back { background:var(--paper2); border:1px solid var(--camel); color:var(--camel2); border-radius:8px; padding:6px 14px; font-size:14px; }
		.Lxz-title { font-size:26px; color:var(--camel2); margin:0; font-weight:700; }
		.Lxz-sub { color:var(--camel); font-size:13px; margin:2px 0 0; }
		.Lxz-card { background:var(--paper2); border:1px solid var(--paper-line2); border-radius:12px; padding:18px; max-width:960px; margin:0 auto 16px; }
		.Lxz-daily { margin-top:10px; display:inline-flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:center; background:linear-gradient(135deg, rgba(212,168,64,.10), rgba(90,158,143,.08)); border:1px dashed var(--camel); border-radius:10px; padding:8px 16px; font-size:13px; color:var(--camel2); cursor:help; }
		.Lxz-daily b { color:var(--teal); font-weight:700; letter-spacing:1px; }
		.Lxz-stats { display:flex; gap:14px; flex-wrap:wrap; }
		.Lxz-stat { background:var(--paper3); border:1px solid var(--paper-line); border-radius:10px; padding:10px 16px; min-width:130px; text-align:center; }
		.Lxz-stat b { display:block; font-size:22px; color:var(--teal); }
		.Lxz-stat span { font-size:12px; color:var(--camel); }
		.Lxz-actions { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin:18px 0; }
		.Lxz-btn { background:var(--paper2); border:1px solid var(--camel); color:var(--camel2); border-radius:8px; padding:8px 18px; font-size:15px; }
		.Lxz-btn:hover { background:var(--gold-soft); }
		.Lxz-btn--main { background:var(--teal); border-color:var(--teal); color:#fff; font-size:18px; padding:12px 30px; border-radius:10px; box-shadow:0 3px 8px var(--teal-glow); }
		.Lxz-btn--main:hover { background:var(--teal-deep); }
		.Lxz-btn[disabled] { opacity:.5; cursor:not-allowed; }
		.Lxz-hint { color:var(--camel); font-size:13px; text-align:center; margin:6px 0 0; }
		.Lxz-tabs { display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap; }
		.Lxz-tab { background:transparent; border:1px solid var(--paper-line2); color:var(--camel2); border-radius:20px; padding:5px 16px; font-size:14px; }
		.Lxz-tab.is-on { background:var(--teal); border-color:var(--teal); color:#fff; }
		.Lxz-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px; }
		.Lxz-item { background:var(--paper3); border:1px solid var(--paper-line); border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:6px; }
		.Lxz-item h4 { margin:0; font-size:16px; color:var(--camel2); display:flex; align-items:center; gap:8px; justify-content:space-between; }
		.Lxz-tag { font-size:11px; color:var(--teal); border:1px solid var(--teal); border-radius:10px; padding:1px 8px; white-space:nowrap; }
		.Lxz-tag.is-elem { color:var(--camel2); border-color:var(--camel2); background:var(--gold-soft); }
		.Lxz-item p { margin:0; font-size:13px; color:var(--ink); line-height:1.5; flex:1; }
		.Lxz-item .Lxz-cost { font-size:13px; color:var(--camel2); font-weight:600; }
		.Lxz-locked { color:var(--grey); }
		.Lxz-ach { background:var(--paper3); border:1px solid var(--paper-line); border-radius:10px; padding:12px 14px; margin-bottom:10px; display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
		.Lxz-ach b { color:var(--camel2); font-size:15px; }
		.Lxz-ach .Lxz-achCond { flex:1; font-size:13px; min-width:180px; }
		.Lxz-ach .Lxz-achReward { color:var(--teal); font-size:13px; }
		.Lxz-ach .Lxz-achState { font-size:12px; color:var(--grey); min-width:70px; text-align:center; }
		.Lxz-ach .Lxz-achState.is-ready { color:var(--camel2); font-weight:700; }
		.Lxz-groupTitle { font-size:15px; color:var(--camel2); border-left:3px solid var(--teal); padding-left:8px; margin:18px 0 10px; }
		/* 战斗 */
		.Lxz-battle { background:var(--paper); color:var(--ink); min-height:100vh; padding:16px; }
		.Lxz-bHead { display:flex; justify-content:space-between; align-items:center; max-width:980px; margin:0 auto 12px; gap:10px; flex-wrap:wrap; }
		.Lxz-bHead span { font-size:13px; color:var(--camel); }
		.Lxz-bMain { display:flex; gap:14px; max-width:980px; margin:0 auto 14px; flex-wrap:wrap; justify-content:center; }
		.Lxz-bPanel { background:var(--paper3); border:1px solid var(--paper-line); border-radius:12px; padding:12px 16px; min-width:260px; flex:1; max-width:460px; }
		.Lxz-bPanel h3 { margin:0 0 6px; font-size:17px; color:var(--camel2); }
		.Lxz-hp { font-size:14px; }
		.Lxz-hpBar { height:12px; background:var(--hp-track); border-radius:6px; overflow:hidden; margin:4px 0; position:relative; }
		.Lxz-hpBar i { display:block; height:100%; background:var(--teal); border-radius:6px; transition:width .2s; }
		.Lxz-hpBar i.is-block { position:absolute; top:0; left:0; background:var(--gold-strong); }
		.Lxz-powers { font-size:12px; color:var(--camel); min-height:16px; }
		.Lxz-desc { font-size:12px; color:var(--camel2); line-height:1.5; margin:4px 0 6px; font-style:italic; }
		.Lxz-bossImg { display:block; width:100%; max-width:220px; max-height:240px; margin:0 auto 8px; border-radius:10px; border:2px solid var(--gold-strong); box-shadow:0 3px 10px var(--ink-soft); object-fit:cover; }
		.Lxz-intent { font-size:13px; color:var(--danger-text); }
		.Lxz-hand { display:flex; gap:10px; max-width:980px; margin:10px auto; overflow-x:auto; padding:10px 4px; min-height:170px; }
		.Lxz-card { background:var(--paper3); border:2px solid var(--camel); border-radius:10px; width:140px; min-width:140px; padding:10px; display:flex; flex-direction:column; gap:4px; cursor:pointer; transition:transform .1s; }
		.Lxz-card:hover { transform:translateY(-6px); border-color:var(--teal); }
		.Lxz-card.is-unplayable { opacity:.55; cursor:not-allowed; }
		.Lxz-card h5 { margin:0; font-size:14px; color:var(--camel2); display:flex; justify-content:space-between; align-items:center; }
		.Lxz-card .Lxz-cardCost { background:var(--teal); color:#fff; border-radius:50%; width:20px; height:20px; font-size:12px; display:inline-flex; align-items:center; justify-content:center; }
		.Lxz-card .Lxz-cardType { font-size:11px; color:var(--teal); }
		.Lxz-card p { margin:0; font-size:12px; line-height:1.45; flex:1; }
		.Lxz-card .Lxz-cardElem { font-size:10px; color:var(--grey); }
		.Lxz-bActions { display:flex; gap:10px; max-width:980px; margin:0 auto; flex-wrap:wrap; }
		.Lxz-overlay { position:fixed; inset:0; background:var(--ink-mid); display:flex; align-items:center; justify-content:center; z-index:20; padding:20px; }
		.Lxz-overlayInner { background:var(--paper); border:2px solid var(--camel); border-radius:14px; padding:22px; max-width:720px; width:100%; max-height:86vh; overflow:auto; }
		.Lxz-overlayInner h2 { margin:0 0 12px; color:var(--camel2); text-align:center; }
		.Lxz-mapRow { display:flex; gap:12px; justify-content:center; margin:10px 0; flex-wrap:wrap; }
		.Lxz-mapNode { min-width:110px; padding:12px 10px; border-radius:10px; text-align:center; font-size:14px; }
		.Lxz-mapNode.M { background:var(--node-m-bg); border:1px solid var(--node-m-line); color:var(--node-m-ink); }
		.Lxz-mapNode.C { background:var(--node-c-bg); border:1px solid var(--node-c-line); color:var(--node-c-ink); }
		.Lxz-mapNode.boss { background:var(--node-b-bg); border:1px solid var(--node-b-line); color:var(--node-b-ink); }
		.Lxz-mapNode.E { background:#2f3e46; border:1px solid #84a98c; color:#cfe0cf; }
		.Lxz-mapNode.elite { background:#4a3a1c; border:1px solid #d9b46a; color:#f3e7c9; }
		.Lxz-mapNode.start { background:var(--paper2); border:1px solid var(--camel); color:var(--camel2); }
		.Lxz-mapNode.is-done { opacity:.45; }
		/* ---------- 逐格水墨地图（灵质回路 · 选择路线） ---------- */
		.Lxz-inkMap { position:relative; overflow:hidden; background:radial-gradient(ellipse at 50% 0%, #fdf8ec 0%, var(--paper) 55%, var(--paper2) 100%); border:1px solid var(--paper-line2); }
		.Lxz-inkMap::before { content:''; position:absolute; inset:0; pointer-events:none; background:radial-gradient(circle at 12% 22%, rgba(61,50,38,.055) 0 2px, transparent 2px), radial-gradient(circle at 68% 68%, rgba(61,50,38,.045) 0 1.5px, transparent 1.5px), radial-gradient(circle at 85% 30%, rgba(61,50,38,.05) 0 2.5px, transparent 2.5px); background-size:120px 120px, 90px 90px, 150px 150px; }
		.Lxz-inkMtn { position:absolute; left:0; right:0; bottom:0; width:100%; height:72%; pointer-events:none; }
		.Lxz-inkMtn path { fill:none; }
		.Lxz-inkMtn--far { fill:rgba(61,50,38,.055); }
		.Lxz-inkMtn--mid { fill:rgba(61,50,38,.095); }
		.Lxz-inkMist { position:absolute; pointer-events:none; background:linear-gradient(90deg, transparent, rgba(247,241,227,.92), transparent); filter:blur(6px); border-radius:50%; }
		.Lxz-inkMist--1 { width:52%; height:34px; left:-10%; top:16%; opacity:.85; }
		.Lxz-inkMist--2 { width:46%; height:26px; right:-8%; top:32%; opacity:.7; }
		.Lxz-inkDot { position:absolute; pointer-events:none; border-radius:50%; background:rgba(61,50,38,.14); filter:blur(2px); animation:lxzInkDrift 8s ease-in-out infinite alternate; }
		.Lxz-inkDot--1 { width:30px; height:30px; right:9%; top:12%; }
		.Lxz-inkDot--2 { width:16px; height:16px; right:15%; top:24%; animation-delay:-3s; }
		@keyframes lxzInkDrift { from { transform:translateY(0) scale(1); } to { transform:translateY(-14px) scale(1.12); } }
		.Lxz-inkTitle { position:relative; letter-spacing:.35em; text-align:center; color:var(--camel2); font-size:20px; margin:0 0 8px; text-shadow:0 1px 0 #fff; }
		.Lxz-inkPath { position:relative; display:flex; align-items:center; justify-content:center; gap:8px; margin:6px 0 8px; }
		.Lxz-inkNode { position:relative; display:inline-flex; align-items:center; gap:4px; padding:7px 16px; border-radius:999px; background:var(--paper3); border:1.5px solid var(--camel); color:var(--camel2); font-size:13px; box-shadow:inset 0 0 0 2px rgba(255,255,255,.35); }
		.Lxz-inkNode b { font-size:17px; color:var(--teal); }
		.Lxz-inkFork { font-size:12px; color:var(--grey); letter-spacing:.2em; }
		.Lxz-inkLink { width:130px; height:36px; flex:none; overflow:visible; }
		.Lxz-inkStroke { fill:none; stroke:rgba(61,50,38,.35); stroke-width:2.5; stroke-linecap:round; stroke-dasharray:6 5; }
		/* 节点：水墨印章 */
		.Lxz-mapNode { position:relative; min-width:104px; padding:14px 10px 10px; border-radius:12px; border:1.5px solid var(--camel); background:var(--paper3); box-shadow:inset 0 0 0 2px rgba(255,255,255,.4), 0 2px 6px rgba(61,50,38,.12); transition:transform .15s ease, box-shadow .15s ease, background .15s ease; }
		.Lxz-mapNode:hover { transform:translateY(-2px); background:var(--gold-soft); }
		.Lxz-nodeSeal { display:block; width:52px; height:52px; margin:0 auto 8px; border-radius:50%; background:radial-gradient(circle at 35% 30%, #2b2b28, #1c1b18 78%); color:#f7f1e3; font-size:24px; line-height:52px; text-align:center; font-weight:700; box-shadow:inset 0 -3px 6px rgba(255,255,255,.12), inset 0 2px 4px rgba(0,0,0,.55), 0 1px 3px rgba(61,50,38,.3); }
		.Lxz-mapNode.M .Lxz-nodeSeal { background:radial-gradient(circle at 35% 30%, #5d4b3a, #45362a 80%); color:#f3e6cd; }
		.Lxz-mapNode.C .Lxz-nodeSeal { background:radial-gradient(circle at 35% 30%, #48675f, #35504a 80%); color:#e8f0e6; }
		.Lxz-mapNode.E .Lxz-nodeSeal { background:radial-gradient(circle at 35% 30%, #4a5a74, #38455c 80%); color:#e4e9f2; }
		.Lxz-mapNode.elite .Lxz-nodeSeal { background:radial-gradient(circle at 35% 30%, #8a6d2f, #5d4a1e 80%); color:#f7ecd0; }
		.Lxz-mapNode.boss .Lxz-nodeSeal { background:radial-gradient(circle at 35% 30%, #8e1f1f, #6e1414 80%); color:#f7e8d8; }
		.Lxz-mapNode.S .Lxz-nodeSeal { background:radial-gradient(circle at 35% 30%, #6e4a8f, #4d3166 80%); color:#efe4f7; }
		.Lxz-nodeLabel { display:block; font-size:13px; color:var(--camel2); letter-spacing:.08em; }
		.Lxz-mapNode.M, .Lxz-mapNode.C, .Lxz-mapNode.E, .Lxz-mapNode.elite, .Lxz-mapNode.boss, .Lxz-mapNode.start { background:var(--paper3); border:1.5px solid var(--camel); color:var(--camel2); }
		.Lxz-mapNode.is-done .Lxz-nodeSeal { opacity:.55; filter:grayscale(.6); }
		.Lxz-eventFlavor { color:var(--ink); font-size:15px; line-height:1.9; background:var(--paper2); border-left:4px solid #52796f; padding:14px 16px; border-radius:8px; margin:0 0 16px; }
		.Lxz-eventOpt { display:flex; flex-direction:column; gap:4px; align-items:flex-start; width:100%; text-align:left; padding:12px 16px; }
		.Lxz-eventOpt b { color:var(--camel2); font-size:15px; }
		.Lxz-eventOpt span { color:var(--ink-soft); font-size:13px; }
.Lxz-eventResult { color:var(--camel2); font-size:16px; font-weight:600; background:var(--paper2); border:1px dashed #c2a878; padding:12px 16px; border-radius:8px; margin:0 0 16px; text-align:center; }
		.Lxz-rewardCard { cursor:pointer; }
		.Lxz-rewardCard:hover { border-color:var(--teal); transform:translateY(-4px); }
		.Lxz-empty { color:var(--grey); text-align:center; padding:20px; font-size:14px; }
		/* 战斗战报（灵质回路·见闻录）：展示引擎 log，按类型着色 */
		.Lxz-log { max-width:980px; margin:12px auto 0; background:var(--paper2); border:1px solid var(--paper-line); border-radius:12px; padding:12px 16px; }
		.Lxz-logHead { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
		.Lxz-logHead b { color:var(--camel2); font-size:15px; letter-spacing:.15em; }
		.Lxz-logList { max-height:190px; overflow-y:auto; display:flex; flex-direction:column; gap:4px; padding-right:6px; }
		.Lxz-logItem { font-size:13px; line-height:1.5; color:var(--ink-soft); border-left:3px solid var(--paper-line); padding-left:8px; }
		.Lxz-logItem.k-dmg { color:var(--danger-text); border-left-color:var(--danger-text); }
		.Lxz-logItem.k-def { color:var(--teal); border-left-color:var(--teal); }
		.Lxz-logItem.k-debuff { color:#7a4f9c; border-left-color:#7a4f9c; }
		.Lxz-logItem.k-boss { color:var(--camel2); border-left-color:var(--gold-strong); font-weight:700; }
		.Lxz-logItem .Lxz-logTurn { font-size:11px; color:var(--grey); margin-right:6px; white-space:nowrap; }
	</style>
`

// ============ 工具 ============
const fmtTime = (ms) => {
	if (ms == null) return '—'
	const s = Math.floor(ms / 1000)
	return `${Math.floor(s / 60)} 分 ${String(s % 60).padStart(2, '0')} 秒`
}
const fmtDate = (iso) => {
	if (!iso) return '—'
	const d = new Date(iso)
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ============ 主界面 ============
// 今日灵机 → 灵质修行专属效果文案（与引擎 dailyBattleBonus 映射一致）
function lingzhiDailyText() {
	const daily = todayDaily()
	// 与引擎 startBattle 约定一致：传入含顶层 passive 的结构
	const bonus = dailyBattleBonus({passive: daily.blessing?.passive || {}})
	const parts = []
	if (bonus.strength) parts.push(`每场战斗开始 力量 +${bonus.strength}`)
	if (bonus.block) parts.push(`每场战斗开始 格挡 +${bonus.block}`)
	if (bonus.heal) parts.push(`每场战斗开始 回复 ${bonus.heal} 生命`)
	if (bonus.drawExtra) parts.push(`每场战斗多抽 ${bonus.drawExtra} 张牌`)
	const maxHp = daily.blessing?.passive?.maxHealth || 0
	if (maxHp) parts.push(`最大生命 +${maxHp}`)
	return {daily, bonusText: parts.join('；') || '无额外加成'}
}

class LingzhiHome extends Component {
	render({progress, onPage, onStart, remaining}) {
		const {daily, bonusText} = lingzhiDailyText()
		return html`
			<div class="Lxz-card" style="text-align:center">
				<h2 style="margin:0;color:var(--camel2);font-size:28px">灵质修行</h2>
				<p class="Lxz-sub" style="max-width:560px;margin:8px auto">进入灵质回路试炼，选路、战斗、构筑卡组，击败守门 Boss 完成修行。</p>
				<div class="Lxz-daily" title="${daily.blessing?.desc || ''}">
					<b>今日灵机 · ${daily.element?.name || ''}</b>
					<span>「${daily.blessing?.name || ''}」${bonusText ? `——${bonusText}` : ''}</span>
				</div>
			</div>
			<div class="Lxz-card">
				<div class="Lxz-stats">
					<div class="Lxz-stat"><b>${progress.shards}</b><span>修行残片</span></div>
					<div class="Lxz-stat"><b>${progress.wins} 次</b><span>通关次数</span></div>
					<div class="Lxz-stat"><b>${fmtTime(progress.bestTimeMs)}</b><span>最快时间</span></div>
				</div>
				<div class="Lxz-actions">
					<button class="Lxz-btn" onClick=${() => onPage('unlock')}>残片解锁</button>
					<button class="Lxz-btn" onClick=${() => onPage('collection')}>修行图鉴</button>
					<button class="Lxz-btn" onClick=${() => onPage('achievements')}>修行成就</button>
					<button class="Lxz-btn" onClick=${() => onPage('xiuxian')}>一念仙途</button>
				</div>
				<div style="text-align:center">
					<button class="Lxz-btn Lxz-btn--main" onClick=${onStart}>开始修行</button>
					<p class="Lxz-hint">今日免费剩余 ${remaining} 次${remaining <= 0 ? '（继续修行将不获得残片）' : ''}</p>
				</div>
			</div>
		`
	}
}

// ============ 残片解锁 ============
class LingzhiUnlock extends Component {
	constructor() {
		super()
		this.state = {tab: 'characters'}
	}
	unlock(type, id) {
		const {progress, onProgress} = this.props
		const res = tryUnlock(progress, type, id)
		if (res.ok) {
			saveProgress(res.next)
			onProgress(res.next)
		} else if (res.reason === 'noshards') {
			// 残片不足，置灰不可点击
		}
	}
	render({progress}, {tab}) {
		const unlocked = (id, type) =>
			type === 'characters'
				? progress.unlockedCharacters.includes(id)
				: type === 'cards'
				? progress.unlockedCards.includes(id)
				: progress.unlockedRelics.includes(id)
		const renderItem = (item, type, id, cost, effectText) => {
			const isUnlocked = unlocked(id, type)
			const canAfford = progress.shards >= cost
			return html`
				<div class="Lxz-item">
					<h4>${item} ${isUnlocked ? html`<span class="Lxz-tag">已解锁</span>` : ''}</h4>
					<p>${effectText}</p>
					<div style="display:flex;justify-content:space-between;align-items:center">
						<span class="Lxz-cost">${isUnlocked ? '已进入奖池' : cost > 0 ? `${cost} 残片` : '默认解锁'}</span>
						${!isUnlocked && cost > 0
							? html`<button class="Lxz-btn" disabled=${!canAfford} style="padding:4px 12px;font-size:13px" onClick=${() => this.unlock(type, id)}>${canAfford ? '解锁' : '残片不足'}</button>`
							: ''}
					</div>
				</div>
			`
		}
		const tabs = [
			['characters', `角色 ${lingzhiCharacters.length}`],
			['cards', `灵术卡 ${lingzhiCards.length}`],
			['relics', `遗物 ${allLingzhiRelics.length}`],
		]
		let content = null
		if (tab === 'characters') {
			content = html`<div class="Lxz-grid">${lingzhiCharacters.map((c) => renderItem(c.name, 'characters', c.id, c.cost, c.desc))}</div>`
		} else if (tab === 'cards') {
			content = html`<div class="Lxz-grid">${lingzhiCards.map((c) => renderItem(c.name, 'cards', c.cardId, c.cost, c.desc))}</div>`
		} else {
			content = html`<div class="Lxz-grid">${allLingzhiRelics.map((r) => renderItem(r.name, 'relics', r.id, r.cost, r.desc))}</div>`
		}
		return html`
			<div class="Lxz-card">
				<div class="Lxz-tabs">
					${tabs.map(([key, label]) => html`<button class=${`Lxz-tab ${tab === key ? 'is-on' : ''}`} onClick=${() => this.setState({tab: key})}>${label}</button>`)}
				</div>
				<p class="Lxz-sub">通关修行可获得修行残片，用于解锁角色、卡牌与遗物，解锁后才会进入奖池。当前残片 ${progress.shards}</p>
				<div style="height:10px"></div>
				${content}
			</div>
		`
	}
}

// ============ 修行图鉴 ============
class LingzhiCollection extends Component {
	constructor() {
		super()
		this.state = {tab: 'all'}
	}
	render({progress}, {tab}) {
		const summary = collectionSummary(progress)
		const entries = []
		lingzhiCharacters.forEach((c) => {
			const unlocked = progress.unlockedCharacters.includes(c.id)
			entries.push({type: '角色', name: c.name, desc: c.desc, cost: c.cost, unlocked, time: progress.unlockTime[`characters:${c.id}`]})
		})
		lingzhiCards.forEach((c) => {
			const unlocked = progress.unlockedCards.includes(c.cardId)
			entries.push({type: '灵术卡', name: c.name, desc: c.desc, cost: c.cost, unlocked, time: progress.unlockTime[`cards:${c.cardId}`]})
		})
		allLingzhiRelics.forEach((r) => {
			const unlocked = progress.unlockedRelics.includes(r.id)
			entries.push({type: '遗物', name: r.name, desc: r.desc, cost: r.cost, unlocked, time: progress.unlockTime[`relics:${r.id}`]})
		})
		const filtered = tab === 'all' ? entries : entries.filter((e) => e.type === tab)
		const tabs = [
			['all', `全部 ${entries.length}`],
			['角色', `角色 ${lingzhiCharacters.length}`],
			['灵术卡', `灵术卡 ${lingzhiCards.length}`],
			['遗物', `遗物 ${allLingzhiRelics.length}`],
		]
		return html`
			<div class="Lxz-card">
				<div class="Lxz-tabs">
					${tabs.map(([key, label]) => html`<button class=${`Lxz-tab ${tab === key ? 'is-on' : ''}`} onClick=${() => this.setState({tab: key})}>${label}</button>`)}
				</div>
				<p class="Lxz-sub">残片解锁的角色、灵术卡与遗物会收录于此，并记录首次解锁时间。已收录 ${summary.collected} / ${summary.total}　待解锁 ${summary.remaining} 项</p>
				<div style="height:10px"></div>
				<div class="Lxz-grid">
					${filtered.map((e) =>
						e.unlocked
							? html`<div class="Lxz-item"><h4>${e.name} <span class="Lxz-tag">${e.type}</span></h4><p>${e.desc}</p><span class="Lxz-cost" style="font-size:12px;color:var(--grey)">首解锁时间：${fmtDate(e.time)}</span></div>`
							: html`<div class="Lxz-item Lxz-locked"><h4>??? <span class="Lxz-tag">${e.type}</span></h4><p>消耗 ${e.cost} 残片解锁后可查看详情</p><span class="Lxz-cost" style="font-size:12px">未收录</span></div>`
					)}
				</div>
			</div>
		`
	}
}

// ============ 修行成就 ============
class LingzhiAchievements extends Component {
	claim(achId) {
		const {progress, onProgress} = this.props
		const res = claimAchievement(progress, achId)
		if (res.ok) {
			saveProgress(res.next)
			onProgress(res.next)
		}
	}
	render({progress}) {
		const groups = ['修行历程', '角色证道', '残片收藏', '极限挑战']
		const doneCount = lingzhiAchievements.filter((a) => progress.claimedAchievements[a.id]).length
		return html`
			<div class="Lxz-card">
				<p class="Lxz-sub">达成里程碑可获得额外修行残片，需在此页手动领取。已达成 ${doneCount} / ${lingzhiAchievements.length}</p>
				${groups.map((g) => html`
					<div class="Lxz-groupTitle">${g}</div>
					${lingzhiAchievements.filter((a) => a.group === g).map((a) => {
						const ready = achievementReady(progress, a)
						const claimed = !!progress.claimedAchievements[a.id]
						const p = achievementProgress(progress, a)
						const stateLabel = claimed ? '已领取' : ready ? '可领取' : `${p.current} / ${p.target}`
						return html`
							<div class="Lxz-ach">
								<b>${a.name}</b>
								<span class="Lxz-achCond">${a.condition}</span>
								<span class="Lxz-achReward">+${a.reward} 残片</span>
								<span class=${`Lxz-achState ${ready && !claimed ? 'is-ready' : ''}`}>${stateLabel}</span>
								${ready && !claimed ? html`<button class="Lxz-btn" style="padding:4px 14px;font-size:13px" onClick=${() => this.claim(a.id)}>领取</button>` : ''}
							</div>
						`
					})}
				`)}
			</div>
		`
	}
}

// ============ 选角 ============
class LingzhiSelect extends Component {
	constructor() {
		super()
		this.state = {selected: 'walker'}
	}
	render({progress, onBack, onStart}, {selected}) {
		return html`
			<div class="Lxz-card">
				<h3 style="color:var(--camel2);margin:0 0 10px">选择修行角色</h3>
				<p class="Lxz-sub">未解锁的角色需先在「残片解锁」中消耗残片解锁；每个角色拥有独立起始卡组与被动。</p>
				<div class="Lxz-grid" style="margin-top:12px">
					${lingzhiCharacters.map((c) => {
						const unlocked = progress.unlockedCharacters.includes(c.id)
						const isSel = selected === c.id
						return html`
							<div class="Lxz-item" style=${`cursor:${unlocked ? 'pointer' : 'not-allowed'};border-color:${isSel ? 'var(--teal)' : 'var(--paper-line)'};opacity:${unlocked ? 1 : .6}`} onClick=${() => unlocked && this.setState({selected: c.id})}>
								<h4>${c.name} ${!unlocked ? html`<span class="Lxz-tag">未解锁</span>` : isSel ? html`<span class="Lxz-tag">已选择</span>` : ''}</h4>
								<p>${c.desc}</p>
								<span class="Lxz-cost">${unlocked ? '已解锁' : `${c.cost} 残片`}</span>
							</div>
						`
					})}
				</div>
				<div class="Lxz-actions">
					<button class="Lxz-btn" onClick=${onBack}>返回</button>
					<button class="Lxz-btn Lxz-btn--main" onClick=${() => onStart(selected)}>开始修行</button>
				</div>
			</div>
		`
	}
}

// ============ 战斗页 ============
class LingzhiBattle extends Component {
	constructor(props) {
		super(props)
		this.state = {battle: null, overlay: 'map', pendingReward: null, pendingRelic: null, result: null, selectedReward: null, campfireChoice: null, logOpen: true}
	}
	startBattleRun(characterId) {
		const {progress} = this.props
		// 在扣除次数前记录本次是否消耗免费次数（决定结算是否给残片）
		this.freeRun = todayRemaining(progress) > 0
		const next = recordRunStart(progress)
		saveProgress(next)
		this.props.onProgress(next)
		const game = new LingzhiGame(createLingzhiGame({characterId, unlockedCards: next.unlockedCards, unlockedRelics: next.unlockedRelics}))
		this.setState({battle: game, overlay: 'map'})
		setLingzhiScene('battle')
	}
	enqueueAndUpdate(action) {
		const {battle} = this.state
		if (!battle) return
		battle.enqueue(action)
		battle.dequeue()
		this.setState({battle})
		this.checkRoomFlow()
		this.syncBgm()
	}
	// 战斗音景同步：按当前房间类型切换（普通战斗/精英/守门 Boss；篝火休整用柔和音）
	syncBgm() {
		const {battle, result} = this.state
		if (result || !battle) return
		const room = getCurrRoom(battle.state)
		if (!room) return
		if (room.type === 'campfire') return setLingzhiScene('select')
		if (room.type === 'event') return setLingzhiScene('select')
		if (room.type === 'monster') {
			const isBoss = room.monsters.some((m) => m.difficulty === 'boss')
			const isElite = room.monsters.some((m) => m.difficulty === 'elite')
			if (isBoss) return setLingzhiScene('boss')
			if (isElite) return setLingzhiScene('elite')
			return setLingzhiScene('battle')
		}
	}
	// 房间流程：战斗胜利→奖励；失败/通关→结算；篝火→选择；普通战斗进行中→关闭遮罩
	checkRoomFlow() {
		const {battle, result} = this.state
		if (result) return
		if (!battle) return
		const state = battle.state
		if (state.player.currentHealth < 1) return this.finish(false)
		if (isDungeonCompleted(state)) return this.finish(true)
		const room = getCurrRoom(state)
		if (!room) return
		if (room.type === 'monster') {
			if (isCurrRoomCompleted(state)) {
				// 胜利：弹出奖励；若奖励已在展示则保持弹窗，避免被后续操作覆盖
				if (!this.state.pendingReward) {
					const unlockedCards = this.props.progress.unlockedCards
					const unlockedRelics = this.props.progress.unlockedRelics
					// 精英战：卡牌 4 选 1 且必出遗物；普通战：卡牌 3 选 1，遗物 35% 概率
					const isElite = room.difficulty === 'elite'
					const cardRewards = getLingzhiCardRewards(isElite ? 4 : 3, unlockedCards, state.deck.map((c) => c.name))
					const relicRewards = isElite || Math.random() < 0.35 ? getLingzhiRelicRewards(2, unlockedRelics) : []
					// 双保险：卡牌与遗物池均为空时（理论上 getLingzhiCardRewards 已兜底，不会发生）直接返回地图，避免空弹窗死锁
					if (!cardRewards.length && !relicRewards.length) {
						this.setState({pendingReward: null, pendingRelic: null, overlay: 'map'})
						return
					}
					this.setState({pendingReward: cardRewards, pendingRelic: relicRewards, overlay: 'reward'})
				}
			} else {
				this.setState({overlay: null})
			}
			return
		}
		if (room.type === 'campfire' && !room.choiceMade && !this.state.campfireChoice) {
			this.setState({overlay: 'campfire'})
			return
		}
		if (room.type === 'event' && !room.resolved && !this.state.eventChoice) {
			this.setState({overlay: 'event'})
			return
		}
		if (room.type === 'space' && !room.resolved && !this.state.spaceChoice) {
			this.setState({overlay: 'space'})
			return
		}
		if (room.type === 'start') {
			this.setState({overlay: 'map'})
			return
		}
	}
	playCard(card) {
		const {battle} = this.state
		const state = battle.state
		// 目标解析：player 卡直接给 'player'；enemy 卡给第一个存活敌人；allEnemies 给 allEnemies
		const room = getCurrRoom(state)
		const aliveMonsters = room.monsters.filter((m) => m.currentHealth > 0)
		let target = card.target
		if (card.target === 'enemy') {
			if (!aliveMonsters.length) return
			target = `enemy${state.dungeon.graph[state.dungeon.y][state.dungeon.x].room.monsters.indexOf(aliveMonsters[0])}`
		}
		const energy = card.energy || 0
		// 心棱镜：每回合首张【读绪】【定绪】【心印】等标签牌消耗 0
		const heartFree =
			state.player.cardsPlayedThisTurn === 0 &&
			(state.player.relics || []).some((r) => r.effect?.firstCardFree) &&
			(card.tags || []).some((t) => ['读绪', '定绪', '心印'].includes(t))
		const cost = heartFree && energy > 0 ? 0 : energy
		if (state.player.currentEnergy < cost) return
		this.enqueueAndUpdate({type: 'playCard', card, target})
	}
	endTurn() {
		this.enqueueAndUpdate({type: 'endTurn'})
	}
	moveTo(nodeId) {
		const {battle} = this.state
		const [y, x] = nodeId.split('-').map(Number)
		const node = battle.state.dungeon.graph[y][x]
		// 进入新房间后的遮罩状态由 checkRoomFlow 决定（战斗→null / 休整→campfire）
		this.enqueueAndUpdate({type: 'move', move: {x: node.x, y: node.y}})
	}
	collectReward(choice) {
		const {battle, pendingReward, pendingRelic} = this.state
		if (choice.kind === 'card') {
			this.enqueueAndUpdate({type: 'addCardToDeck', card: choice.card})
		} else {
			this.enqueueAndUpdate({type: 'addRelicToPlayer', relic: choice.relic})
		}
		this.setState({pendingReward: null, pendingRelic: null, overlay: 'map'})
	}
	// 放弃本轮战利品：作为奖励弹窗的兜底出口，直接关闭并回到地图（不获得卡/遗物）
	skipReward() {
		this.setState({pendingReward: null, pendingRelic: null, overlay: 'map'})
	}
	campfireRest() {
		this.enqueueAndUpdate({type: 'campfireRest'})
		this.setState({overlay: 'map'})
	}
	campfireRemove(card) {
		this.enqueueAndUpdate({type: 'campfireRemoveCard', card})
		this.setState({overlay: 'map'})
	}
	// 灵质事件：应用选项效果（引擎处理生命/上限/卡牌/遗物；残片收益在此结算进修行进度）
	resolveEventChoice(choiceIndex) {
		const {battle, progress} = this.state
		if (!battle) return
		this.enqueueAndUpdate({type: 'resolveEvent', choiceIndex})
		const room = getCurrRoom(battle.state)
		const reward = room?.reward
		if (reward?.shards) {
			const next = {...progress, shards: (progress.shards || 0) + reward.shards}
			saveProgress(next)
			this.props.onProgress(next)
		}
		const texts = []
		if (reward?.card) texts.push(`获得卡牌「${reward.card.name}」`)
		if (reward?.relic) texts.push(`获得遗物「${reward.relic.name}」`)
		if (reward?.removed) texts.push(`已移除卡牌「${reward.removed.name}」`)
		this.setState({overlay: texts.length ? 'eventResult' : 'map', eventResult: texts.join('；')})
	}
	// 灵质空间：三选一抉择（引擎处理生命/上限/残片/卡牌/遗物；残片收益在此结算进修行进度）
	resolveSpaceChoice(choiceIndex) {
		const {battle, progress} = this.state
		if (!battle) return
		this.enqueueAndUpdate({type: 'resolveSpace', choiceIndex})
		const room = getCurrRoom(battle.state)
		const reward = room?.reward
		if (reward?.shards) {
			const next = {...progress, shards: (progress.shards || 0) + reward.shards}
			saveProgress(next)
			this.props.onProgress(next)
		}
		const texts = []
		if (reward?.card) texts.push(`获得灵术卡「${reward.card.name}」`)
		if (reward?.relic) texts.push(`获得遗物「${reward.relic.name}」`)
		if (reward?.removed) texts.push(`已移除卡牌「${reward.removed.name}」`)
		this.setState({overlay: texts.length ? 'spaceResult' : 'map', eventResult: texts.join('；')})
	}
	finish(won) {
		const {battle} = this.state
		const state = battle.state
		const elapsedMs = Date.now() - state.runStartedAt
		// 本次是否消耗免费次数在开局时已记录：用尽免费次数后继续修行不给残片
		const awardShards = this.freeRun === true
		// floor：当前到达层数（1-7，第 7 层守门 Boss；失败时即本次止步层，用于刷新历史最高层）
		const next = settleRun(this.props.progress, {won, elapsedMs, maxTurnsInRun: state.maxTurnsInRun || 0, characterId: state.player.characterId, awardShards, floor: state.dungeon.y + 1})
		// 魂灵折入主游戏魂灵传承（soul-legacy）：灵质回路试炼亦在轮回之中，折入后下一世爬塔获得传承加成
		if (next.soulGained > 0) awardSoul(next.soulGained)
		// 灵质修行结算奖励（跨局桥接）：按守门 Boss 通关 / 历史最高层数折算修为/道心/法宝，
		// 写入跨局结算存档（localStorage，模式同 soul-legacy），下一局主爬塔开局一次性承接
		const settlementReward = saveLingzhiSettlement(next)
		saveProgress(next)
		this.props.onProgress(next)
		// 账户积分 / 排行榜：灵质回路按本次到达层数上榜（访客不上榜）
		void reportResult('lingzhi', {score: state.dungeon.y + 1, won, ref: 'lingzhi:' + state.runStartedAt + ':' + (state.player.characterId || '')})
		this.setState({result: {won, elapsedMs, awardShards, soulGained: next.soulGained, floor: next.bestFloor, settlementReward}})
		setLingzhiScene(won ? 'victory' : 'defeat')
	}
	render(props, state) {
		if (!state.battle) {
			return html`<div class="Lxz"><${LxzStyle} /><div class="Lxz-card" style="text-align:center"><p>准备进入灵质回路……</p><button class="Lxz-btn" onClick=${() => this.startBattleRun(props.selectedCharacter)}>开始</button></div></div>`
		}
		const s = state.battle.state
		const room = getCurrRoom(s)
		const player = s.player
		const floor = s.dungeon.y + 1
		const maxFloor = s.dungeon.graph.length
		const dead = player.currentHealth < 1
		const roomWon = room && room.type === 'monster' && isCurrRoomCompleted(s)
		const aliveMonsters = room?.monsters?.filter((m) => m.currentHealth > 0) || []
		const unplayable = (card) => {
			const energy = card.energy || 0
			// 心棱镜：每回合首张【读绪】【定绪】【心印】等标签牌消耗 0
			const heartFree =
				player.cardsPlayedThisTurn === 0 &&
				player.relics.some((r) => r.effect?.firstCardFree) &&
				(card.tags || []).some((t) => ['读绪', '定绪', '心印'].includes(t))
			const cost = heartFree && energy > 0 ? 0 : energy
			return player.currentEnergy < cost || (card.target === 'enemy' && !aliveMonsters.length)
		}
		const currentNode = s.dungeon.graph[s.dungeon.y][s.dungeon.x]
		const nextNodes = s.dungeon.y < maxFloor - 1 ? s.dungeon.graph[s.dungeon.y + 1] : []
		const nodeLabel = (n) => (n.type === 'M' ? '战斗' : n.type === 'elite' ? '精英' : n.type === 'C' ? '休整' : n.type === 'E' ? '灵质事件' : n.type === 'S' ? '灵质空间' : n.type === 'boss' ? '守门 Boss' : n.type === 'start' ? '起点' : '')
		const nodeSeal = (t) => (t === 'M' ? '战' : t === 'elite' ? '锐' : t === 'C' ? '憩' : t === 'E' ? '缘' : t === 'S' ? '界' : t === 'boss' ? '门' : t === 'start' ? '灵' : '·')
		return html`
			<div class="Lxz Lxz-battle">
				<${LxzStyle} />
				<div class="Lxz-bHead">
					<button class="Lxz-btn" onClick=${() => this.props.onExit()}>放弃修行</button>
					<span>灵质回路 · 第 ${floor} / ${maxFloor} 层</span>
					<span>回合 ${s.turn}${room?.type === 'monster' ? ` · 本战第 ${s.fightTurnCount} 回合` : ''}</span>
				</div>
				<div class="Lxz-bMain">
					<div class="Lxz-bPanel">
						<h3>${player.characterName} ${player.guildName ? html`<span style="font-size:12px;color:var(--camel)">· 出身：${player.guildName}</span>` : ''} ${(player.relics || []).length ? html`<span style="font-size:12px;color:var(--camel)">· 遗物：${player.relics.map((r) => r.name).join('、')}</span>` : ''}</h3>
						<div class="Lxz-hp">生命 ${Math.max(0, player.currentHealth)} / ${player.maxHealth}　格挡 ${player.block}</div>
						<div class="Lxz-hpBar"><i style=${`width:${Math.max(0, player.currentHealth / player.maxHealth) * 100}%`}></i><i class="is-block" style=${`width:${Math.min(1, player.block / player.maxHealth) * 100}%`}></i></div>
						<div class="Lxz-powers">${Object.entries(player.powers || {}).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${v}`).join(' · ') || '无状态'}</div>
						<div class="Lxz-powers">能量 ${player.currentEnergy} / ${player.maxEnergy} · 已用攻击牌 ${player.comboAttack || 0}</div>
					</div>
					${(room?.monsters || []).map((m) => {
						const isDeadM = m.currentHealth < 1
						const intent = m.intents[m.nextIntent]
						const intentText = intent
							? Object.entries(intent).map(([k, v]) => (k === 'damage' ? `攻击 ${v}` : k === 'block' ? `防御 ${v}` : k === 'weak' ? `虚弱 ${v}` : k === 'vulnerable' ? `易伤 ${v}` : k === 'strength' ? `力量 ${v}` : '')).join(' + ')
							: ''
						const displayName = m.bossPhase === 2 && m.phase2Name ? m.phase2Name : m.name
						return html`
							<div class="Lxz-bPanel">
								${m.portrait && characterImages[m.portrait] ? html`<img class="Lxz-bossImg" src=${characterImages[m.portrait]} alt=${m.portrait} loading="lazy" />` : ''}
								<h3>${displayName} ${m.difficulty === 'boss' ? html`<span class="Lxz-tag">守门</span>` : m.difficulty === 'elite' ? html`<span class="Lxz-tag">精英</span>` : ''} ${m.element ? html`<span class="Lxz-tag is-elem">${m.element}</span>` : ''}</h3>
								${m.desc ? html`<div class="Lxz-desc">${m.desc}</div>` : ''}
								<div class="Lxz-hp">生命 ${Math.max(0, m.currentHealth)} / ${m.maxHealth}　格挡 ${m.block}</div>
								<div class="Lxz-hpBar"><i style=${`width:${Math.max(0, m.currentHealth / m.maxHealth) * 100}%`}></i><i class="is-block" style=${`width:${Math.min(1, m.block / m.maxHealth) * 100}%`}></i></div>
								<div class="Lxz-intent">${isDeadM ? '已击败' : intent ? `意图：${intentText}` : ''}</div>
								<div class="Lxz-powers">${Object.entries(m.powers || {}).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${v}`).join(' · ') || ''}</div>
							</div>
						`
					})}
				</div>
				<div class="Lxz-hand">
					${s.hand.map((card) => html`
						<div class=${`Lxz-card ${unplayable(card) || dead ? 'is-unplayable' : ''}`} onClick=${() => !unplayable(card) && !dead && this.playCard(card)}>
							<h5><span>${card.name}</span><span class="Lxz-cardCost">${card.energy || 0}</span></h5>
							<span class="Lxz-cardType">${card.type === 'attack' ? '攻击' : card.type === 'skill' ? '技能' : '能力'} · ${card.target === 'allEnemies' ? '全体' : card.target === 'player' ? '自身' : '单体'}</span>
							<p>${card.desc}</p>
							<span class="Lxz-cardElem">${card.exhaust ? '消耗 · ' : ''}${card.tags ? card.tags.join('、') : ''}</span>
						</div>
					`)}
				</div>
				<div class="Lxz-bActions">
					<button class="Lxz-btn Lxz-btn--main" disabled=${dead || roomWon} onClick=${() => this.endTurn()}>结束回合</button>
					<button class="Lxz-btn" disabled=${state.overlay === 'reward'} onClick=${() => this.setState({overlay: 'map'})}>地图（${floor}/${maxFloor}）</button>
					<button class="Lxz-btn" disabled=${state.overlay === 'reward'} onClick=${() => this.setState({overlay: 'deck'})}>卡组（${s.deck.length}）</button>
					<button class="Lxz-btn" onClick=${() => this.setState({logOpen: !this.state.logOpen})}>${this.state.logOpen ? '收起战报' : '战报'}</button>
					${dead ? html`<span style="color:var(--danger-text);align-self:center">你倒下了……</span>` : ''}
					${roomWon ? html`<span style="color:var(--teal);align-self:center">本层已清除！</span>` : ''}
				</div>

				${this.state.logOpen && s.log && s.log.length ? html`<div class="Lxz-log">
					<div class="Lxz-logHead"><b>灵质回路 · 见闻录</b><span class="Lxz-hint" style="margin:0">共 ${s.log.length} 条</span></div>
					<div class="Lxz-logList">
						${s.log.slice(-15).reverse().map((item) => html`<div class=${`Lxz-logItem ${item.kind || 'info'}`}><span class="Lxz-logTurn">[第${item.turn}回合]</span>${item.text}</div>`)}
					</div>
				</div>` : ''}

				${state.overlay === 'map' && html`<div class="Lxz-overlay"><div class="Lxz-overlayInner Lxz-inkMap">
					<svg class="Lxz-inkMtn" viewBox="0 0 600 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
						<path class="Lxz-inkMtn--far" d="M0,130 Q70,70 170,100 T360,75 T600,110 L600,300 L0,300 Z"/>
						<path class="Lxz-inkMtn--mid" d="M0,195 Q120,120 280,160 T600,150 L600,300 L0,300 Z"/>
					</svg>
					<span class="Lxz-inkMist Lxz-inkMist--1"></span>
					<span class="Lxz-inkMist Lxz-inkMist--2"></span>
					<span class="Lxz-inkDot Lxz-inkDot--1"></span>
					<span class="Lxz-inkDot Lxz-inkDot--2"></span>
					<h2 class="Lxz-inkTitle">灵质回路 · 择路</h2>
					<div class="Lxz-inkPath">
						<span class="Lxz-inkNode is-cur"><b>${floor}</b>层 · 此地</span>
						<svg class="Lxz-inkLink" viewBox="0 0 140 36" preserveAspectRatio="none" aria-hidden="true"><path class="Lxz-inkStroke" d="M10,26 Q45,6 90,18 T132,10"/></svg>
						<span class="Lxz-inkFork">下层</span>
					</div>
					<div class="Lxz-mapRow">
						${nextNodes.length
							? nextNodes.map((n) => html`<button class=${`Lxz-mapNode ${n.type} ${n.didVisit ? 'is-done' : ''}`} onClick=${() => this.moveTo(n.id)}><span class="Lxz-nodeSeal">${nodeSeal(n.type)}</span><span class="Lxz-nodeLabel">${nodeLabel(n)}</span></button>`)
							: html`<button class="Lxz-mapNode boss" onClick=${() => this.setState({overlay: null})}><span class="Lxz-nodeSeal">门</span><span class="Lxz-nodeLabel">守门 Boss</span></button>`}
					</div>
					${nextNodes.length ? html`<p class="Lxz-hint">已到达第 ${floor} 层，选择下一步路线。</p>` : html`<p class="Lxz-hint">已抵达守门 Boss，击败它完成修行！</p>`}
				</div></div>`}

				${state.overlay === 'reward' && (state.pendingReward?.length || state.pendingRelic?.length) && html`<div class="Lxz-overlay"><div class="Lxz-overlayInner">
					<h2>胜利！选择战利品</h2>
					${state.pendingReward && state.pendingReward.length ? html`<div class="Lxz-hand" style="justify-content:center">${state.pendingReward.map((card) => html`
						<div class="Lxz-card Lxz-rewardCard" onClick=${() => this.collectReward({kind: 'card', card})}>
							<h5><span>${card.name}</span><span class="Lxz-cardCost">${card.energy || 0}</span></h5>
							<span class="Lxz-cardType">${card.type === 'attack' ? '攻击' : card.type === 'skill' ? '技能' : '能力'} · 灵术卡</span>
							<p>${card.desc}</p>
						</div>`)}</div>` : ''}
					${state.pendingRelic && state.pendingRelic.length ? html`<div class="Lxz-hand" style="justify-content:center">${state.pendingRelic.map((relic) => html`
						<div class="Lxz-card Lxz-rewardCard" onClick=${() => this.collectReward({kind: 'relic', relic})}>
							<h5><span>${relic.name}</span><span class="Lxz-cardCost">遗</span></h5>
							<span class="Lxz-cardType">遗物</span>
							<p>${relic.desc}</p>
						</div>`)}</div>` : ''}
					<div class="Lxz-actions">
						<button class="Lxz-btn" onClick=${() => this.skipReward()}>放弃奖励（跳过）</button>
					</div>
				</div></div>`}

				${state.overlay === 'event' && room?.type === 'event' && !room.resolved && html`<div class="Lxz-overlay"><div class="Lxz-overlayInner Lxz-event">
					<h2>${room.event.title}</h2>
					<p class="Lxz-eventFlavor">${room.event.flavor}</p>
					<div class="Lxz-actions" style="flex-direction:column">
						${room.event.options.map((opt, i) => html`
							<button class="Lxz-btn Lxz-eventOpt" onClick=${() => this.resolveEventChoice(i)}>
								<b>${opt.label}</b><span>${opt.desc}</span>
							</button>`)}
					</div>
					<p class="Lxz-hint">灵质回路中的奇遇，源自灵质力生命周期的古老传说。</p>
				</div></div>`}

				${state.overlay === 'eventResult' && room?.type === 'event' && room.resolved && html`<div class="Lxz-overlay"><div class="Lxz-overlayInner Lxz-event">
					<h2>${room.event.title}</h2>
					<p class="Lxz-eventFlavor">${room.event.options[room.choiceIndex]?.label}：${room.event.options[room.choiceIndex]?.desc}</p>
					<p class="Lxz-eventResult">${state.eventResult || '奇遇已了结，继续前行。'}</p>
					<div class="Lxz-actions">
						<button class="Lxz-btn Lxz-btn--main" onClick=${() => this.setState({overlay: 'map'})}>继续前行</button>
					</div>
				</div></div>`}

				${state.overlay === 'space' && room?.type === 'space' && !room.resolved && html`<div class="Lxz-overlay"><div class="Lxz-overlayInner Lxz-event">
					<h2>${room.space.name}</h2>
					<p class="Lxz-eventFlavor">${room.space.desc}</p>
					<div class="Lxz-actions" style="flex-direction:column">
						${room.space.options.map((opt, i) => html`
							<button class="Lxz-btn Lxz-eventOpt" onClick=${() => this.resolveSpaceChoice(i)}>
								<b>${opt.label}</b><span>${opt.desc}</span>
							</button>`)}
					</div>
					<p class="Lxz-hint">灵质空间是每个生命固有的空间；进了别人的灵质空间，就要守它主人的规矩。</p>
				</div></div>`}

				${state.overlay === 'spaceResult' && room?.type === 'space' && room.resolved && html`<div class="Lxz-overlay"><div class="Lxz-overlayInner Lxz-event">
					<h2>${room.space.name}</h2>
					<p class="Lxz-eventFlavor">${room.space.options[room.choiceIndex]?.label}：${room.space.options[room.choiceIndex]?.desc}</p>
					<p class="Lxz-eventResult">${state.eventResult || '灵质已安，继续前行。'}</p>
					<div class="Lxz-actions">
						<button class="Lxz-btn Lxz-btn--main" onClick=${() => this.setState({overlay: 'map'})}>离开空间</button>
					</div>
				</div></div>`}

				${state.overlay === 'campfire' && html`<div class="Lxz-overlay"><div class="Lxz-overlayInner">
					<h2>休整点</h2>
					<div class="Lxz-actions">
						<button class="Lxz-btn Lxz-btn--main" onClick=${() => this.campfireRest()}>休整（回复 30% 生命）</button>
						<button class="Lxz-btn" onClick=${() => this.setState({overlay: 'remove'})}>移除一张卡牌</button>
						<button class="Lxz-btn" onClick=${() => this.setState({overlay: 'map'})}>离开</button>
					</div>
				</div></div>`}

				${state.overlay === 'remove' && html`<div class="Lxz-overlay"><div class="Lxz-overlayInner">
					<h2>选择要移除的卡牌</h2>
					<div class="Lxz-hand" style="justify-content:center">${s.deck.map((card) => html`
						<div class="Lxz-card Lxz-rewardCard" onClick=${() => this.campfireRemove(card)}>
							<h5><span>${card.name}</span><span class="Lxz-cardCost">${card.energy || 0}</span></h5>
							<p style="font-size:11px">${card.desc}</p>
						</div>`)}</div>
					<p class="Lxz-hint">移除后本局不再出现该卡。</p>
				</div></div>`}

				${state.overlay === 'deck' && html`<div class="Lxz-overlay"><div class="Lxz-overlayInner">
					<h2>当前卡组（${s.deck.length} 张）</h2>
					<div class="Lxz-hand" style="justify-content:center">${s.deck.map((card) => html`
						<div class="Lxz-card">
							<h5><span>${card.name}</span><span class="Lxz-cardCost">${card.energy || 0}</span></h5>
							<p style="font-size:11px">${card.desc}</p>
						</div>`)}</div>
					<div class="Lxz-actions"><button class="Lxz-btn" onClick=${() => this.setState({overlay: null})}>关闭</button></div>
				</div></div>`}

				${state.result && html`<div class="Lxz-overlay"><div class="Lxz-overlayInner" style="text-align:center">
					<h2>${state.result.won ? '修行圆满！' : '修行失败……'}</h2>
					<p class="Lxz-sub">${state.result.won ? '你击败了守门 Boss，完成了本次灵质回路试炼。' : '你的灵质回路止步于此，下次再战。'}</p>
					<div class="Lxz-stats" style="justify-content:center;margin:14px 0">
						<div class="Lxz-stat"><b>${fmtTime(state.result.elapsedMs)}</b><span>本次用时</span></div>
						<div class="Lxz-stat"><b>${state.result.awardShards && state.result.won ? '+30' : '+0'}</b><span>获得残片</span></div>
						${state.result.soulGained ? html`<div class="Lxz-stat"><b>+${state.result.soulGained}</b><span>魂灵 · 折入轮回</span></div>` : ''}
						${state.result.won ? html`<div class="Lxz-stat"><b>${s.maxTurnsInRun || 0}</b><span>单场最高回合</span></div>` : ''}
					</div>
					${state.result.soulGained ? html`<p class="Lxz-hint">本次修行的${state.result.won ? '感悟' : '散灵'}已折入魂灵传承——下一世爬塔开局将获得传承加成。</p>` : ''}
					${state.result.settlementReward ? html`<p class="Lxz-hint">灵质修行结算已存续：${[state.result.settlementReward.cultivation ? `修为 +${state.result.settlementReward.cultivation}` : '', state.result.settlementReward.daoHeart ? `道心 +${state.result.settlementReward.daoHeart}` : '', state.result.settlementReward.treasureIds?.length ? `法宝「${state.result.settlementReward.treasureIds.join('」「')}」` : ''].filter(Boolean).join('、')}——下一局爬塔开局自动承接。</p>` : ''}
					${!state.result.awardShards ? html`<p class="Lxz-hint">今日免费次数已用完，本次修行未获得残片与魂灵。</p>` : ''}
					<button class="Lxz-btn Lxz-btn--main" onClick=${() => this.props.onExit()}>返回主界面</button>
				</div></div>`}
			</div>
		`
	}
}

// ============ 活动根组件 ============
export default class LingzhiXiuxingActivity extends Component {
	constructor() {
		super()
		this.state = {page: 'home', progress: loadProgress(), selectedCharacter: 'walker'}
	}
	componentDidMount() {
		setLingzhiScene('home')
	}
	componentDidUpdate(prevProps, prevState) {
		// 页面切换时同步音景：主页/图鉴/成就 → home，选角 → select，战斗页交给 LingzhiBattle 自管
		if (prevState.page !== this.state.page) {
			if (this.state.page === 'select') setLingzhiScene('select')
			else if (this.state.page !== 'battle') setLingzhiScene('home')
		}
	}
	onProgress(progress) {
		this.setState({progress})
	}
	render(props, state) {
		const remaining = todayRemaining(state.progress)
		const pageProps = {
			progress: state.progress,
			onProgress: (p) => this.onProgress(p),
		}
		return html`
			<div class="Lxz">
				<${LxzStyle} />
				<img class="Lxz-banner" src="ui/images/scenes/spirit-cultivation.png" alt="灵质修行" />
				<div class="Lxz-head">
					<button class="Lxz-back" onClick=${() => { stopBgm(); props.onExit() }}>返回</button>
					<div>
						<h1 class="Lxz-title">灵质修行</h1>
						<p class="Lxz-sub">独立活动 · 同人创作内容，与官方世界观独立</p>
					</div>
				</div>
				${
					state.page === 'home' &&
					html`<${LingzhiHome} progress=${state.progress} remaining=${remaining} onPage=${(p) => this.setState({page: p})} onStart=${() => this.setState({page: 'select'})} />`
				}
				${
					state.page === 'unlock' &&
					html`<${LingzhiUnlock} ...${pageProps} />`
				}
				${
					state.page === 'collection' &&
					html`<${LingzhiCollection} ...${pageProps} />`
				}
				${
					state.page === 'achievements' &&
					html`<${LingzhiAchievements} ...${pageProps} />`
				}
				${
					state.page === 'select' &&
					html`<${LingzhiSelect} progress=${state.progress} onBack=${() => this.setState({page: 'home'})} onStart=${(id) => { this.setState({page: 'battle', selectedCharacter: id}) }} />`
				}
				${
					state.page === 'xiuxian' &&
					html`
					<div class="Lxz-card" style="padding:0;overflow:hidden">
						<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;background:var(--paper3);border-bottom:1px solid var(--paper-line2)">
							<button class="Lxz-back" onClick=${() => { stopBgm(); this.setState({page: 'home'}) }}>返回修行</button>
							<span style="color:var(--camel2);font-weight:700">一念仙途 · 完整修仙冒险</span>
							<span style="color:var(--camel);font-size:12px">独立完整版，含功法/境界/因果/秘境/法宝等全部系统</span>
						</div>
						<iframe src="xiuxian-card/index.html" style="width:100%;height:76vh;border:0;display:block;background:#1a1612" loading="eager"></iframe>
					</div>`
				}
				${
					state.page === 'battle' &&
					html`<${LingzhiBattle} key=${state.selectedCharacter} progress=${state.progress} selectedCharacter=${state.selectedCharacter} onProgress=${(p) => this.onProgress(p)} onExit=${() => this.setState({page: 'home'})} />`
				}
			</div>
		`
	}
}
