
const STORAGE_KEY = 'luoxiaohei_characters';

// ========== 登录与数据同步 ==========
let currentUser = null;

async function checkLogin() {
  try {
    const r = await fetch('/api/user');
    const u = await r.json();
    if (u.logged_in) {
      currentUser = u;
      renderAuthBar(u);
      await syncFromServer();
    } else {
      currentUser = null;
      renderAuthBar(null);
    }
  } catch(e) {
    currentUser = null;
    renderAuthBar(null);
  }
}

function renderAuthBar(user) {
  const roleName = { executor: '执行者', elder: '长老', admin: '管理员' };
  const bar = document.getElementById('authBar');
  if (bar) {
    if (user) {
      const avatar = user.avatar ? `<img class="user-avatar" src="${escapeHtml(user.avatar)}" alt="">` : '';
      const adminLink = user.is_admin ? '<a class="btn-logout" href="/admin.html">管理</a>' : '';
      const roleTag = user.role && roleName[user.role] ? `<span class="role-tag">${roleName[user.role]}</span>` : '';
      bar.innerHTML = `<div class="user-badge">${avatar}<span>${escapeHtml(user.nickname || user.username || user.id || '')}</span>${roleTag}</div>
        <span class="sync-status ok" id="syncStatus">已同步</span>
        ${adminLink}
        <a class="btn-logout" href="/api/logout">退出</a>`;
    } else {
      bar.innerHTML = '<a class="btn-login" href="javascript:void(0)" onclick="openAuthModal()">登录 / 注册</a>';
    }
  }
  renderRoleLine();
  checkRoyalLimit();
}

// ---- 登录/注册弹窗（统一入口） ----
function openAuthModal() {
  document.getElementById('authMsg').textContent = '';
  document.getElementById('authMask').hidden = false;
  const u = document.getElementById('authUsername');
  if (u) u.focus();
}
function closeAuthModal() {
  document.getElementById('authMask').hidden = true;
}
async function submitAuth() {
  const username = document.getElementById('authUsername').value.trim();
  const password = document.getElementById('authPassword').value;
  const msg = document.getElementById('authMsg');
  const btn = document.getElementById('authSubmit');
  msg.className = 'auth-msg';
  if (!username || !password) { msg.textContent = '请填写用户名和密码'; return; }
  btn.disabled = true;
  try {
    const r = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const d = await r.json();
    if (d.ok) {
      msg.className = 'auth-msg ok';
      msg.textContent = d.registered ? '已自动注册并登录' : '登录成功';
      document.getElementById('authPassword').value = '';
      setTimeout(() => { closeAuthModal(); checkLogin(); }, 500);
    } else {
      msg.textContent = d.error || '操作失败，请重试';
    }
  } catch(e) {
    msg.textContent = '网络错误，请重试';
  }
  btn.disabled = false;
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !document.getElementById('authMask').hidden) closeAuthModal();
});

async function syncFromServer() {
  try {
    const r = await fetch('/api/get-characters');
    if (!r.ok) return;
    const d = await r.json();
    const serverChars = d.characters || [];
    const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

    if (serverChars.length > 0) {
      const serverCodes = new Set(serverChars.map(c => c.code || c.data?.code || ''));
      const merged = serverChars.map(c => c.data || c);
      local.forEach(c => { if (!serverCodes.has(c.code)) merged.push(c); });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      const st = document.getElementById('syncStatus');
      if (st) { st.textContent = '已同步'; st.className = 'sync-status ok'; }
      renderList();
    } else if (local.length > 0) {
      // 服务器没有数据，但本地有：把本地数据全部推送到服务器
      const st = document.getElementById('syncStatus');
      if (st) { st.textContent = '正在同步本地数据...'; st.className = 'sync-status'; }
      await fetch('/api/save-all-characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characters: local })
      });
      if (st) { st.textContent = '已同步'; st.className = 'sync-status ok'; }
    }
  } catch(e) {
    const st = document.getElementById('syncStatus');
    if (st) { st.textContent = '同步失败'; st.className = 'sync-status'; }
  }
}

async function pushToServer(data) {
  if (!currentUser) return;
  try {
    await fetch('/api/save-character', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: data.code, html: '', data: data })
    });
    const st = document.getElementById('syncStatus');
    if (st) { st.textContent = '已同步'; st.className = 'sync-status ok'; }
  } catch(e) {
    const st = document.getElementById('syncStatus');
    if (st) { st.textContent = '待同步'; st.className = 'sync-status'; }
  }
}

const ABILITY_BRANCHES = {
  '御灵系': ['金', '木', '水', '火', '土'],
  '生灵系': ['强化系', '治愈系', '洞察', '豪夺'],
  '造物系': ['画灵', '仿生'],
  '空间系': ['领域', '传送', '吞噬', '转移', '蕴藏', '时滞'],
  '心灵系': ['读心', '心灵操纵', '傀儡'],
  '锁御系': ['灵御', '制灵']
};

const ABILITY_DESC = {
  '御灵系': '妖灵最基础的能力体系，金（攻击）、木（生长）、水（控制/冰）、火（爆发）、土（防御），几乎每一位具备战力的妖精都修习御灵系。',
  '生灵系': '与生命本质相关，包含强化系（增强自身或他人身体能力）、治愈系（极为稀有，可治疗重伤）、洞察（感知生命气息与状态）、豪夺（强行夺取其他妖精的能力，属禁忌之术）。',
  '造物系': '可凭空创造物质或赋予其灵性，如画灵（将画作化为实体）、仿生（创造类生命体）。',
  '空间系': '与灵质空间深度绑定，失去空间系能力会导致灵质空间衰竭而死。分支包括领域（外放灵质空间）、传送、吞噬、转移、蕴藏、时滞。该系别极为稀有且危险。',
  '心灵系': '与精神力相关，包括读心、心灵操纵、傀儡术等。',
  '锁御系': '与法宝法器高度相关，灵御（以灵力驭使法器）、制灵（制造灵性法器）。擅长此系者多为炼器师或法宝收藏家。'
};

// 分支级描述（用于能力详解）
const BRANCH_DESC = {
  '金': '攻击属性，可操纵金属，如无限以金属为媒介飞行与战斗。',
  '木': '生长属性，可操控藤蔓等植物。如罗小黑、洛竹、风息均擅此道。',
  '水': '控制/冰属性，如玄离与阿根。',
  '火': '爆发属性，如哪吒、玄离与阿根。',
  '土': '防御属性，稳固守备。',
  '强化系': '增强自身或他人身体能力。',
  '治愈系': '极为稀有，可治疗重伤。如清凝即具备此能力。',
  '洞察': '感知生命气息与状态。老君即擅长此分支。',
  '豪夺': '强行夺取其他妖精的能力，属禁忌之术。风息曾使用此能力。',
  '画灵': '将画作化为实体。',
  '仿生': '创造类生命体。',
  '领域': '外放灵质空间。罗小黑曾拥有此能力（原为风息所夺，后亲手销毁）。',
  '传送': '通过空间进行传送。罗小黑借黑咻实现空间传送。',
  '吞噬': '将物质吞入灵质空间，但不能吞生灵。无限的标志性空间能力。',
  '转移': '空间转移能力。',
  '蕴藏': '蕴藏与收纳。',
  '时滞': '时间相关能力，极为罕见。',
  '读心': '读取他人思想。',
  '心灵操纵': '操纵他人意志。',
  '傀儡': '傀儡术，控制他人行动。',
  '灵御': '以灵力驭使法器，如哪吒、老君。',
  '制灵': '制造灵性法器，擅长此道者多为炼器师。'
};

// 双系合璧技能：一个技能占用两个大系、计 2 个分支名额（每个所系各计 1 个分支）
const COMBO_SKILLS = [
  { name: '画灵', systems: ['造物系', '生灵系'], holder: '画虎', desc: '画虎的标志性合璧技能：造物系×生灵系双系合璧，将画作化为实体并赋予其灵性。' }
];
let customCombos = [];
let extraOrder = [];
let prevManualSet = new Set();
let branchOrder = [];

// 中国古色配色方案 — 精选自 longtian/ancient-chinese-color 与 chroma-cathay/chinese-color-atlas
const COLOR_SCHEMES = [
  { name: '罗小黑·漆黑×翠绿', primary: '#1A1F2E', primaryDark: '#10131C', accent: '#0EB83A', accentLight: '#86DB9C', accentPale: '#B6E9C3', text: '#DFDBD8', dim: '#72707D', line: 'rgba(14,184,58,0.25)' },
  { name: '无限·靛蓝×银白', primary: '#065279', primaryDark: '#03324B', accent: '#D1D9E0', accentLight: '#E8ECEF', accentPale: '#F1F3F5', text: '#DCE3E4', dim: '#678CA6', line: 'rgba(209,217,224,0.25)' },
  { name: '鹿野·黛蓝×缟白', primary: '#3B3561', primaryDark: '#242042', accent: '#F0EFEB', accentLight: '#F6F5F2', accentPale: '#FBFAF8', text: '#E6E4F0', dim: '#8B87A6', line: 'rgba(240,239,235,0.25)' },
  { name: '哪吒·品红×橙黄', primary: '#8B1942', primaryDark: '#560F28', accent: '#FFA400', accentLight: '#FFD17F', accentPale: '#FFE3B2', text: '#F0DADB', dim: '#B06C88', line: 'rgba(255,164,0,0.25)' },
  { name: '三足乌馆长·暮紫×金橙', primary: '#4a1033', primaryDark: '#170a14', accent: '#e8a33d', accentLight: '#f5c26b', accentPale: '#ffd9a0', text: '#f3e6e0', dim: '#b99aa9', line: 'rgba(232,163,61,0.25)' },
  { name: '深绿×暖黄', primary: '#1b4d3e', primaryDark: '#103428', accent: '#e8c050', accentLight: '#f0d878', accentPale: '#f8e8a8', text: '#e4efe0', dim: '#8a9e80', line: 'rgba(232,192,80,0.25)' },
  { name: '黛蓝×缃色', primary: '#425066', primaryDark: '#27303d', accent: '#F0C239', accentLight: '#f7e09c', accentPale: '#faecc3', text: '#e5e3e1', dim: '#888b9c', line: 'rgba(240,194,57,0.25)' },
  { name: '绛紫×月白', primary: '#8C4356', primaryDark: '#542833', accent: '#D6ECF0', accentLight: '#eaf5f7', accentPale: '#f2f9fa', text: '#f1e1de', dim: '#b18393', line: 'rgba(214,236,240,0.25)' },
  { name: '鸦青×酡颜', primary: '#424C50', primaryDark: '#272d30', accent: '#F9906F', accentLight: '#fcc7b7', accentPale: '#fdddd3', text: '#e5e2de', dim: '#888890', line: 'rgba(249,144,111,0.25)' },
  { name: '玄青×赤金', primary: '#3D3B4F', primaryDark: '#24232f', accent: '#F2BE45', accentLight: '#f8dea2', accentPale: '#fbebc7', text: '#e5dfdd', dim: '#857f8f', line: 'rgba(242,190,69,0.25)' },
  { name: '黛绿×珊瑚赫', primary: '#2F4A4A', primaryDark: '#1D2D2D', accent: '#C12C1F', accentLight: '#e0958f', accentPale: '#ecbfbb', text: '#e3e2dd', dim: '#7d878c', line: 'rgba(193,44,31,0.25)' },
  { name: '紫檀×松花', primary: '#4C221B', primaryDark: '#2d1410', accent: '#FFEE6F', accentLight: '#fff6b7', accentPale: '#fff9d3', text: '#e7dcd6', dim: '#8d7172', line: 'rgba(255,238,111,0.25)' },
  { name: '苍色×茶色', primary: '#55666A', primaryDark: '#343F41', accent: '#B35C44', accentLight: '#d9ada1', accentPale: '#e8cec6', text: '#e8e6e1', dim: '#92979e', line: 'rgba(179,92,68,0.25)' },
  { name: '漆黑×牙色', primary: '#161823', primaryDark: '#0d0e15', accent: '#EEDEB0', accentLight: '#f6eed7', accentPale: '#f9f5e7', text: '#dfdad7', dim: '#706c77', line: 'rgba(238,222,176,0.25)' },
  { name: '靛蓝×藕荷色', primary: '#065279', primaryDark: '#033148', accent: '#E4C6D0', accentLight: '#f1e2e7', accentPale: '#f6edf0', text: '#dce3e4', dim: '#678ca6', line: 'rgba(228,198,208,0.25)' },
  { name: '黧×樱草色', primary: '#5D513C', primaryDark: '#373024', accent: '#EAFF56', accentLight: '#f4ffaa', accentPale: '#f8ffcc', text: '#e9e3db', dim: '#978b85', line: 'rgba(234,255,86,0.25)' },
  { name: '水绿×葱青', primary: '#D4F2E7', primaryDark: '#7f918a', accent: '#3E6E4E', accentLight: '#9eb6a6', accentPale: '#c3d3ca', text: '#2a3a2e', dim: '#6e8a78', line: 'rgba(62,110,78,0.25)' },
  { name: '苍黄×丁香色', primary: '#2E5C48', primaryDark: '#1C392C', accent: '#CCA4E3', accentLight: '#e5d1f1', accentPale: '#efe3f6', text: '#e2e4dc', dim: '#7d918b', line: 'rgba(204,164,227,0.25)' }
];

// 内置预设角色：选择同名配色且本地没有该角色时，自动填充完整设定
// （数据来自 oc.iridescently.xyz 馆长设定页，可随设定更新同步维护）
const PRESET_CHARS = {
  '三足乌馆长': {
    code: '虹（佳霖），西木会馆，上古三足乌后裔，无主空间的收集者与安魂人',
    name: '虹',
    gender: '男',
    species_type: '妖精',
    species_detail: '鸦科（三足乌，上古鸦科神鸟后裔）',
    personality: '温和，习惯先照顾别人感受；放心不下的人都会悄悄看着；热爱自然，讨厌无节制城市扩张；爱好和平，乐于分享灵质能力，平时喜欢呆在自己的球形灵质空间里，但也有热情的时候。',
    age: 1468,
    height: '人形约178cm',
    likes: '温柔的人、可爱的事物、雨后初晴、发光的小物什',
    dislikes: '没有光亮的感觉、被打扰的安眠魂灵、无节制的城市扩张',
    food: '杂食，最喜欢吃果冻',
    appearance: '黑发，琥珀色眼。真身为黑羽鎏金翅的三足金乌，展翅时翅缘淌虹光。人形常穿深红紫色的外袍——深得近黑，如同凝固的暮色；内衬金橙色，如同暮色里藏着一轮落日。',
    abilities: ['御灵系·木', '生灵系·拾遗、衔光（唤光）', '空间系·「虹之间」'],
    weapon: '扶桑枝——太阳栖息的神树之枝。持之可掌握御灵系·木',
    background: '上古三足乌的后裔。北周明帝二年（558年）曾被人捉住，当作祥瑞献给皇帝，趁夜逃出，从此四处游荡，收集各种存有灵力的发光石头（无主空间），并细致安放和安抚其中原本的残魂记忆。曾加入西木会馆，与馆长西木子相识，但已约300年没回去，会馆现在叫什么名字都不知道了。',
    intro: '常在雨后的虹光里出现，会找找有没有第一时间反射虹光的发光石头；平常就喜欢呆在自己的灵质空间里摆弄自己放置好的各类东西。遇到登门拜访的也十分热情好客，看到需要帮助的情况就会主动帮忙，无私奉献，乐于共享自己的灵质能力。',
    org: '西木会馆',
    faction: 50,
    faction_label: '中立',
    notes: '妖界真名：踆乌（《淮南子》「日中有踆乌」），平时藏起来不用。',
    is_elder: true,
    image: '',
    customDetails: {
      '生灵系::拾遗': '吸收死者遗留的散灵物质，汲取灵力。本质是分解者，亦收容无主空间。',
      '生灵系::衔光（唤光）': '与他人牵起光丝，联系越深光越亮，靠光确认彼此安好。',
      '空间系::「虹之间」': '灵质空间，收纳无主空间及其中残魂，承载记忆与死去魂灵。是他的收藏室兼安魂所。'
    }
  }
};

let selectedColor = null;
let selectedColorIdx = Math.max(0, COLOR_SCHEMES.findIndex(s => s.name.startsWith('深绿')));
let pendingData = null;

// ========== 数据存取 ==========
function loadAll() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch(e) { return []; } }
function saveAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch(e) {
    // 本地空间不足：列表不存图片base64（完整图在服务器），保证登记仍能保存
    const lite = (data || []).map(c => { const o = Object.assign({}, c); o.images = []; o.image = ''; return o; });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lite)); } catch(e2) {}
  }
}

// ========== 动态 UI ==========
function handlePersPreset() {
  const sel = document.getElementById('persPreset');
  const inp = document.getElementById('persInput');
  inp.style.display = '';
  inp.value = sel.value === '' ? '' : sel.value;
  inp.focus();
}

function handleOrgPreset() {
  const sel = document.getElementById('orgPreset');
  const inp = document.getElementById('orgInput');
  if (sel.value === '_custom') { inp.style.display = ''; inp.focus(); }
  else { inp.style.display = 'none'; inp.value = ''; }
}

document.getElementById('speciesType').addEventListener('change', function() {
  const detail = document.getElementById('speciesDetail');
  if (this.value === '妖精') { detail.disabled = false; detail.placeholder = '如：鸦科、犬科、猫科、蛇科…'; }
  else { detail.disabled = true; detail.value = ''; detail.placeholder = '仅妖精需填写详细种族'; }
});

// ========== 御灵系限制 ==========
// 身份权限：御灵系名额 + 年龄上限
function rolePriv() {
  const r = (window.currentUser && currentUser.role) || '';
  if (r === 'elder' || r === 'admin') return { royal: 2, age: 1500 };
  if (r === 'executor' || r === 'user') return { royal: 2, age: 450 };
  return { royal: 1, age: 450 };
}
function renderRoleLine() {
  const el = document.getElementById('roleLine');
  if (!el) return;
  if (!window.currentUser || !currentUser.logged_in) {
    el.innerHTML = '未登录：御灵系最多 1 系、年龄上限 450 岁。注册后默认成为<strong>执行者</strong>（御灵系可选 2 系）。';
    return;
  }
  const r = currentUser.role;
  if (r === 'elder' || r === 'admin') {
    el.innerHTML = '当前身份：<strong>' + (r === 'admin' ? '管理员' : '长老') + '</strong>（御灵系可选 2 系 · 年龄上限 1500 岁）';
  } else if (currentUser.elder_pending) {
    el.innerHTML = '当前身份：<strong>执行者</strong>（御灵系可选 2 系 · 年龄上限 450 岁）· 长老申请审核中';
  } else {
    el.innerHTML = '当前身份：<strong>执行者</strong>（御灵系可选 2 系 · 年龄上限 450 岁） <button type="button" class="btn-elder-apply" onclick="applyElder()">申请长老</button>';
  }
}
async function applyElder() {
  const msg = (prompt('申请长老的理由（选填，300 字内）：') || '').trim();
  try {
    const r = await fetch('/api/elder/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg }) });
    const d = await r.json();
    if (d.ok) {
      showToast('success', '✔ 长老申请已提交，等待馆长审批。', 5000);
      if (window.currentUser) currentUser.elder_pending = true;
      renderRoleLine();
    } else {
      showToast('error', '⚠ ' + (d.error || '申请失败'), 5000);
    }
  } catch (e) { showToast('error', '⚠ 网络错误，申请未提交', 5000); }
}
function checkRoyalLimit() {
  const priv = rolePriv();
  const cbs = document.querySelectorAll('input[name="ability_royal"]:checked');
  const max = priv.royal;
  if (cbs.length > max) {
    // 取消最后一个勾选的
    cbs[cbs.length - 1].checked = false;
  }
  // 年龄上限：执行者 450，长老/管理员 1500
  const ageInput = document.getElementById('ageInput');
  ageInput.max = priv.age;
  if (priv.age >= 1500) {
    ageInput.placeholder = '长老上限1500岁';
  } else {
    ageInput.placeholder = '普通上限450岁';
    if (parseInt(ageInput.value) > 450) ageInput.value = 450;
  }
  renderRoleLine();
  updateAbilityDetail();
}

// ========== 额外系别 ==========
function onExtraSystemChange() {
  const comboSysSet = new Set(getActiveCombos().flatMap(c => c.systems));
  // 合璧技能所占大系不可取消（若被取消则恢复）
  comboSysSet.forEach(sys => {
    const occ = document.querySelector('input[name="extra_sys"][value="' + sys + '"]');
    if (occ && !occ.checked) occ.checked = true;
  });
  // 手动大系（非合璧所占）最多 2 个，合璧所占不占名额
  const manual = Array.from(document.querySelectorAll('input[name="extra_sys"]:checked')).filter(c => !comboSysSet.has(c.value));
  if (manual.length > 2) {
    const added = manual.filter(c => !prevManualSet.has(c.value));
    (added.length ? added : [manual[manual.length - 1]]).forEach(c => { c.checked = false; });
    abilityNotice('除合璧技能所占大系外，最多再选 2 个大系。');
  }
  // 治愈系与空间系互斥：勾选空间系时取消生灵系的治愈系分支
  const spaceCb = document.querySelector('input[name="extra_sys"][value="空间系"]');
  if (spaceCb && spaceCb.checked) {
    const cureCb = document.querySelector('input[name="ability_生灵系"][value="治愈系"]');
    if (cureCb && cureCb.checked) cureCb.checked = false;
    abilityNotice('空间系限定：极为稀有且危险，只能选 1 个特殊能力；与治愈系互斥，不可同时选择。', spaceCb);
  }
  prevManualSet = new Set(Array.from(document.querySelectorAll('input[name="extra_sys"]:checked')).filter(c => !comboSysSet.has(c.value)).map(c => c.value));
  renderExtraBranches();
  updateAbilityDetail();
}

function renderExtraBranches() {
  const container = document.getElementById('extraBranchesContainer');
  const checked = Array.from(document.querySelectorAll('input[name="extra_sys"]:checked')).map(c => c.value);
  // 新选的系排最前（按选择时间倒序）
  extraOrder = extraOrder.filter(s => checked.includes(s));
  checked.forEach(s => { if (!extraOrder.includes(s)) extraOrder.unshift(s); });
  if (extraOrder.length === 0) { container.innerHTML = ''; return; }

  // 保留已有分支勾选状态（合璧占位芯片除外）
  const state = {};
  document.querySelectorAll('#extraBranchesContainer input[type="checkbox"]:not([data-combo])').forEach(cb => {
    if (cb.checked) state[cb.name + '::' + cb.value] = true;
  });

  let html = '';
  extraOrder.forEach(sys => {
    const branches = ABILITY_BRANCHES[sys] || [];
    // 合璧技能作为占位分支显示在所系下面
    const comboChips = getActiveCombos().filter(c => c.systems.includes(sys)).map(c =>
      `<label><input type="checkbox" name="ability_${sys}" value="${c.name}" data-combo="1" checked disabled><span>${c.name}（合璧）</span></label>`
    ).join('');
    const branchChecks = branches.map(b => {
      const key = 'ability_' + sys + '::' + b;
      const checkedAttr = state[key] ? ' checked' : '';
      return `<label><input type="checkbox" name="ability_${sys}" value="${b}" onchange="onBranchLimit(this, '${sys}')"${checkedAttr}><span>${b}</span></label>`
    }).join('');

    html += `<div class="ability-cat" style="margin-top:12px;">
      <div class="ability-cat-title">${sys} · 分支（至少选一项）</div>
      <div class="ability-branches">${comboChips}${branchChecks}</div>
      <div class="branch-custom-row combo-row" style="margin-top:8px;">
        <span class="branch-preset-label">自定义分支</span>
        <input type="text" placeholder="自定义${sys}分支名称" style="flex:1;" data-custom-branch="${sys}" onkeydown="if(event.key==='Enter'){event.preventDefault();addCustomBranch('${sys}')}">
        <button type="button" onclick="addCustomBranch('${sys}')">添加</button>
      </div>
      <div id="cbTags_${sys}" style="margin-top:4px;"></div>
    </div>`;
  });
  container.innerHTML = html;
  extraOrder.forEach(s => renderCustomBranchTags(s));
}

// ========== 额外系别分支数量限制 ==========
function branchKey(cb, sys) { return sys + '::' + cb.value; }
function oldestChecked(sys, excludeValues) {
  const list = Array.from(document.querySelectorAll(`input[name="ability_${sys}"]:checked`))
    .filter(x => !x.hasAttribute('data-combo') && !(excludeValues || []).includes(x.value));
  if (!list.length) return null;
  return list.reduce((a, b) => (branchOrder.indexOf(branchKey(a, sys)) <= branchOrder.indexOf(branchKey(b, sys)) ? a : b));
}
function onBranchLimit(cb, sys) {
  const key = branchKey(cb, sys);
  if (cb.checked) { if (!branchOrder.includes(key)) branchOrder.push(key); }
  else branchOrder = branchOrder.filter(k => k !== key);

  const combos = getActiveCombos();
  const comboSysSet = new Set(combos.flatMap(c => c.systems));
  const isComboChip = cb.hasAttribute('data-combo');
  const cureInput = document.querySelector('input[name="ability_生灵系"][value="治愈系"]');
  const cureActive = (cureInput && cureInput.checked) || (sys === '生灵系' && cb.value === '治愈系' && cb.checked);
  const checkedOf = s => Array.from(document.querySelectorAll(`input[name="ability_${s}"]:checked`));

  // 每系上限：空间系 1；治愈系激活时生灵系 2（治愈系+再 1 个），其余大系 0（分支不可选）
  let max = sys === '空间系' ? 1 : 2;
  if (cureActive && sys !== '生灵系' && sys !== '空间系') max = 0;

  if (checkedOf(sys).length > max) {
    if (cureInput && cureInput.checked) {
      // 名额受限时优先回退「治愈系」：保留先前普通分支与本次选择，不锁死、也不取消最早选的普通分支
      const wasCure = sys === '生灵系' && cb.value === '治愈系' && cb.checked;
      cureInput.checked = false;
      branchOrder = branchOrder.filter(k => k !== branchKey(cureInput, '生灵系'));
      abilityNotice(wasCure
        ? '生灵系已选满 2 个分支：「治愈系」无法同时选择，本次选择已取消。'
        : '名额受限：已自动取消「治愈系」，以保留当前选择。', cb);
    } else if (sys === '生灵系') {
      // 未选治愈系的生灵系超限：取消最早选择的（FIFO）
      while (checkedOf(sys).length > max) {
        const old = oldestChecked(sys);
        if (!old) break;
        old.checked = false; branchOrder = branchOrder.filter(k => k !== branchKey(old, sys));
        abilityNotice('生灵系最多 2 个分支：已取消最早选择的「' + old.value + '」。', cb);
      }
    } else {
      cb.checked = false; branchOrder = branchOrder.filter(k => k !== key);
    }
  }

  // 启用合璧时：非合璧系手动分支总数最多 2
  if (cb.checked && combos.length && !comboSysSet.has(sys) && !isComboChip) {
    let manual = 0;
    document.querySelectorAll('#extraBranchesContainer input[type="checkbox"]:checked:not([data-combo])').forEach(x => {
      if (!comboSysSet.has(x.name.replace('ability_', ''))) manual++;
    });
    if (manual > 2) { cb.checked = false; branchOrder = branchOrder.filter(k => k !== key); abilityNotice('合璧技能已占用名额：额外分支最多再选 2 个。', cb); }
  }

  // 治愈系与空间系互斥
  if (sys === '生灵系' && cb.value === '治愈系' && cb.checked) {
    const spaceCb = document.querySelector('input[name="extra_sys"][value="空间系"]');
    if (spaceCb && spaceCb.checked) { spaceCb.checked = false; renderExtraBranches(); }
    abilityNotice('治愈系限定：极为稀有，与空间系互斥；选择后生灵系还可再选 1 个分支，其他大系分支不可选。', cb);
  }
  updateAbilityDetail();
}

// ========== 双系合璧技能 ==========
const EXTRA_SYSTEM_NAMES = ['生灵系', '造物系', '空间系', '心灵系', '锁御系'];
let noticeTimer = null;
function abilityNotice(msg, anchor) {
  const el = document.getElementById('abilityNotice');
  if (!el) return;
  el.textContent = msg;
  el.style.display = '';
  // 放到所选区块的上方
  const panel = document.querySelector('.ability-panel');
  const target = anchor ? anchor.closest('.ability-cat') : null;
  if (target && target.parentNode) target.parentNode.insertBefore(el, target);
  else if (panel) panel.insertBefore(el, panel.firstChild);
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { el.style.display = 'none'; }, 6000);
}
function getActiveCombos() {
  const list = [];
  document.querySelectorAll('#comboPresets input[type="checkbox"]:checked').forEach(cb => {
    const preset = COMBO_SKILLS.find(c => c.name === cb.value);
    if (preset) list.push(preset);
  });
  return list.concat(customCombos);
}
function comboCountFor(sys) {
  return getActiveCombos().filter(c => c.systems.includes(sys)).length;
}
function sysManualCap(sys) {
  const comboOcc = comboCountFor(sys);
  const cure = document.querySelector('input[name="ability_生灵系"][value="治愈系"]');
  const cureActive = cure && cure.checked;
  let cap = sys === '空间系' ? 1 : 2;
  if (cureActive && sys !== '生灵系' && sys !== '空间系') cap = 1;
  if (cureActive && sys === '生灵系') cap = 0;
  return Math.max(0, cap - comboOcc);
}
function manualBranchCount(sys) {
  const checked = document.querySelectorAll('input[name="ability_' + sys + '"]:checked:not([data-combo])').length;
  return checked + (customBranches[sys] || []).length;
}
function renderComboUI() {
  const presetBox = document.getElementById('comboPresets');
  if (presetBox && !presetBox.dataset.built) {
    presetBox.innerHTML = COMBO_SKILLS.map(c =>
      '<label><input type="checkbox" name="combo_preset" value="' + c.name + '" onchange="onComboChange()"><span>' + c.name + '（' + c.systems.join('×') + '）</span></label>'
    ).join('');
    presetBox.dataset.built = '1';
  }
  const a = document.getElementById('comboSysA'), b = document.getElementById('comboSysB');
  if (a && a.options.length === 0) {
    EXTRA_SYSTEM_NAMES.forEach(s => { a.add(new Option(s, s)); b.add(new Option(s, s)); });
  }
  const cl = document.getElementById('customComboList');
  if (cl) {
    cl.innerHTML = customCombos.map((c, i) =>
      '<span class="combo-tag">' + c.name + '（' + c.systems.join('×') + '）<button type="button" onclick="removeCustomCombo(' + i + ')">×</button></span>'
    ).join('');
  }
}
function addCustomCombo() {
  const name = document.getElementById('comboName').value.trim();
  const sa = document.getElementById('comboSysA').value;
  const sb = document.getElementById('comboSysB').value;
  if (!name) { abilityNotice('请先填写合璧技能名称。'); return; }
  if (sa === sb) { abilityNotice('合璧技能需要两个不同的大系。'); return; }
  if (getActiveCombos().length >= 1) { abilityNotice('合璧技能占用两个大系，默认仅限 1 个；如需更换请先移除现有合璧。'); return; }
  customCombos.push({ name: name, systems: [sa, sb], holder: '自设', desc: '自设双系合璧技能：' + sa + '×' + sb + '。' });
  document.getElementById('comboName').value = '';
  onComboChange();
}
function removeCustomCombo(i) {
  customCombos.splice(i, 1);
  onComboChange();
}
function toggleComboCustom() {
  const w = document.getElementById('comboCustomWrap');
  const btn = document.getElementById('comboCustomToggle');
  const open = w.style.display !== 'none';
  w.style.display = open ? 'none' : '';
  if (btn) btn.textContent = open ? '＋ 自设合璧' : '－ 收起自设';
}

// ========== 多填：武器/法宝 与 自设分支 ==========
let weaponList = [];
let customBranches = {};
function getWeaponString() {
  const wi = document.getElementById('weaponInput');
  const extra = wi ? wi.value.trim() : '';
  return weaponList.concat(extra ? [extra] : []).join('、');
}
function addWeapon() {
  const inp = document.getElementById('weaponInput');
  const v = inp.value.trim();
  if (!v) return;
  if (v.includes('若木')) { abilityNotice('不可使用若木。'); return; }
  weaponList.push(v); inp.value = ''; renderWeaponTags();
}
function removeWeapon(i) { weaponList.splice(i, 1); renderWeaponTags(); }
function renderWeaponTags() {
  const t = document.getElementById('weaponTags');
  if (!t) return;
  t.innerHTML = weaponList.map((w, i) => '<span class="combo-tag">' + w + '<button type="button" onclick="removeWeapon(' + i + ')">×</button></span>').join('');
}
function addCustomBranch(sys) {
  const inp = document.querySelector('input[data-custom-branch="' + sys + '"]');
  if (!inp) return;
  const v = inp.value.trim();
  if (!v) return;
  if (manualBranchCount(sys) >= sysManualCap(sys)) { abilityNotice('「' + sys + '」分支已达上限（含自设），不能再加。'); return; }
  (customBranches[sys] = customBranches[sys] || []).push(v);
  inp.value = ''; renderCustomBranchTags(sys); updateAbilityDetail();
}
function removeCustomBranch(sys, i) { (customBranches[sys] = customBranches[sys] || []).splice(i, 1); renderCustomBranchTags(sys); updateAbilityDetail(); }
function renderCustomBranchTags(sys) {
  const t = document.getElementById('cbTags_' + sys);
  if (!t) return;
  t.innerHTML = (customBranches[sys] || []).map((w, i) => '<span class="combo-tag">' + w + '<button type="button" onclick="removeCustomBranch(\'' + sys + '\',' + i + ')">×</button></span>').join('');
}
function onComboChange() {
  // 合璧默认仅 1 个：有自设合璧时取消预设合璧，避免叠加超限
  if (customCombos.length > 0) {
    document.querySelectorAll('#comboPresets input[type="checkbox"]:checked').forEach(cb => { cb.checked = false; });
  }
  const combos = getActiveCombos();
  combos.forEach(c => c.systems.forEach(sys => {
    const cb = document.querySelector('input[name="extra_sys"][value="' + sys + '"]');
    if (cb && !cb.checked) cb.checked = true;
  }));
  const checked = document.querySelectorAll('input[name="extra_sys"]:checked');
  if (checked.length > 2) checked[checked.length - 1].checked = false;
  renderComboUI();
  renderExtraBranches();
  updateAbilityDetail();
  if (combos.length) {
    abilityNotice('已启用双系合璧技能：占用 ' + combos.map(c => c.systems.join('×')).join('、') + '，每个所系各计 1 个分支名额（每系分支上限仍为 2）。');
  }
}
renderComboUI();

// ========== 能力详解自动填充 ==========
function updateAbilityDetail() {
  const panel = document.getElementById('abilityDetailPanel');
  const empty = document.getElementById('abilityDetailEmpty');
  const royalCbs = document.querySelectorAll('input[name="ability_royal"]:checked');
  const extraCbs = document.querySelectorAll('input[name="extra_sys"]:checked');

  const blocks = [];

  // 御灵系
  if (royalCbs.length > 0) {
    blocks.push({ system: '御灵系', desc: ABILITY_DESC['御灵系'], branches: Array.from(royalCbs).map(cb => cb.value) });
  }

  // 额外系别
  extraCbs.forEach(sysCb => {
    const sys = sysCb.value;
    const branchCbs = document.querySelectorAll(`input[name="ability_${sys}"]:checked`);
    const branchNames = Array.from(branchCbs).map(cb => cb.value);
    // 自设分支（可多个）+ 当前输入
    (customBranches[sys] || []).forEach(b => branchNames.push(b));
    const customInput = document.querySelector(`input[data-custom-branch="${sys}"]`);
    const customVal = customInput ? customInput.value.trim() : '';
    if (customVal) branchNames.push(customVal);
    blocks.push({ system: sys, desc: ABILITY_DESC[sys] || '', branches: branchNames });
  });

  // 检查御灵系自定义
  const royalCustom = document.getElementById('royalCustomName').value.trim();
  if (royalCustom && royalCbs.length > 0) {
    // 自定义分支追加到御灵系
    const royalBlock = blocks.find(b => b.system === '御灵系');
    if (royalBlock) royalBlock.branches.push(royalCustom);
  }

  if (blocks.length === 0) {
    panel.innerHTML = '<div class="empty-tip" style="padding:16px;" id="abilityDetailEmpty">在上方选择能力系别和分支后，此处将自动显示能力解释。数据库中未收录的分支将提供输入框供你自行填写。</div>';
    return;
  }

  let html = '';
  blocks.forEach(block => {
    html += `<div class="ability-detail-block">
      <div class="ad-title">【${block.system}】</div>
      <div class="ad-desc">${block.desc}</div>`;
    if (block.branches.length > 0) {
      html += '<div style="margin-top:6px;">';
      block.branches.forEach(br => {
        if (BRANCH_DESC[br]) {
          html += `<div class="ad-desc" style="margin-top:3px;"><strong>${br}</strong>：${BRANCH_DESC[br]}</div>`;
        } else {
          html += `<div class="ad-custom">
            <label style="font-size:11px;color:var(--gold-dim);">「${br}」不在数据库中，请自行填写解释：</label>
            <textarea data-ability-custom="${block.system}::${br}" rows="2" placeholder="请描述「${br}」的能力详情…" style="font-size:12px;width:100%;"></textarea>
          </div>`;
        }
      });
      html += '</div>';
    }
    html += '</div>';
  });
  panel.innerHTML = html;
}

// 绑定事件
document.getElementById('royalCustomName').addEventListener('input', updateAbilityDetail);
document.addEventListener('input', function(e) {
  if (e.target.dataset.customBranch) updateAbilityDetail();
});

// ========== 图片上传（多张 + 可删除） ==========
let imageList = [];
function handleImage(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  let pending = files.length;
  const done = () => { if (--pending === 0) { renderGallery(); e.target.value = ''; } };
  files.forEach(file => {
    if (file.size > 8 * 1024 * 1024) { alert('「' + file.name + '」超过 8MB，已跳过'); done(); return; }
    const reader = new FileReader();
    reader.onload = function(ev) {
      const img = new Image();
      img.onload = function() {
        try {
          const MAX = 1000;
          let w = img.width, h = img.height;
          const scale = Math.min(1, MAX / Math.max(w, h));
          w = Math.round(w * scale); h = Math.round(h * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          imageList.push(canvas.toDataURL('image/jpeg', 0.85));
        } catch(err) {
          imageList.push(ev.target.result);
        }
        done();
      };
      img.onerror = function() { alert('「' + file.name + '」读取失败'); done(); };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}
function removeImage(i) {
  imageList.splice(i, 1);
  renderGallery();
}
function renderGallery() {
  const g = document.getElementById('imgGallery');
  if (!g) return;
  g.innerHTML = imageList.map((src, i) =>
    '<div style="position:relative;display:inline-block;">' +
      '<img src="' + src + '" style="width:84px;height:84px;object-fit:cover;border-radius:6px;border:1px solid var(--border);display:block;">' +
      (i === 0 ? '<span style="position:absolute;left:0;bottom:0;background:var(--accent);color:#fff;font-size:10px;padding:1px 6px;border-radius:0 6px 0 6px;">主图</span>' : '') +
      '<button type="button" onclick="removeImage(' + i + ')" title="删除这张" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;border:1px solid var(--border);background:var(--panel,#fff);color:var(--danger,#b3543f);cursor:pointer;font-size:12px;line-height:1;">×</button>' +
    '</div>'
  ).join('');
}

// ========== 阵营滑块 ==========
function updateSlider(slider) {
  const val = parseInt(slider.value);
  document.getElementById('sliderVal').textContent = val;
  const label = document.getElementById('factionLabel');
  if (val < 40) label.textContent = '亲近人类';
  else if (val > 60) label.textContent = '亲近妖精';
  else label.textContent = '中立';
}

// ========== 验证 ==========
function validate() {
  let ok = true;
  const err = (id, msg) => { const r = document.getElementById('row-'+id); if(r) { r.classList.add('error'); r.querySelector('.err').textContent = msg; } ok = false; };
  const clr = (id) => { const r = document.getElementById('row-'+id); if(r) { r.classList.remove('error'); r.querySelector('.err').textContent = ''; } };
  const f = document.getElementById('charForm');

  if (!f.code.value.trim()) err('code', '请输入代号'); else clr('code');
  if (!f.name.value.trim()) err('name', '请输入名字'); else clr('name');
  if (!f.gender.value) err('gender', '请选择性别'); else clr('gender');
  if (!f.species_type.value) err('species', '请选择人或妖精');
  else if (f.species_type.value === '妖精' && !f.species_detail.value.trim()) err('species', '请填写妖精种族');
  else clr('species');

  const age = parseInt(f.age.value);
  const ageLimit = rolePriv().age;
  if (!f.age.value) err('age', '请输入年龄');
  else if (isNaN(age) || age < 0) err('age', '年龄无效');
  else if (age > ageLimit) err('age', ageLimit >= 1500 ? '长老年龄上限为1500岁' : '年龄上限为450岁，成为会馆长老后可突破至1500岁');
  else clr('age');

  if (!f.appearance.value.trim() && !imageList.length) err('appearance', '请填写外貌描述或上传人设图');
  else clr('appearance');

  const royalCbs = document.querySelectorAll('input[name="ability_royal"]:checked');
  const abilityErr = document.getElementById('abilityErr');
  abilityErr.textContent = '';

  const extraSysCbs = document.querySelectorAll('input[name="extra_sys"]:checked');
  for (const cb of extraSysCbs) {
    const branchCbs = document.querySelectorAll(`input[name="ability_${cb.value}"]:checked`);
    const customInput = document.querySelector(`input[data-custom-branch="${cb.value}"]`);
    const hasCustom = (customBranches[cb.value] || []).length > 0 || (customInput && customInput.value.trim());
    if (branchCbs.length === 0 && !hasCustom && comboCountFor(cb.value) === 0) {
      abilityErr.textContent = `已选择${cb.value}，请至少选一项该系分支或填写自定义分支`; ok = false; break;
    }
  }

  if (!f.background.value.trim()) err('bg', '请填写角色背景'); else clr('bg');

  const orgVal = document.getElementById('orgPreset').value === '_custom' ? f.org.value : f.org_preset.value;
  if (!orgVal.trim()) err('org', '请选择或填写所属组织'); else clr('org');

  const weapon = getWeaponString();
  if (weapon.includes('若木')) err('weapon', '不可使用若木作为武器');
  else clr('weapon');

  return ok;
}

// ========== 收集数据 ==========
function collectData() {
  const f = document.getElementById('charForm');

  let personality = '';
  personality = document.getElementById('persInput').value.trim();

  let org = document.getElementById('orgPreset').value;
  if (org === '_custom') org = document.getElementById('orgInput').value.trim();

  const abilities = [];
  const royal = [];
  document.querySelectorAll('input[name="ability_royal"]:checked').forEach(cb => royal.push(cb.value));
  const royalCustom = document.getElementById('royalCustomName').value.trim();
  if (royalCustom) royal.push(royalCustom);
  if (royal.length > 0) abilities.push('御灵系·' + royal.join('、'));

  const extraSysCbs = document.querySelectorAll('input[name="extra_sys"]:checked');
  extraSysCbs.forEach(sysCb => {
    const sys = sysCb.value;
    const brs = [];
    document.querySelectorAll(`input[name="ability_${sys}"]:checked`).forEach(bc => brs.push(bc.value));
    (customBranches[sys] || []).forEach(b => brs.push(b));
    const customInput = document.querySelector(`input[data-custom-branch="${sys}"]`);
    if (customInput && customInput.value.trim()) brs.push(customInput.value.trim());
    if (brs.length > 0) abilities.push(sys + '·' + brs.join('、'));
  });

  const factionVal = parseInt(f.faction.value);

  // 收集能力详解中的自定义描述
  const customDetails = {};
  document.querySelectorAll('[data-ability-custom]').forEach(el => {
    if (el.value.trim()) customDetails[el.dataset.abilityCustom] = el.value.trim();
  });

  return {
    code: f.code.value.trim(),
    name: f.name.value.trim(),
    gender: f.gender.value,
    species_type: f.species_type.value,
    species_detail: f.species_detail.value.trim(),
    personality: personality,
    age: parseInt(f.age.value),
    height: f.height.value.trim(),
    likes: f.likes.value.trim(),
    dislikes: f.dislikes.value.trim(),
    food: f.food.value.trim(),
    appearance: f.appearance.value.trim(),
    image: imageList[0] || '',
    images: imageList.slice(),
    abilities: abilities,
    weapon: getWeaponString(),
    background: f.background.value.trim(),
    org: org,
    faction: factionVal,
    faction_label: factionVal < 40 ? '亲近人类' : factionVal > 60 ? '亲近妖精' : '中立',
    intro: f.intro.value.trim(),
    notes: f.notes.value.trim(),
    is_elder: !!(window.currentUser && currentUser.logged_in && (currentUser.role === 'elder' || currentUser.role === 'admin')),
    customDetails: customDetails,
    colorIndex: selectedColorIdx,
    colorPrimary: selectedColor ? selectedColor.primary : '',
    colorAccent: selectedColor ? selectedColor.accent : '',
    createdAt: new Date().toLocaleString('zh-CN')
  };
}

// ========== 角色配色（表单内选择，同步主题） ==========
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

function renderFormColorGrid() {
  const grid = document.getElementById('formColorGrid');
  if (!grid) return;
  grid.innerHTML = COLOR_SCHEMES.map((cs, i) => `
    <div class="color-card ${i === selectedColorIdx ? 'selected' : ''}" data-index="${i}" onclick="selectFormColor(${i}, this)">
      <div class="swatches">
        <div class="swatch" style="background:${cs.primary};"></div>
        <div class="swatch" style="background:${cs.accent};"></div>
      </div>
      <div class="label">${cs.name}</div>
    </div>
  `).join('');
}

function selectFormColor(idx, el) {
  document.querySelectorAll('#formColorGrid .color-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedColorIdx = idx;
  selectedColor = COLOR_SCHEMES[idx];
  applyFormTheme(selectedColor);
  tryAutoImportFromScheme(selectedColor);
}

// ========== 配色匹配已有角色 → 自动导入 ==========
function schemeCharNames(name) {
  const base = (name || '').split('·')[0].trim();
  const aliases = { '罗小黑': ['罗小黑', '小黑'], '无限': ['无限'], '三足乌馆长': ['三足乌馆长', '三足乌', '虹', '佳霖'] };
  return aliases[base] || (base ? [base] : []);
}
// 罗小黑战记官方角色设定（摘自 worldview_luoxiaohei_v4.db）
const LXH_CHARACTER_DB = {
  '罗小黑': { name: '罗小黑', code: '罗小黑，妖灵会馆·无限门下，空间系/御灵系·金，妖精', gender: '男', species_type: '妖精', species_detail: '黑猫', personality: '懵懂天真、呆萌好奇、话少但真诚、对朋友忠诚、天然呆', appearance: '黑猫形态时通体漆黑；人形态黑发（后因灵质空间被夺变为白发）青瞳，可分裂出分身黑咻', background: '森林中长大的猫妖，家园被毁后流落城市，被风息利用后又被无限救下并收为徒弟。拜师四年后奉师命盗取天明珠，被谛听打伤后被罗小白捡回家。', org: '妖灵会馆', notes: '年龄：电影1:6岁, 电影2:8岁, TV动画:10岁。能力：双灵质空间（空间系·领域已失、空间系·传送）、御灵系·金、尾巴可分裂黑咻、能听懂动物语言。', abilities: '御灵系·金；空间系·传送', ageNum: 10, height: '' },
  '无限': { name: '无限', code: '无限，妖灵会馆·最强执行者，御灵系·金/空间系·吞噬，人类', gender: '男', species_type: '人类', species_detail: '', personality: '强大可靠、面冷心热、路痴、厨艺极差（擅长生吃）', appearance: '靛蓝衣着，身高174厘米。', background: '妖灵会馆最强的执行者，曾因一人之力令城池不战而降。追捕风息时意外绑走小黑，收为徒弟。极其路痴，厨艺极差。', org: '妖灵会馆', notes: '年龄：电影1:437岁, 电影2:439岁, TV动画:441岁。能力：御灵系·金、空间系·吞噬、随身携带金属。', abilities: '御灵系·金；空间系·吞噬', ageNum: 441, height: '174cm' },
  '鹿野': { name: '鹿野', code: '鹿野，妖灵会馆·感知组组长，生灵系·寻踪，妖精（雪豹）', gender: '女', species_type: '妖精', species_detail: '雪豹', personality: '', appearance: '本体为雪豹（白毛、淡白黑瞳孔）。', background: '小黑的师姐，无限的徒弟。战争遗孤，被无限救下后拜师修炼，成为优秀执行者。有战争PTSD。', org: '妖灵会馆·感知组', notes: '能力：生灵系·寻踪/追踪，可将自身与自然融为一体追踪千里；肉身可接导弹、徒手拆战机。', abilities: '生灵系·寻踪', ageNum: '', height: '' },
  '哪吒': { name: '哪吒', code: '哪吒，妖灵会馆·创馆三神之一/总馆执行者，御灵系·火/生灵系·幻化/锁御系·灵御，妖精', gender: '男', species_type: '妖精', species_detail: '', personality: '傲娇系', appearance: '身高123厘米，青瞳（电影1）/灰瞳（电影2），青色发髻（双侧，可拆卸）。', background: '妖灵会馆总馆执行者，原是创馆三神之一（原一地妖王，后进化成神），身材矮小但实力强大。第二部成为主角团成员。', org: '妖灵会馆', notes: '年龄：电影1:3000+, TV版:3004+。能力：御灵系·火、生灵系·幻化、锁御系·灵御。', abilities: '御灵系·火；生灵系·幻化；锁御系·灵御', ageNum: 3004, height: '123cm' }
};
function fillCharacterToForm(ch) {
  const f = document.getElementById('charForm');
  const byName = (n, v) => { if (f && f[n] && v != null && v !== '') f[n].value = v; };
  const byId = (id, v) => { const el = document.getElementById(id); if (el && v != null && v !== '') el.value = v; };
  byName('code', ch.code); byName('name', ch.name);
  byName('appearance', ch.appearance); byName('background', ch.background); byName('notes', ch.notes);
  byName('height', ch.height); byId('ageInput', ch.ageNum);
  if (f.gender) { for (const r of f.gender) r.checked = false; if (ch.gender) for (const r of f.gender) if (r.value === ch.gender) r.checked = true; }
  const st = document.getElementById('speciesType');
  if (st && ch.species_type) { st.value = ch.species_type; const sd = document.getElementById('speciesDetail'); if (sd) sd.disabled = (ch.species_type !== '妖精'); byId('speciesDetail', ch.species_detail); }
  const pp = document.getElementById('persPreset'), pi = document.getElementById('persInput');
  if (pp && pi && ch.personality) { pp.value = '_custom'; pi.style.display = ''; pi.value = ch.personality; }
  const op = document.getElementById('orgPreset'), oi = document.getElementById('orgInput');
  if (op && oi && ch.org) { op.value = '_custom'; oi.style.display = ''; oi.value = ch.org; }
  autoCheckAbilities(ch.abilities);
}
// 从能力摘要文本自动勾选能力系/分支（未知分支转为自设）
function autoCheckAbilities(text) {
  if (!text) return;
  const re = /(御灵系|生灵系|造物系|空间系|心灵系|锁御系)[·・\-]([^、；;，,）)\s]+)/g;
  const royal = []; const extra = {};
  let m;
  while ((m = re.exec(text))) {
    const sys = m[1], br = m[2];
    if (sys === '御灵系') royal.push(br);
    else (extra[sys] = extra[sys] || []).push(br);
  }
  royal.forEach(br => { const cb = document.querySelector('input[name="ability_royal"][value="' + br + '"]'); if (cb) cb.checked = true; });
  Object.keys(extra).forEach(sys => { const sc = document.querySelector('input[name="extra_sys"][value="' + sys + '"]'); if (sc) sc.checked = true; });
  renderExtraBranches();
  Object.keys(extra).forEach(sys => {
    extra[sys].forEach(br => {
      const cb = document.querySelector('input[name="ability_' + sys + '"][value="' + br + '"]');
      if (cb) cb.checked = true;
      else if (!(customBranches[sys] || []).includes(br)) (customBranches[sys] = customBranches[sys] || []).push(br);
    });
    renderCustomBranchTags(sys);
  });
}
function findSavedChar(names) {
  const all = loadAll();
  for (const n of names) {
    const hit = all.find(c => c && (c.name === n || c.code === n || (c.name && n && (c.name.includes(n) || n.includes(c.name)))));
    if (hit) return hit;
  }
  return null;
}
function resetAbilities() {
  document.querySelectorAll('input[name="ability_royal"]').forEach(cb => cb.checked = false);
  document.querySelectorAll('input[name="extra_sys"]').forEach(cb => cb.checked = false);
  customBranches = {};
  extraOrder = [];
  renderExtraBranches();
}
function tryAutoImportFromScheme(scheme) {
  const toggle = document.getElementById('autoImportToggle');
  if (!toggle || !toggle.checked || !scheme) return;
  resetAbilities();
  const names = schemeCharNames(scheme.name);
  let ch = null;
  for (const n of names) { if (LXH_CHARACTER_DB[n]) { ch = LXH_CHARACTER_DB[n]; break; } }
  if (!ch) {
    const saved = findSavedChar(names);
    if (saved) {
      // 已保存角色数据最全：完整回填表单（含能力勾选、能力详解自定义描述、配色）
      fillFormFromData(saved);
      abilityNotice('已按配色「' + scheme.name + '」自动导入角色「' + (saved.name || saved.code) + '」的设定表（可关闭自动导入）。');
      return;
    }
    // 官方与本地都没有 → 尝试内置馆长设定预设（PRESET_CHARS，如三足乌·虹）
    const base = (scheme.name || '').split('·')[0].trim();
    const preset = (typeof PRESET_CHARS !== 'undefined' && PRESET_CHARS[base]) || null;
    if (!preset) return;
    fillFormFromData(preset);
    const idx = COLOR_SCHEMES.indexOf(scheme);
    if (idx >= 0) {
      selectedColorIdx = idx;
      selectedColor = scheme;
      renderFormColorGrid();
      applyFormTheme(scheme);
    }
    abilityNotice('已按配色「' + scheme.name + '」从馆长设定内置数据填入「' + (preset.name || preset.code) + '」的完整设定，确认无误后即可提交登记。');
    return;
  }
  fillCharacterToForm(ch);
  updateAbilityDetail();
  abilityNotice('已按配色「' + scheme.name + '」自动导入角色「' + (ch.name || ch.code) + '」的设定表（可关闭自动导入）。');
}

// 字体颜色自适应：保证前景色对每个背景的 WCAG 对比度均 ≥ minRatio；深底自动提亮，浅底自动压暗
function ensureContrastRatio(hex, bgHexes, minRatio) {
  const parse = h => { const x = h.replace('#', ''); return { r: parseInt(x.substring(0, 2), 16), g: parseInt(x.substring(2, 4), 16), b: parseInt(x.substring(4, 6), 16) }; };
  const lum = o => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(o.r) + 0.7152 * f(o.g) + 0.0722 * f(o.b); };
  let c = parse(hex);
  const bgs = bgHexes.map(parse);
  const minC = () => { let m = 1e9; for (let i = 0; i < bgs.length; i++) { const l1 = lum(c), l2 = lum(bgs[i]); const cr = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); if (cr < m) m = cr; } return m; };
  if (minC() >= minRatio) return hex;
  let bgAvg = 0; for (let i = 0; i < bgs.length; i++) bgAvg += lum(bgs[i]); bgAvg /= bgs.length;
  const step = lum(c) < bgAvg ? -10 : 10;
  for (let i = 0; i < 80 && minC() < minRatio; i++) {
    c.r = Math.min(255, Math.max(0, c.r + step));
    c.g = Math.min(255, Math.max(0, c.g + step));
    c.b = Math.min(255, Math.max(0, c.b + step));
  }
  return '#' + [c.r, c.g, c.b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function applyFormTheme(colors) {
  document.body.classList.add('theme-transition'); setTimeout(() => document.body.classList.remove('theme-transition'), 1000);
  const root = document.documentElement.style;
  root.setProperty('--bg', colors.primaryDark);
  root.setProperty('--surface', colors.primary);
  root.setProperty('--surface-hover', colors.primary);
  root.setProperty('--paper', colors.primaryDark);
  root.setProperty('--border', colors.line);
  // 字体颜色自适应：按当前配色的两个背景色校验对比度，不足则自动提亮/压暗，正文与中灰标题均 ≥ 4.5
  const bgList = [colors.primaryDark, colors.primary];
  const autoText = ensureContrastRatio(colors.text, bgList, 4.5);
  const autoDim = ensureContrastRatio(colors.dim, bgList, 4.5);
  root.setProperty('--text', autoText);
  root.setProperty('--text-dim', autoDim);
  // 描边/墨线自适应：浅色表面用深墨线，深色表面用提亮线，避免固定深色边框在深色主题下突兀
  const sfHex = colors.primary.replace('#', '');
  const sfLum = 0.2126 * parseInt(sfHex.substring(0, 2), 16) + 0.7152 * parseInt(sfHex.substring(2, 4), 16) + 0.0722 * parseInt(sfHex.substring(4, 6), 16);
  root.setProperty('--outline', sfLum > 140 ? '#2a3a2e' : autoDim);
  root.setProperty('--accent', colors.accent);
  root.setProperty('--accent-glow', hexToRgba(colors.accent, 0.16));
  root.setProperty('--gold', colors.accentLight);
  root.setProperty('--gold-dim', autoDim);
  // 按钮文字色自适应：accent 偏亮用深字，偏暗用白字，保证对比度
  const acc = colors.accent.replace('#', '');
  const ar = parseInt(acc.substring(0, 2), 16), ag = parseInt(acc.substring(2, 4), 16), ab = parseInt(acc.substring(4, 6), 16);
  const accLum = (0.2126 * ar + 0.7152 * ag + 0.0722 * ab);
  const btnText = accLum > 140 ? '#161823' : '#ffffff';
  root.setProperty('--btn-text', btnText);
  // hover 色：亮 accent 变深，暗 accent 变亮，避免写死粉色
  const hoverR = accLum > 140 ? Math.round(ar * 0.78) : Math.round(ar + (255 - ar) * 0.18);
  const hoverG = accLum > 140 ? Math.round(ag * 0.78) : Math.round(ag + (255 - ag) * 0.18);
  const hoverB = accLum > 140 ? Math.round(ab * 0.78) : Math.round(ab + (255 - ab) * 0.18);
  root.setProperty('--accent-hover', '#' + [hoverR, hoverG, hoverB].map(v => v.toString(16).padStart(2, '0')).join(''));
  document.body.style.backgroundImage =
    'radial-gradient(ellipse at 20% 10%, ' + hexToRgba(colors.accent, 0.10) + ' 0%, transparent 50%),' +
    'radial-gradient(ellipse at 80% 90%, ' + hexToRgba(colors.accentLight, 0.08) + ' 0%, transparent 50%)';
}

// ========== 自由选色 · 中国古色 ==========
const ANCIENT_COLORS = {金:[{h:"#D4F2E7",n:"水绿"},{h:"#E0EEE8",n:"鸭卵青"},{h:"#E0F0E9",n:"素"},{h:"#BACAC6",n:"老银"},{h:"#D2F0F4",n:"水蓝"},{h:"#D6ECF0",n:"月白"},{h:"#D3E0F3",n:"淡青"},{h:"#E3F9FD",n:"莹白"},{h:"#F0FCFF",n:"雪白"},{h:"#E9F1F6",n:"霜色"},{h:"#C2CCD0",n:"花白"},{h:"#FFFFFF",n:"精白"},{h:"#FFFBF0",n:"象牙白"},{h:"#FCEFE8",n:"鱼肚白"},{h:"#F3F9F1",n:"荼白"},{h:"#F0F0F4",n:"铅白"},{h:"#E9E7EF",n:"银白"},{h:"#F2ECDE",n:"缟"},{h:"#D4DED4",n:"青白玉"},{h:"#F5EFE0",n:"凝脂"},{h:"#EDE8DA",n:"玉色"},{h:"#EDE6D4",n:"米汤娇"},{h:"#F2ECDE",n:"缟羽"},{h:"#F0ECE0",n:"云母"},{h:"#C9C4B8",n:"佩玖"},{h:"#F0F0E8",n:"皦玉"},{h:"#E9F1F6",n:"霜地"},{h:"#F5F2E8",n:"余白"},{h:"#D4D4C8",n:"素綦"},{h:"#F0EAD8",n:"粉米"},{h:"#A8B8A8",n:"青古"},{h:"#E4E4E0",n:"浅云"},{h:"#E8E4DA",n:"素采"},{h:"#E0E8E4",n:"骨缥"},{h:"#E8E4DA",n:"明月珰"},{h:"#8E9EA8",n:"山岚"}],木:[{h:"#BCE672",n:"松花"},{h:"#4E7E5E",n:"翠樽"},{h:"#B7D332",n:"翠縹"},{h:"#2ADD9C",n:"碧绿"},{h:"#3DE1AD",n:"翡翠色"},{h:"#1BD1A5",n:"碧色"},{h:"#3EEDE7",n:"碧蓝"},{h:"#00E09E",n:"青色"},{h:"#00E079",n:"青翠"},{h:"#00E500",n:"绿色"},{h:"#40DE5A",n:"草绿"},{h:"#3E5E3E",n:"油绿"},{h:"#0AA344",n:"青葱"},{h:"#3E6E4E",n:"葱青"},{h:"#0C8918",n:"绿沉"},{h:"#21A675",n:"松柏绿"},{h:"#057748",n:"松花绿"},{h:"#7DA87B",n:"翠微"},{h:"#6C8650",n:"蔥倩"},{h:"#5E9E8C",n:"碧山"},{h:"#549688",n:"铜绿"},{h:"#80A492",n:"縹碧"},{h:"#99BCAC",n:"蒼筤"},{h:"#B1D5C8",n:"滄浪"},{h:"#88BFB8",n:"繱犗"},{h:"#48C0A3",n:"青碧"},{h:"#1685A9",n:"石青"},{h:"#7FECAD",n:"缥"},{h:"#25F8CB",n:"湖绿"},{h:"#96CE54",n:"豆青"},{h:"#9ED048",n:"豆绿"},{h:"#9ED900",n:"葱绿"},{h:"#A3D900",n:"葱黄"},{h:"#AFDD22",n:"柳绿"},{h:"#BDDD22",n:"嫩绿"},{h:"#BCE672",n:"松花色"},{h:"#A4E2C6",n:"艾绿"},{h:"#789262",n:"竹青"},{h:"#6FA88C",n:"春碧"},{h:"#D5EBE1",n:"天縹"},{h:"#C0EBD7",n:"青白"},{h:"#88ADA6",n:"水色"},{h:"#BBCDC5",n:"蟹壳青"},{h:"#425066",n:"黛蓝"},{h:"#3B2E7E",n:"藏蓝"},{h:"#065279",n:"靛蓝"},{h:"#4B5CC4",n:"宝蓝"},{h:"#003371",n:"绀青"},{h:"#177CB0",n:"靛青"},{h:"#2E4E7E",n:"藏青"},{h:"#4C8DAE",n:"群青"},{h:"#70F3FF",n:"蔚蓝"},{h:"#30DFF3",n:"湖蓝"},{h:"#44CEF6",n:"蓝"},{h:"#D1D9E0",n:"苍白"},{h:"#A1AFC9",n:"蓝灰色"},{h:"#2E3A42",n:"玄青"},{h:"#41555D",n:"黯"},{h:"#426666",n:"黛绿"},{h:"#3A6E8E",n:"曾青"},{h:"#7397AB",n:"苍黑"},{h:"#B0A4E3",n:"雪青"},{h:"#4A4266",n:"黛"},{h:"#95B37A",n:"庭芜绿"},{h:"#4E8E63",n:"翠虬"},{h:"#52A86C",n:"官绿"},{h:"#3E9B6E",n:"芰荷"},{h:"#3D6B4F",n:"绿沈"},{h:"#4C9A6A",n:"石绿"},{h:"#5FA877",n:"二绿"},{h:"#4E8D7C",n:"铜青"},{h:"#7B8F5A",n:"葱犗"},{h:"#7FB89E",n:"软翠"},{h:"#5DB88C",n:"结绿"},{h:"#3A7A5C",n:"千山翠"},{h:"#9CC4C9",n:"天缥"},{h:"#6FA5AC",n:"沧浪"},{h:"#4A8C8C",n:"苍筤"},{h:"#7EC3BE",n:"缥碧"},{h:"#8FB9C9",n:"柔蓝"},{h:"#5E95A8",n:"碧城"},{h:"#3A7A8C",n:"帝释青"},{h:"#7FA8C4",n:"窃蓝"},{h:"#6E8B9E",n:"苍苍"},{h:"#0E7A8C",n:"孔雀蓝"},{h:"#4A6B8C",n:"秋蓝"},{h:"#3B5A7E",n:"吐绶蓝"},{h:"#2C4A7E",n:"霁蓝"},{h:"#3A6E8C",n:"监德"},{h:"#A8C9D4",n:"白青"},{h:"#7A9EB8",n:"竹月"},{h:"#5A9EAE",n:"空青"},{h:"#3A5A6E",n:"太师青"},{h:"#7FA5B8",n:"井天"},{h:"#3A6E82",n:"正青"},{h:"#4A7A8E",n:"扁青"},{h:"#2C4A6E",n:"花青"},{h:"#2E4A6E",n:"佛头青"},{h:"#3A3E6E",n:"绀宇"},{h:"#3A356E",n:"绀蝶"},{h:"#3A4A5E",n:"青黛"},{h:"#4A5E6E",n:"菘蓝"},{h:"#4A6B7E",n:"青冥"},{h:"#3E6E6E",n:"青雘"},{h:"#4A7E6E",n:"青緺"},{h:"#5A8E9E",n:"青鸾"},{h:"#7EB8A8",n:"欧碧"},{h:"#6EA8B8",n:"碧落"},{h:"#4A7A9E",n:"挼蓝"},{h:"#3A4E5E",n:"青雀头黛"},{h:"#75C3B4",n:"天水碧"},{h:"#3AA8A8",n:"法翠"},{h:"#6EA8A8",n:"西子"},{h:"#8EB8AE",n:"云门"},{h:"#3A7A7E",n:"鱼师青"},{h:"#D4E4D4",n:"碧滋"},{h:"#B8C9D4",n:"星郎"},{h:"#A8B8C4",n:"晴山"},{h:"#8EA8C4",n:"品月"},{h:"#E0E4D4",n:"卵色"},{h:"#DCE4D4",n:"冰台"},{h:"#D4E0E0",n:"影青"},{h:"#3A3E4E",n:"玄天"},{h:"#3A4A5E",n:"螺青"},{h:"#5E6E8E",n:"咸池"},{h:"#5E6E7E",n:"雷雨垂"},{h:"#3A3E4E",n:"石涅"},{h:"#D4DCE4",n:"月魄"},{h:"#5E7E6E",n:"青楸"},{h:"#5E8E6E",n:"菉竹"},{h:"#7E9E7E",n:"少艾"},{h:"#8EA87E",n:"绮钱"}],水:[{h:"#424C50",n:"鸦青"},{h:"#3E4A52",n:"墨色"},{h:"#75878A",n:"苍色"},{h:"#4A4448",n:"墨灰"},{h:"#1E2028",n:"漆黑"},{h:"#665757",n:"黝黑"},{h:"#808080",n:"灰色"},{h:"#000000",n:"黑色"},{h:"#3A3030",n:"缁色"},{h:"#312520",n:"煤黑"},{h:"#3A3535",n:"黝"},{h:"#4E4A4A",n:"乌色"},{h:"#5C6E5A",n:"苍艾"},{h:"#4A5E5E",n:"螺子黛"},{h:"#8E6E8E",n:"香炉紫烟"},{h:"#6E5E5E",n:"紫瓯"},{h:"#4E3E3E",n:"黑朱"},{h:"#8E7E6E",n:"银褐"},{h:"#5E4E5E",n:"黪紫"},{h:"#5E4E5E",n:"芥拾紫"},{h:"#4E3E4E",n:"油紫"},{h:"#6E5E6E",n:"紫苑"},{h:"#4E3E4E",n:"延维"},{h:"#5E6E5E",n:"青骊"},{h:"#3E3E42",n:"墨黪"},{h:"#2E2E34",n:"驖骊"},{h:"#3A353E",n:"京元"},{h:"#6E6E6E",n:"葭灰"},{h:"#4E4A4A",n:"玄校"},{h:"#8E8E86",n:"迷楼灰"},{h:"#5E5E5E",n:"鸦雏"},{h:"#4E4A46",n:"烟墨"},{h:"#8E8478",n:"甘石"},{h:"#4E5E5E",n:"莓莓"},{h:"#5E5E4E",n:"雀梅"},{h:"#2E2A34",n:"皂色"},{h:"#4E4A4E",n:"不皂"},{h:"#8E7E6E",n:"椒房"},{h:"#8E8E7E",n:"二目鱼"},{h:"#6E8E8E",n:"渌波"}],火:[{h:"#FF2121",n:"大红"},{h:"#C3272B",n:"赤"},{h:"#E06E5E",n:"珊瑚赫"},{h:"#DC3023",n:"酡红"},{h:"#FF4C00",n:"朱红"},{h:"#FF3300",n:"炎"},{h:"#FF4E20",n:"丹"},{h:"#FF2D51",n:"火红"},{h:"#FF7500",n:"橘红"},{h:"#FF8936",n:"橘黄"},{h:"#FF8C31",n:"杏红"},{h:"#FFA631",n:"杏黄"},{h:"#FFB3A7",n:"粉红"},{h:"#FF0097",n:"洋红"},{h:"#F05654",n:"银红"},{h:"#F00056",n:"品红"},{h:"#F20C00",n:"石榴红"},{h:"#ED5736",n:"妃色"},{h:"#F35336",n:"彤"},{h:"#F47983",n:"桃红"},{h:"#EF7A82",n:"嫣红"},{h:"#C93756",n:"樱桃色"},{h:"#CB3A56",n:"茜色"},{h:"#C91F37",n:"赫赤"},{h:"#C83C23",n:"绯红"},{h:"#DB5A6B",n:"海棠红"},{h:"#BE002F",n:"殷红"},{h:"#C32136",n:"枣红"},{h:"#9D2933",n:"胭脂"},{h:"#BA5140",n:"纁黃"},{h:"#EF845D",n:"赬尾"},{h:"#EE7959",n:"縉雲"},{h:"#F0A8A0",n:"海天霞"},{h:"#F9906F",n:"酡颜"},{h:"#8E3E4E",n:"蚩尤旗"},{h:"#BA5B49",n:"赤緹"},{h:"#8E6E4E",n:"茶色"},{h:"#60281E",n:"栗色"},{h:"#955539",n:"赭色"},{h:"#E29C45",n:"黄栌"},{h:"#CA6924",n:"琥珀"},{h:"#B25D25",n:"棕色"},{h:"#8B7042",n:"流黃"},{h:"#9B4400",n:"棕红"},{h:"#7C4B00",n:"棕黑"},{h:"#E1C199",n:"赤璋"},{h:"#BFA782",n:"大塊"},{h:"#D3B17D",n:"枯黄"},{h:"#A88462",n:"驼色"},{h:"#C8B5B3",n:"蒼煙落照"},{h:"#4E4238",n:"黧"},{h:"#422517",n:"青驪"},{h:"#5F4321",n:"龍戰"},{h:"#775039",n:"栗殼"},{h:"#8C4356",n:"绛紫"},{h:"#815463",n:"紫酱"},{h:"#815476",n:"酱紫"},{h:"#8D4BBB",n:"紫色"},{h:"#801DAE",n:"青莲"},{h:"#8E4E6E",n:"茈藐"},{h:"#CCA4E3",n:"丁香色"},{h:"#E4C6D0",n:"藕荷色"},{h:"#EDD1D8",n:"藕色"},{h:"#F3C1C9",n:"水红"},{h:"#56004F",n:"紫棠"},{h:"#392F41",n:"乌黑"},{h:"#622A1D",n:"玄色"},{h:"#4C221B",n:"紫檀"},{h:"#75664D",n:"黎"},{h:"#574266",n:"黛紫"},{h:"#A98175",n:"绾"},{h:"#B36D61",n:"檀"},{h:"#F2B8C6",n:"盈盈"},{h:"#E8A8B8",n:"苏梅"},{h:"#C98AA8",n:"紫茎屏风"},{h:"#F0B4B8",n:"退红"},{h:"#F5C6D0",n:"樱花"},{h:"#F4A0A8",n:"桃夭"},{h:"#E8A09E",n:"杨妃"},{h:"#E88EA8",n:"长春"},{h:"#E07E7E",n:"牙绯"},{h:"#D4727E",n:"洛神珠"},{h:"#D45E5E",n:"红踯躅"},{h:"#E89E8E",n:"朱颜酡"},{h:"#E88E7E",n:"苕荣"},{h:"#D45E5E",n:"石榴裙"},{h:"#C94E4E",n:"小红"},{h:"#E89EA8",n:"胭脂水"},{h:"#D4726E",n:"弗肯红"},{h:"#E8A89E",n:"肉红"},{h:"#D48A9E",n:"烟红"},{h:"#D45E6E",n:"莲红"},{h:"#C99E8E",n:"藕丝秋半"},{h:"#D4624E",n:"缙云"},{h:"#E0A06E",n:"纁黄"},{h:"#C95E4E",n:"赤缇"},{h:"#C04E3E",n:"朱草"},{h:"#B84E4E",n:"綪茷"},{h:"#C03E3E",n:"顺圣"},{h:"#E87E3E",n:"黄丹"},{h:"#C94E3E",n:"丹雘"},{h:"#D46E5E",n:"水华朱"},{h:"#B83E3E",n:"朱湛"},{h:"#C04E4E",n:"大繎"},{h:"#B83E4E",n:"赩炽"},{h:"#C05E3E",n:"骍刚"},{h:"#D47E5E",n:"赪霞"},{h:"#C96E5E",n:"赪尾"},{h:"#C95E3E",n:"朱柿"},{h:"#A83E3E",n:"绛纱"},{h:"#B84E5E",n:"茹藘"},{h:"#E04E3E",n:"银朱"},{h:"#C93E3E",n:"朱樱"},{h:"#A84E4E",n:"爵头"},{h:"#A82E2E",n:"鹤顶红"},{h:"#8E2E2E",n:"朱殷"},{h:"#A83E3E",n:"鞓红"},{h:"#C96E6E",n:"美人祭"},{h:"#D48E7E",n:"縓缘"},{h:"#8E2E3E",n:"霁红"},{h:"#7E2E3E",n:"濯绛"},{h:"#9E3E4E",n:"胭脂虫"},{h:"#A83E4E",n:"红䵂"},{h:"#7E5E8E",n:"暮山紫"},{h:"#B83E4E",n:"魏红"},{h:"#7E3E5E",n:"胭脂紫"},{h:"#A84E6E",n:"赪紫"},{h:"#6E3E6E",n:"齐紫"},{h:"#5E3E5E",n:"凝夜紫"},{h:"#7E5E7E",n:"紫蒲"},{h:"#8E5E4E",n:"赭罗"},{h:"#B36D61",n:"檀色"},{h:"#8E6E4E",n:"露褐"},{h:"#7E5E3E",n:"檀褐"},{h:"#6E4E3E",n:"緅絺"},{h:"#6E4E4E",n:"石莲褐"},{h:"#8E4E2E",n:"渥赭"},{h:"#B84E3E",n:"唇脂"},{h:"#C04E3E",n:"朱孔阳"},{h:"#8E4E3E",n:"岱赭"},{h:"#8E6E5E",n:"明茶褐"},{h:"#7E5E4E",n:"荆褐"},{h:"#8E6E5E",n:"驼褐"},{h:"#6E4E3E",n:"椒褐"},{h:"#9E7E6E",n:"藕丝褐"},{h:"#5E3E4E",n:"葡萄褐"},{h:"#6E3E4E",n:"苏方"},{h:"#8E4E4E",n:"福色"},{h:"#7E5E4E",n:"丁香褐"},{h:"#8E6E5E",n:"棠梨褐"},{h:"#6E3E3E",n:"朱石栗"},{h:"#5E3E3E",n:"枣褐"},{h:"#5E4E3E",n:"珠子褐"},{h:"#6E5E4E",n:"鹰背褐"},{h:"#5E4E3E",n:"麝香褐"},{h:"#8E5E8E",n:"昌荣"},{h:"#9E6E8E",n:"紫薄汗"},{h:"#7E4E6E",n:"紫紶"},{h:"#6E3E6E",n:"琅玕紫"},{h:"#6E3E5E",n:"魏紫"},{h:"#6E3E5E",n:"紫菂"},{h:"#8E5E7E",n:"拂紫绵"},{h:"#5E3E5E",n:"三公子"},{h:"#8E5E6E",n:"夏籥"},{h:"#6E4E5E",n:"龙膏烛"},{h:"#6E3E5E",n:"紫梅"},{h:"#5E2E3E",n:"紫矿"},{h:"#4E3E5E",n:"紫府"},{h:"#6E2E3E",n:"地血"},{h:"#5E4E6E",n:"优昙瑞"},{h:"#5E3E4E",n:"紫诰"},{h:"#C9A05E",n:"流黄"},{h:"#8E6E4E",n:"栗壳"},{h:"#E8A03E",n:"栀子"},{h:"#B88E4E",n:"缊韨"},{h:"#E8C9A8",n:"韶粉"},{h:"#B88E4E",n:"韎韐"},{h:"#C98E4E",n:"田赤"},{h:"#E8DCC8",n:"绢纨"},{h:"#8E6E5E",n:"伽罗"},{h:"#B83E2E",n:"大赤"},{h:"#8E6E3E",n:"蜜褐"},{h:"#7E6E5E",n:"紫花布"},{h:"#6E5E4E",n:"沉香"},{h:"#E0D4C0",n:"香皮"},{h:"#D4C9B8",n:"绞衣"},{h:"#A87E6E",n:"红友"},{h:"#B84E3E",n:"光明砂"},{h:"#8E7E9E",n:"夕岚"},{h:"#A87E8E",n:"雌霓"},{h:"#C9A87E",n:"沙饧"}],土:[{h:"#FFA400",n:"橙黄"},{h:"#F0C239",n:"缃色"},{h:"#ECD452",n:"緗葉"},{h:"#FFF143",n:"鹅黄"},{h:"#FFF799",n:"黃白游"},{h:"#EAFF56",n:"樱草色"},{h:"#FAFF72",n:"鸭黄"},{h:"#D9B611",n:"秋香色"},{h:"#C89B40",n:"昏黄"},{h:"#E8A320",n:"姜黄"},{h:"#EACD76",n:"金色"},{h:"#F2BE45",n:"赤金"},{h:"#A78E44",n:"乌金"},{h:"#896C39",n:"秋色"},{h:"#AE7000",n:"棕黄"},{h:"#827100",n:"棕绿"},{h:"#EEDEB0",n:"牙色"},{h:"#B6A014",n:"蒼黃"},{h:"#D9D6C8",n:"草白"},{h:"#A9A773",n:"出岫"},{h:"#C9B87E",n:"苍黄"},{h:"#C9DD22",n:"柳黄"},{h:"#A29B7C",n:"苍青"},{h:"#6E511E",n:"褐色"},{h:"#FFD98E",n:"半见"},{h:"#F2C94C",n:"缃叶"},{h:"#A8A878",n:"麹尘"},{h:"#8E9B4A",n:"女贞黄"},{h:"#B89E6E",n:"黄埃"},{h:"#9E8E6E",n:"老僧衣"},{h:"#C9A03E",n:"紫磨金"},{h:"#F5E6C8",n:"黄白游"},{h:"#D4B85E",n:"黄栗留"},{h:"#C9A85E",n:"黄不老"},{h:"#D4A83E",n:"枳黄"},{h:"#F0D48E",n:"嫩鹅黄"},{h:"#E8C45E",n:"鞠衣"},{h:"#E8B83E",n:"郁金裙"},{h:"#D4A83E",n:"黄流"},{h:"#E0B85E",n:"芸黄"},{h:"#E8C43E",n:"雌黄"},{h:"#EDE0B8",n:"缣缃"},{h:"#EDE0C0",n:"黄润"},{h:"#E8D48E",n:"蒸栗"},{h:"#D4B86E",n:"射干"},{h:"#B89E5E",n:"油葫芦"},{h:"#D4B87E",n:"黄粱"},{h:"#A89E5E",n:"龙战"},{h:"#D4A03E",n:"黄河琉璃"},{h:"#C9A03E",n:"库金"},{h:"#E0B85E",n:"吉量"},{h:"#D4A83E",n:"金埒"},{h:"#D4A03E",n:"九斤黄"},{h:"#E8B85E",n:"杏子"},{h:"#E0A83E",n:"媚蝶"},{h:"#E0B83E",n:"姚黄"},{h:"#E8C45E",n:"蛾黄"},{h:"#D4A83E",n:"黄封"},{h:"#D4B83E",n:"莺儿"},{h:"#B89E5E",n:"禹余粮"},{h:"#C9A03E",n:"黄琮"},{h:"#A89E5E",n:"秋香"},{h:"#8E7E4E",n:"太一余粮"},{h:"#B89E6E",n:"老茯神"},{h:"#A89E6E",n:"桑蕾"},{h:"#C9A03E",n:"栾华"},{h:"#C9A03E",n:"佛赤"},{h:"#D4B87E",n:"蜜合"},{h:"#A89E6E",n:"假山南"},{h:"#E8E4D4",n:"兰苕"},{h:"#D4D4B8",n:"葭菼"},{h:"#E0DCC8",n:"逍遥游"},{h:"#E8E4D8",n:"石英"},{h:"#7E7E5E",n:"綟绶"},{h:"#E0D8C4",n:"扶光"},{h:"#E0DCD0",n:"山矾"},{h:"#E0DCC8",n:"玉頩"},{h:"#D4B87E",n:"石蜜"},{h:"#A89E7E",n:"巨吕"},{h:"#B89E4E",n:"吉金"}]};

let customPrimary = null, customAccent = null, activeSlot = 'primary', currentCat = '木';
let ancientQuery = '';

function setActiveSlot(slot) {
  activeSlot = slot;
  document.getElementById('slotPrimary').classList.toggle('active', slot === 'primary');
  document.getElementById('slotAccent').classList.toggle('active', slot === 'accent');
}

const ELEMENT_TABS = [{k:'金',c:'白'},{k:'木',c:'青'},{k:'水',c:'黑'},{k:'火',c:'赤'},{k:'土',c:'黄'}];
const FIVECHAR_TO_ELEM = {'白':'金','青':'木','黑':'水','赤':'火','黄':'土'};

function renderSwatchGrid() {
  const grid = document.getElementById('swatchGrid');
  let list;
  const q = ancientQuery;
  if (q) {
    list = [];
    const elemKey = FIVECHAR_TO_ELEM[q] || q;
    for (const k in ANCIENT_COLORS) {
      ANCIENT_COLORS[k].forEach(c => {
        if (c.n.includes(q) || k === elemKey || k.includes(q)) list.push(c);
      });
    }
  } else {
    list = ANCIENT_COLORS[currentCat] || [];
  }
  grid.innerHTML = list.map(c => {
    let cls = '';
    if (customPrimary && customPrimary.hex === c.h) cls = 'picked-primary';
    if (customAccent && customAccent.hex === c.h) cls = 'picked-accent';
    return '<div class="swatch-item ' + cls + '" onclick="pickCustomColor(\'' + c.h + '\',\'' + c.n + '\')"><div class="sw-box" style="background:' + c.h + '"></div><div class="sw-name">' + c.n + '</div></div>';
  }).join('');
}

function onAncientSearch(v) {
  ancientQuery = (v || '').trim();
  renderSwatchGrid();
}

function renderColorTabs() {
  const tabs = document.getElementById('colorTabs');
  tabs.innerHTML = ELEMENT_TABS.map(t =>
    '<button class="color-tab' + (t.k === currentCat ? ' active' : '') + '" onclick="switchCat(\'' + t.k + '\')">' + t.k + '·' + t.c + '</button>'
  ).join('');
}

function switchCat(cat) {
  currentCat = cat;
  ancientQuery = '';
  const si = document.getElementById('ancientSearch');
  if (si) si.value = '';
  renderColorTabs();
  renderSwatchGrid();
}

function pickCustomColor(hex, name) {
  if (activeSlot === 'primary') {
    customPrimary = { hex, name };
    document.getElementById('slotPrimarySwatch').style.background = hex;
    document.getElementById('slotPrimarySwatch').classList.add('filled');
    document.getElementById('slotPrimaryName').textContent = name;
    activeSlot = 'accent';
    setActiveSlot('accent');
  } else {
    customAccent = { hex, name };
    document.getElementById('slotAccentSwatch').style.background = hex;
    document.getElementById('slotAccentSwatch').classList.add('filled');
    document.getElementById('slotAccentName').textContent = name;
  }
  if (customPrimary && customAccent) {
    document.getElementById('applyCustomBtn').disabled = false;
  }
  renderSwatchGrid();
}

function buildCustomTheme(primaryHex, accentHex) {
  const darken = (h, f) => { var r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16); return '#'+('0'+Math.round(r*f).toString(16)).slice(-2)+('0'+Math.round(g*f).toString(16)).slice(-2)+('0'+Math.round(b*f).toString(16)).slice(-2); };
  const lighten = (h, f) => { var r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16); return '#'+('0'+Math.round(r+(255-r)*f).toString(16)).slice(-2)+('0'+Math.round(g+(255-g)*f).toString(16)).slice(-2)+('0'+Math.round(b+(255-b)*f).toString(16)).slice(-2); };
  var pr=parseInt(primaryHex.slice(1,3),16),pg=parseInt(primaryHex.slice(3,5),16),pb=parseInt(primaryHex.slice(5,7),16);
  var tr=Math.min(255,Math.round(pr*0.18)+20),tg=Math.min(255,Math.round(pg*0.18)+18),tb=Math.min(255,Math.round(pb*0.18)+22);
  var dr=Math.min(255,Math.round(pr*0.4)+70),dg=Math.min(255,Math.round(pg*0.4)+66),db=Math.min(255,Math.round(pb*0.4)+72);
  return {
    name: (customPrimary?customPrimary.name:'自选')+'×'+(customAccent?customAccent.name:'自选'),
    primary: primaryHex, primaryDark: darken(primaryHex,0.6),
    accent: accentHex, accentLight: lighten(accentHex,0.5), accentPale: lighten(accentHex,0.7),
    text: '#'+('0'+tr.toString(16)).slice(-2)+('0'+tg.toString(16)).slice(-2)+('0'+tb.toString(16)).slice(-2),
    dim: '#'+('0'+dr.toString(16)).slice(-2)+('0'+dg.toString(16)).slice(-2)+('0'+db.toString(16)).slice(-2),
    line: 'rgba('+parseInt(accentHex.slice(1,3),16)+','+parseInt(accentHex.slice(3,5),16)+','+parseInt(accentHex.slice(5,7),16)+',0.25)'
  };
}

function applyCustomTheme() {
  if (!customPrimary || !customAccent) return;
  selectedColor = buildCustomTheme(customPrimary.hex, customAccent.hex);
  selectedColorIdx = -1;
  document.querySelectorAll('#formColorGrid .color-card').forEach(c => c.classList.remove('selected'));
  applyFormTheme(selectedColor);
}

function initCustomPicker() {
  renderColorTabs();
  renderSwatchGrid();
}

// ========== 颜色选择弹窗 ==========
function renderColorGrid() {
  const grid = document.getElementById('colorGrid');
  selectedColor = null;
  document.getElementById('btnConfirmColor').disabled = true;
  grid.innerHTML = COLOR_SCHEMES.map((cs, i) => `
    <div class="color-card" data-index="${i}" onclick="selectColor(${i}, this)">
      <div class="swatches">
        <div class="swatch" style="background:${cs.primary};"></div>
        <div class="swatch" style="background:${cs.accent};"></div>
      </div>
      <div class="label">${cs.name}</div>
    </div>
  `).join('');
}

function selectColor(idx, el) {
  document.querySelectorAll('.color-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedColor = COLOR_SCHEMES[idx];
  document.getElementById('btnConfirmColor').disabled = false;
}

function closeColorModal() {
  document.getElementById('colorModal').classList.remove('active');
  pendingData = null;
}

function confirmColor() {
  if (!selectedColor || !pendingData) return;
  document.getElementById('colorModal').classList.remove('active');
  generateAndSave(pendingData, selectedColor);
}

// ========== 生成展示页 HTML ==========
function generateShowcaseHTML(data, _colors) {
  // 深拷贝，避免修改原 COLOR_SCHEMES 影响表单页
  const colors = JSON.parse(JSON.stringify(_colors));
  // raw：未做乳白亮度适配的原始配色，供"角色配色"主题使用
  const raw = JSON.parse(JSON.stringify(_colors));
  // 亮 accent 自适应：gold-light / gold-pale 压暗以防文字看不清
  (() => {
    const r = parseInt(colors.accent.slice(1,3),16);
    const g = parseInt(colors.accent.slice(3,5),16);
    const b = parseInt(colors.accent.slice(5,7),16);
    const lum = 0.2126*r + 0.7152*g + 0.0722*b;
    if (lum > 140) {
      const f = Math.max(0.3, 1 - (lum - 140) / 200);
      const d = c => Math.round(c * f), h = v => v.toString(16).padStart(2,'0');
      colors.accentLight = '#' + h(d(r)) + h(d(g)) + h(d(b));
      colors.accentPale  = '#' + h(Math.round(d(r)*0.55)) + h(Math.round(d(g)*0.55)) + h(Math.round(d(b)*0.55));
    }
  })();
  // 展示页深色背景自适应：text/dim 太暗时提亮
  (() => {
    const r = parseInt(colors.text.slice(1,3),16);
    const g = parseInt(colors.text.slice(3,5),16);
    const b = parseInt(colors.text.slice(5,7),16);
    const lum = 0.2126*r + 0.7152*g + 0.0722*b;
    if (lum < 100) {
      const f = Math.min(3, 120 / Math.max(lum, 20));
      const d = c => Math.min(255, Math.round(c * f));
      const h = v => v.toString(16).padStart(2,'0');
      colors.text = '#' + h(d(r)) + h(d(g)) + h(d(b));
      const rd = parseInt(colors.dim.slice(1,3),16);
      const gd = parseInt(colors.dim.slice(3,5),16);
      const bd = parseInt(colors.dim.slice(5,7),16);
      colors.dim = '#' + h(Math.round(rd*f)) + h(Math.round(gd*f)) + h(Math.round(bd*f));
    }
  })();
  // 角色主题混色：以 primaryDark 为底，混入 primary / text 得到卡片、纸面与描边色
  const mixHex = (a, b, t) => {
    const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
    const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
    return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
  };
  const tSurface = mixHex(raw.primaryDark, raw.primary, 0.16);
  const tPaper = mixHex(raw.primaryDark, raw.primary, 0.30);
  const tOutline = mixHex(raw.primaryDark, colors.text, 0.42);
  const abilityTags = data.abilities.map(a => a.split('·')[0]).filter((v, i, arr) => arr.indexOf(v) === i);
  const abilityCards = data.abilities.map(a => {
    const parts = a.split('·');
    const system = parts[0];
    const branch = parts.slice(1).join('、');
    return { system, branch, desc: ABILITY_DESC[system] || '' };
  });

  // 能力详解
  const detailBlocks = data.abilities.map(a => {
    const parts = a.split('·');
    const system = parts[0];
    const branches = parts.slice(1).join('、').split('、');
    const branchDetails = branches.map(b => {
      const key = `${system}::${b}`;
      if (data.customDetails && data.customDetails[key]) return { branch: b, desc: data.customDetails[key], custom: true };
      if (BRANCH_DESC[b]) return { branch: b, desc: BRANCH_DESC[b], custom: false };
      return { branch: b, desc: '（用户自定义能力）', custom: true };
    });
    return { system, desc: ABILITY_DESC[system] || '', branches: branchDetails };
  });

  const eggItems = [];
  if (data.intro) eggItems.push({ title: '个人介绍', content: data.intro });
  if (data.notes) eggItems.push({ title: '备注', content: data.notes });
  if (data.is_elder) eggItems.push({ title: '会馆长老', content: '已申请成为会馆长老，享有突破年龄上限等特殊权限。' });
  if (data.weapon) eggItems.push({ title: '武器/法宝', content: data.weapon });

  const eggHTML = eggItems.length > 0 ? `
    <details class="egg reveal">
      <summary>点击展开补充设定</summary>
      <div class="egg-body">
        ${eggItems.map((ei, i) => `<div class="egg-item"><h4><span class="egg-num">${String(i+1).padStart(2,'0')}</span>${ei.title}</h4><p>${escapeHtml(ei.content)}</p></div>`).join('')}
      </div>
    </details>` : '';

  const abilityCardsHTML = abilityCards.map(ac => `
    <div class="ability-card">
      <span class="a-badge">${escapeHtml(ac.system)}</span>
      <span class="a-name">${escapeHtml(ac.branch)}</span>
      <span class="a-desc">${escapeHtml(ac.desc.substring(0, 50))}…</span>
    </div>
  `).join('');

  const detailHTML = detailBlocks.map(db => `
    <div class="egg-item">
      <h4><span class="egg-num">${escapeHtml(db.system)}</span></h4>
      <p>${escapeHtml(db.desc)}</p>
      ${db.branches.map(b => `<p style="margin-left:12px;font-size:13px;"><strong>${escapeHtml(b.branch)}</strong>：${escapeHtml(b.desc)}</p>`).join('')}
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=LXGW+WenKai:wght@300;400;700&family=Noto+Serif+SC:wght@300;400;600&display=swap" rel="stylesheet">
<title>${escapeHtml(data.code)} | 人设表</title>
<style>
:root {
  --bg: ${raw.primaryDark};
  --paper: ${tPaper};
  --surface: ${tSurface};
  --ink: ${colors.text};
  --text: ${colors.text};
  --dim: ${colors.dim};
  --accent: ${raw.accent};
  --accent2: ${raw.accentLight};
  --green: ${raw.accentLight};
  --gold: ${raw.accentLight};
  --border: ${raw.line};
  --outline: ${tOutline};
  --line: ${raw.line};
}
:root[data-theme="cream"] {
  --bg: #f5f0e8;
  --paper: #faf8f0;
  --surface: #ffffff;
  --ink: #2a3a2e;
  --text: #3a4a3e;
  --dim: #8a9a8e;
  --accent: ${colors.accent};
  --accent2: #e89070;
  --green: #7ab648;
  --gold: #d4a840;
  --border: #d4cfbe;
  --outline: #2a3a2e;
  --line: rgba(42, 58, 46, 0.15);
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: "LXGW WenKai", "Noto Serif SC", "Microsoft YaHei", "PingFang SC", sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.8;
  padding: 16px 10px;
  position: relative;
  min-height: 100vh;
}
body::before {
  content: "";
  position: fixed; inset: 0;
  pointer-events: none; z-index: 0;
  opacity: 0.03;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
}
#ink-canvas {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  z-index: 0; pointer-events: none;
}
.page {
  position: relative; z-index: 1; max-width: 1100px; margin: 0 auto;
  background: var(--surface);
  border: 2.5px solid var(--outline);
  border-radius: 8px;
  overflow: hidden;
}
.header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 20px; background: var(--paper);
  color: var(--ink); font-size: 12.5px; letter-spacing: 2px;
  border-bottom: 2px solid var(--outline);
}
.header .right { opacity: 0.7; }
#themeToggle {
  margin-left: 10px; font-family: inherit; font-size: 11px; letter-spacing: 1px;
  color: var(--ink); background: transparent; border: 1px solid var(--outline);
  border-radius: 4px; padding: 2px 9px; cursor: pointer; transition: all 0.25s;
  vertical-align: 1px; opacity: 1;
}
#themeToggle:hover { border-color: var(--accent); color: var(--accent); }
.hero {
  text-align: center; padding: 36px 18px 26px;
  border-bottom: 2px solid var(--outline);
  animation: fadeUp 0.8s ease-out both;
  position: relative;
  background: linear-gradient(180deg, var(--paper) 0%, var(--surface) 100%);
}
.hero h1 {
  font-size: 34px; letter-spacing: 8px; color: var(--ink);
  margin-bottom: 6px; font-weight: 700;
}
.hero .sub { font-size: 13px; letter-spacing: 4px; color: var(--dim); }
.hero .tags { margin-top: 10px; display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
.hero .tags span {
  font-size: 12px; border: 2px solid var(--outline); border-radius: 4px;
  padding: 3px 12px; color: var(--ink); background: var(--paper);
  transition: all 0.3s; font-weight: 600; letter-spacing: 1px;
}
.hero .tags span:hover { border-color: var(--accent); background: rgba(90, 158, 143, 0.1); color: var(--accent); }
.content { padding: 20px 28px 28px; }
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}
.reveal { animation: fadeUp 0.7s ease-out both; animation-play-state: paused; }
.reveal.visible { animation-play-state: running; }
h2 {
  font-size: 17px; color: var(--ink); letter-spacing: 2px;
  margin: 24px 0 12px; padding-left: 12px; border-left: 4px solid var(--accent);
  font-weight: 700;
}
p { font-size: 14.5px; margin-bottom: 8px; }
.table-wrapper { overflow-x: auto; }
table {
  width: 100%; border-collapse: collapse; font-size: 14px;
  background: var(--surface); border: 2px solid var(--outline);
}
thead th {
  background: var(--paper); color: var(--ink); font-weight: 700;
  letter-spacing: 2px; padding: 9px 14px; text-align: left;
  border-bottom: 2px solid var(--outline); white-space: nowrap;
}
td {
  padding: 9px 14px; border-bottom: 1px solid var(--line);
  vertical-align: top; transition: background 0.25s;
}
td.f { color: var(--ink); font-weight: 700; white-space: nowrap; }
tbody tr:nth-child(even) { background: rgba(90, 158, 143, 0.04); }
tbody tr:last-child td { border-bottom: none; }
tbody tr:hover td { background: rgba(90, 158, 143, 0.08); }
ul, ol { margin: 4px 0 10px 1.5em; }
li { font-size: 14px; margin-bottom: 5px; }
ul li::marker { color: var(--accent); }
ol li::marker { color: var(--accent); font-weight: 700; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0 28px; }
.ability-cards {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px; margin: 8px 0 10px;
}
.ability-card {
  background: var(--paper); border: 2px solid var(--outline);
  border-radius: 6px; padding: 14px 16px; transition: all 0.3s ease;
}
.ability-card:hover { border-color: var(--accent); transform: translateY(-3px); }
.ability-card .a-badge {
  display: inline-block; font-size: 11px; letter-spacing: 1px;
  color: #fff; background: var(--accent);
  border: none; border-radius: 3px; padding: 2px 8px; margin-bottom: 6px;
}
.ability-card .a-name {
  display: block; color: var(--ink); font-weight: 700;
  letter-spacing: 1px; font-size: 15px; margin-bottom: 4px;
}
.ability-card .a-desc { font-size: 13.5px; color: var(--dim); line-height: 1.5; }
.weapon-line {
  display: flex; align-items: center; gap: 10px; padding: 10px 14px;
  background: var(--paper); border: 2px solid var(--outline);
  border-radius: 6px; margin: 8px 0; transition: all 0.3s;
}
.weapon-line:hover { border-color: var(--accent); }
.weapon-line strong { color: var(--ink); letter-spacing: 1px; white-space: nowrap; }
.chart-placeholder {
  margin: 10px 0 6px; border: 2px dashed var(--border);
  border-radius: 6px; padding: 10px 16px; font-size: 13px;
  color: var(--dim); letter-spacing: 1px;
}
.chart-placeholder ul { display: inline-flex; flex-wrap: wrap; gap: 2px 20px; margin: 0 0 0 6px; padding: 0; list-style: none; }
.chart-placeholder li { margin: 0; }
details.egg {
  border: 2px solid var(--outline); border-radius: 6px;
  margin: 8px 0 4px; background: var(--paper); transition: all 0.3s;
}
details.egg:hover { border-color: var(--accent); }
details.egg > summary {
  cursor: pointer; list-style: none; display: flex; align-items: center; gap: 8px;
  padding: 11px 14px; font-weight: 700; letter-spacing: 1px;
  color: var(--ink); user-select: none; font-size: 14.5px;
}
details.egg > summary::-webkit-details-marker { display: none; }
details.egg > summary::before { content: "\\2726"; color: var(--accent); font-size: 14px; }
details.egg > summary::after { content: "\\25BE"; margin-left: auto; color: var(--accent); transition: transform 0.3s; }
details.egg[open] > summary::after { transform: rotate(180deg); }
.egg-body { padding: 2px 16px 14px; }
.egg-item { padding: 8px 0; border-top: 1px dashed var(--border); }
.egg-item:first-child { border-top: none; }
.egg-item h4 { display: flex; align-items: baseline; gap: 8px; font-size: 14px; color: var(--ink); letter-spacing: 1px; margin-bottom: 3px; }
.egg-item h4 .egg-num { color: var(--accent); font-weight: 800; font-size: 12px; }
.egg-item p { text-indent: 0; font-size: 13.5px; margin-bottom: 0; }
.footer {
  text-align: center; padding: 10px; font-size: 12px; color: var(--dim);
  border-top: 2px solid var(--outline); letter-spacing: 2px;
  background: var(--paper);
}
.site-nav {
  display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;
  padding: 14px 16px; border-top: 2px solid var(--outline);
  background: var(--paper);
}
.site-nav a {
  font-size: 12.5px; letter-spacing: 1px; color: var(--ink);
  text-decoration: none; border: 2px solid var(--outline);
  border-radius: 4px; padding: 4px 14px; transition: all 0.2s ease;
  font-weight: 600;
}
.site-nav a:hover { border-color: var(--accent); color: var(--accent); background: rgba(90, 158, 143, 0.06); }
.site-nav a.current { background: var(--accent); border-color: var(--accent); color: #fff; cursor: default; }
.leaf-particle {
  position: fixed; width: 8px; height: 12px;
  background: var(--outline);
  border-radius: 0 50% 50% 50%; opacity: 0;
  z-index: 0; pointer-events: none; animation: leafDrift linear infinite;
}
.leaf-particle:nth-child(1) { left: 15%; animation-duration: 16s; animation-delay: -3s; }
.leaf-particle:nth-child(2) { left: 38%; animation-duration: 20s; animation-delay: -8s; width: 6px; height: 10px; }
.leaf-particle:nth-child(3) { left: 62%; animation-duration: 18s; animation-delay: -12s; }
.leaf-particle:nth-child(4) { left: 82%; animation-duration: 22s; animation-delay: -5s; width: 7px; height: 11px; }
.leaf-particle:nth-child(5) { left: 48%; animation-duration: 24s; animation-delay: -16s; }
@keyframes leafDrift {
  0%   { top: -5%; opacity: 0; transform: rotate(0deg) translateX(0); }
  15%  { opacity: 0.08; }
  50%  { transform: rotate(180deg) translateX(35px); opacity: 0.1; }
  100% { top: 105%; opacity: 0; transform: rotate(360deg) translateX(-25px); }
}
@media (max-width: 640px) {
  body { padding: 8px 5px; }
  .header { padding: 8px 12px; font-size: 11px; }
  .hero { padding: 22px 12px 16px; }
  .hero h1 { font-size: 26px; letter-spacing: 4px; }
  .content { padding: 16px 16px 20px; }
  .two-col { grid-template-columns: 1fr; }
  .ability-cards { grid-template-columns: 1fr; }
  h2 { font-size: 15.5px; }
  p, li { font-size: 13.5px; }
  td, thead th { font-size: 12.5px; padding: 7px 10px; }
  td.f { white-space: normal; }
}
@media print {
  body { background: #fff; color: #333; padding: 0; }
  #ink-canvas { display: none; }
  .page { border: 1px solid #ccc; border-radius: 0; background: #fff; }
  .header, thead th { background: #f5f0e8 !important; color: #333; }
  .hero h1 { color: #333; }
  h2 { border-color: #5a9e8f; color: #333; }
  details.egg { border-color: #bbb; background: #fff; }
  table, tbody tr:nth-child(even) { background: #fff !important; }
  .footer { background: #fff; color: #666; }
  .reveal { animation: none; opacity: 1; transform: none; }
}
body.theme-transition, body.theme-transition * { transition: background-color 0.9s ease, color 0.9s ease, border-color 0.9s ease, box-shadow 0.9s ease; }
</style>
</head>
<body>
<canvas id="ink-canvas"></canvas>
<div class="leaf-particles">
  <div class="leaf-particle"></div><div class="leaf-particle"></div>
  <div class="leaf-particle"></div><div class="leaf-particle"></div>
  <div class="leaf-particle"></div>
</div>
<div class="page">
  <div class="header">
    <span class="left">西木会馆 · 人设登记</span>
    <span class="right">${escapeHtml(data.org)} · ${escapeHtml(data.faction_label)}<button id="themeToggle" type="button" title="切换 角色配色 / 会馆乳白">☾ 会馆乳白</button></span>
  </div>
  <div class="hero">
    <h1>${escapeHtml(data.code)} · ${escapeHtml(data.name)}</h1>
    <div class="sub">${escapeHtml(data.species_type)}${data.species_detail ? '（' + escapeHtml(data.species_detail) + '）' : ''}${data.is_elder ? ' · 会馆长老' : ''}</div>
    <div class="tags">
      ${abilityTags.map(t => `<span>${escapeHtml(t)}</span>`).join('')}
    </div>
  </div>
  ${(() => {
    const imgs = (data.images && data.images.length) ? data.images : (data.image ? [data.image] : []);
    if (!imgs.length) return '';
    return '<div class="reveal" style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start;margin:16px 4px;">' +
      imgs.map((src, i) => '<img src="' + src + '" alt="" style="width:' + (i === 0 ? 180 : 96) + 'px;height:' + (i === 0 ? 180 : 96) + 'px;object-fit:cover;border-radius:10px;border:1px solid rgba(0,0,0,.15);">').join('') +
      '</div>';
  })()}
  <div class="content">
    <h2 class="reveal">一、基本档案</h2>
    <div class="table-wrapper reveal">
      <table>
        <thead><tr><th>项目</th><th>内容</th><th>项目</th><th>内容</th></tr></thead>
        <tbody>
          <tr><td class="f">性别</td><td>${escapeHtml(data.gender)}</td><td class="f">年龄</td><td>${data.age}岁</td></tr>
          <tr><td class="f">物种</td><td>${escapeHtml(data.species_type)}${data.species_detail ? '（' + escapeHtml(data.species_detail) + '）' : ''}</td><td class="f">身高</td><td>${escapeHtml(data.height || '—')}</td></tr>
          <tr><td class="f">所属</td><td>${escapeHtml(data.org)}</td><td class="f">阵营</td><td>${escapeHtml(data.faction_label)}</td></tr>
          ${data.food ? `<tr><td class="f">食物</td><td>${escapeHtml(data.food)}</td><td class="f">备注</td><td>${escapeHtml(data.notes || '无')}</td></tr>` : ''}
        </tbody>
      </table>
    </div>
    ${data.personality || data.likes || data.dislikes ? `
    <h2 class="reveal">二、性格与喜好</h2>
    <div class="reveal">
      ${data.personality ? `<p>${escapeHtml(data.personality)}</p>` : ''}
      ${data.likes || data.dislikes ? `<p>${data.likes ? '<strong>喜欢</strong>：' + escapeHtml(data.likes) : ''}${data.likes && data.dislikes ? ' ｜ ' : ''}${data.dislikes ? '<strong>讨厌</strong>：' + escapeHtml(data.dislikes) : ''}</p>` : ''}
    </div>` : ''}
    ${data.appearance ? `
    <h2 class="reveal">三、外貌与衣着</h2>
    <div class="reveal"><p>${escapeHtml(data.appearance)}</p></div>` : ''}
    <h2 class="reveal">四、能力与武器/法宝</h2>
    <div class="ability-cards reveal">
      ${abilityCardsHTML}
    </div>
    ${data.weapon ? `<div class="weapon-line reveal"><strong>武器/法宝</strong><span>${escapeHtml(data.weapon)}</span></div>` : ''}
    <div class="chart-placeholder reveal">能力一览：
      <ul>${data.abilities.map(a => `<li>${escapeHtml(a)}</li>`).join('')}</ul>
    </div>
    ${data.background ? `
    <h2 class="reveal">五、背景与个人介绍</h2>
    <div class="reveal"><p>${escapeHtml(data.background)}</p></div>` : ''}
    ${detailHTML ? `
    <h2 class="reveal">六、能力详解</h2>
    <details class="egg reveal" open>
      <summary>展开所有能力详解</summary>
      <div class="egg-body">${detailHTML}</div>
    </details>` : ''}
    ${eggHTML ? `
    <h2 class="reveal">七、补充设定</h2>
    ${eggHTML}` : ''}
  </div>
  <nav class="site-nav">
    <a href="https://huiguan.iridescently.xyz/">会馆首页</a>
    <a href="https://huiguan.iridescently.xyz/index.html">人设登记</a>
    <a href="#" class="current">${escapeHtml(data.code)}</a>
  </nav>
  <div class="footer">第 1 页，共 1 页 · ${escapeHtml(data.code)} · ${escapeHtml(data.name)}</div>
</div>
<!-- 版权与免责声明 -->
<style>
.ip-footer {
  margin-top: 48px; padding: 16px 16px 28px;
  border-top: 1px solid rgba(128,128,128,0.35);
  text-align: center; font-size: 12px; letter-spacing: 1px;
  color: inherit; opacity: 0.78; line-height: 1.9;
}
.ip-footer details { display: inline-block; }
.ip-footer details[open] { display: block; }
.ip-footer:has(details[open]) .ip-dot { display: none; }
.ip-footer summary {
  cursor: pointer; display: inline; user-select: none;
  text-decoration: underline dotted;
}
.ip-footer summary::-webkit-details-marker { display: none; }
.ip-footer .ip-disclaimer {
  max-width: 680px; margin: 8px auto 0; text-align: left; line-height: 1.9;
}
</style>
<footer class="ip-footer">
  <span>罗小黑战记相关 IP 版权归寒木春华动画工作室所有</span>
  <span aria-hidden="true" class="ip-dot"> · </span>
  <details><summary>免责声明</summary>
    <p class="ip-disclaimer">本站为非商业性粉丝社区项目，仅为用户提供信息交流与身份认证服务。所有涉及"罗小黑战记"及相关角色、形象、作品的内容，其著作权、商标权等知识产权均归原作者及寒木春华动画工作室所有。本站未获官方授权，如有侵权请联系管理员删除。</p>
  </details>
</footer>
<script>
(function () {
  var c = document.getElementById('ink-canvas'), ctx = c.getContext('2d');
  var w, h, dots = [], MAX = 40;
  var inkRGB = [42, 58, 46];
  function readInk() {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
      if (v.charAt(0) === '#' && v.length === 7) {
        inkRGB = [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)];
      }
    } catch (e) {}
  }
  readInk();
  window.addEventListener('lhx-theme-change', readInk);
  function resize() { w = c.width = window.innerWidth; h = c.height = window.innerHeight; }
  resize(); window.addEventListener('resize', resize);
  for (var i = 0; i < MAX; i++) {
    dots.push({
      x: Math.random() * w, y: Math.random() * h,
      r: Math.random() * 1.8 + 0.4,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.1 - 0.03,
      o: Math.random() * 0.08 + 0.02,
      phase: Math.random() * Math.PI * 2,
      speed: 0.002 + Math.random() * 0.005
    });
  }
  (function draw() {
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      d.phase += d.speed;
      d.x += d.vx + Math.sin(d.phase) * 0.06;
      d.y += d.vy + Math.cos(d.phase * 0.8) * 0.05;
      if (d.x < -5) d.x = w + 5; if (d.x > w + 5) d.x = -5;
      if (d.y < -5) d.y = h + 5; if (d.y > h + 5) d.y = -5;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + inkRGB[0] + ', ' + inkRGB[1] + ', ' + inkRGB[2] + ',' + d.o + ')'; ctx.fill();
    }
    requestAnimationFrame(draw);
  })();
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach(function (el) { observer.observe(el); });
})();
(function () {
  var btn = document.getElementById('themeToggle');
  if (!btn) return;
  var root = document.documentElement;
  function apply(mode) {
    if (mode === 'cream') root.setAttribute('data-theme', 'cream');
    else root.removeAttribute('data-theme');
    btn.textContent = mode === 'cream' ? '☀ 角色配色' : '☾ 会馆乳白';
    try { localStorage.setItem('lhx_showcase_theme', mode); } catch (e) {}
  }
  var saved = 'char';
  try { saved = localStorage.getItem('lhx_showcase_theme') || 'char'; } catch (e) {}
  apply(saved);
  btn.addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'cream' ? 'char' : 'cream';
    document.body.classList.add('theme-transition');
    apply(next);
    window.dispatchEvent(new Event('lhx-theme-change'));
    setTimeout(function () { document.body.classList.remove('theme-transition'); }, 1000);
  });
})();
<\/script>
</body>
</html>`;
}

// ========== 弹出提示 ==========
let toastTimer = null;
function showToast(type, html, ms) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.className = 'toast show' + (type === 'error' ? ' error' : '');
  t.innerHTML = html;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('show'); }, ms || 5000);
}

// 修改某项时即时清除该行的红标提示
(function () {
  const form = document.getElementById('charForm');
  if (!form) return;
  const clearRow = (target) => {
    if (!target || !target.closest) return;
    const row = target.closest('.form-row');
    if (row && row.classList.contains('error')) {
      row.classList.remove('error');
      const er = row.querySelector('.err');
      if (er) er.textContent = '';
    }
  };
  form.addEventListener('input', e => clearRow(e.target));
  form.addEventListener('change', e => clearRow(e.target));
})();

// ========== 提交 ==========
document.getElementById('charForm').addEventListener('submit', function(e) {
  e.preventDefault();
  if (!validate()) {
    const n = document.querySelectorAll('.form-row.error').length +
      (document.getElementById('abilityErr').textContent.trim() ? 1 : 0);
    showToast('error', '⚠ 还有 <strong>' + n + '</strong> 处未填或填写有误，已用红色标出，请检查后重新提交。', 6000);
    const first = document.querySelector('.form-row.error');
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const data = collectData();
  const colors = selectedColor || COLOR_SCHEMES[4];
  generateAndSave(data, colors);
});

function generateAndSave(data, colors) {
  const html = generateShowcaseHTML(data, colors);

  // 保存到 localStorage：编辑模式原位替换，否则追加到头部
  const all = loadAll();
  if (editingIndex !== null) {
    all[editingIndex] = data;
  } else {
    all.unshift(data);
  }
  saveAll(all);

  // POST 到服务器保存展示页
  fetch('/api/save-character', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: data.code, html: html, data: data })
  })
  .then(async r => {
    const result = await r.json().catch(() => ({}));
    if (!r.ok || result.error) throw new Error(result.error || ('服务器返回 ' + r.status));
    document.getElementById('successMsg').classList.add('show');
    document.getElementById('successMsg').innerHTML = '登记成功！展示页已生成：<a href="' + result.url + '" target="_blank" style="color:var(--gold);">查看展示页</a>';
    setTimeout(() => { document.getElementById('successMsg').classList.remove('show'); }, 5000);
    showToast('success', '✔ 登记成功！「' + escapeHtml(data.name || data.code) + '」已收录至会馆名册，<a href="' + result.url + '" target="_blank">查看展示页</a>', 7000);
    resetForm();
    renderList();
  })
  .catch(err => {
    document.getElementById('successMsg').classList.add('show');
    document.getElementById('successMsg').innerHTML = '保存失败：' + escapeHtml(err.message) + '。数据已存入本地；若需生成展示页，请先登录后再提交。';
    setTimeout(() => { document.getElementById('successMsg').classList.remove('show'); }, 6000);
    showToast('error', '⚠ 展示页保存失败：' + escapeHtml(err.message) + '。数据已存入本地，登录后重新提交即可。', 7000);
    resetForm();
    renderList();
  });
}

// ========== 重置 ==========
function resetForm() {
  document.getElementById('charForm').reset();
  imageList = [];
  renderGallery();
  const zone = document.getElementById('uploadZone');
  zone.querySelector('.icon').textContent = '\uD83D\uDDBC';
  zone.querySelector('.tip').textContent = '点击上传人设图，可多选，支持 JPG / PNG（单张≤2MB）';
  document.getElementById('persPreset').value = '_custom';
  document.getElementById('persInput').style.display = '';
  document.getElementById('persInput').value = '';
  document.getElementById('orgInput').style.display = 'none';
  document.getElementById('speciesDetail').disabled = true;
  document.getElementById('extraBranchesContainer').innerHTML = '';
  document.getElementById('royalCustomName').value = '';
  weaponList = []; customBranches = {};
  renderWeaponTags();
  const _wi = document.getElementById('weaponInput'); if (_wi) _wi.value = '';
  document.getElementById('abilityDetailPanel').innerHTML = '<div class="empty-tip" style="padding:16px;" id="abilityDetailEmpty">在上方选择能力系别和分支后，此处将自动显示能力解释。数据库中未收录的分支将提供输入框供你自行填写。</div>';
  renderRoleLine();
  document.getElementById('sliderVal').textContent = '50';
  document.getElementById('factionLabel').textContent = '中立';
  document.querySelectorAll('.form-row.error').forEach(r => r.classList.remove('error'));
  // 退出编辑模式
  editingIndex = null;
  document.getElementById('editTip').style.display = 'none';
  document.getElementById('btnSubmit').textContent = '提 交 登 记';
  // 恢复默认配色
  selectedColorIdx = Math.max(0, COLOR_SCHEMES.findIndex(s => s.name.startsWith('深绿')));
  selectedColor = COLOR_SCHEMES[selectedColorIdx];
  renderFormColorGrid();
  applyFormTheme(selectedColor);
}

// ========== 列表渲染 ==========
let editingIndex = null;

function fillFormFromData(c) {
  const f = document.getElementById('charForm');
  f.reset();
  // 基础字段
  f.code.value = c.code || '';
  f.name.value = c.name || '';
  const g = document.querySelector('input[name="gender"][value="' + (c.gender || '中性/无') + '"]');
  if (g) g.checked = true;
  f.species_type.value = c.species_type || '人类';
  const detail = document.getElementById('speciesDetail');
  detail.value = c.species_detail || '';
  detail.disabled = (f.species_type.value !== '妖精');
  // 性格
  const persPreset = document.getElementById('persPreset');
  const persInput = document.getElementById('persInput');
  let persMatched = false;
  Array.prototype.forEach.call(persPreset.options, o => { if (o.value && o.value === c.personality) persMatched = true; });
  persInput.style.display = '';
  if (persMatched) { persPreset.value = c.personality; persInput.value = c.personality; }
  else if (c.personality) { persPreset.value = ''; persInput.value = c.personality; }
  else { persPreset.value = ''; persInput.value = ''; }
  // 年龄与文本字段
  f.age.value = (c.age != null && !isNaN(c.age)) ? c.age : '';
  f.height.value = c.height || '';
  f.likes.value = c.likes || '';
  f.dislikes.value = c.dislikes || '';
  f.food.value = c.food || '';
  f.appearance.value = c.appearance || '';
  weaponList = (c.weapon || '').split('、').map(s => s.trim()).filter(Boolean);
  renderWeaponTags();
  const _wInput = document.getElementById('weaponInput'); if (_wInput) _wInput.value = '';
  f.background.value = c.background || '';
  f.intro.value = c.intro || '';
  f.notes.value = c.notes || '';
  // 组织
  const orgPreset = document.getElementById('orgPreset');
  const orgInput = document.getElementById('orgInput');
  let orgMatched = false;
  Array.prototype.forEach.call(orgPreset.options, o => { if (o.value && o.value === c.org) orgMatched = true; });
  if (orgMatched) { orgPreset.value = c.org; orgInput.style.display = 'none'; }
  else if (c.org) { orgPreset.value = '_custom'; orgInput.style.display = ''; orgInput.value = c.org; }
  // 阵营
  f.faction.value = (c.faction != null) ? c.faction : 50;
  document.getElementById('sliderVal').textContent = f.faction.value;
  document.getElementById('factionLabel').textContent = c.faction_label || (f.faction.value < 40 ? '亲近人类' : f.faction.value > 60 ? '亲近妖精' : '中立');
  // 长老身份现由登录账号角色派生，仅刷新状态行
  renderRoleLine();
  // 重置能力勾选与动态分支
  document.getElementById('extraBranchesContainer').innerHTML = '';
  document.querySelectorAll('input[name="ability_royal"]').forEach(cb => cb.checked = false);
  document.querySelectorAll('input[name="extra_sys"]').forEach(cb => cb.checked = false);
  document.getElementById('royalCustomName').value = '';
  customBranches = {};
  if (f.gender) for (const r of f.gender) r.checked = false;
  // 解析 abilities 字符串
  const royalBranches = [];
  const extraMap = {};
  (Array.isArray(c.abilities) ? c.abilities : []).forEach(a => {
    const m = /^([^·]+)·(.+)$/.exec(String(a || ''));
    if (!m) return;
    const sys = m[1].trim();
    const brs = m[2].split(/[、,，]/).map(x => x.trim()).filter(Boolean);
    if (sys === '御灵系') royalBranches.push.apply(royalBranches, brs);
    else extraMap[sys] = brs;
  });
  // 御灵系勾选
  royalBranches.forEach(b => {
    const cb = document.querySelector('input[name="ability_royal"][value="' + b + '"]');
    if (cb) cb.checked = true;
  });
  const knownRoyal = ['金', '木', '水', '火', '土'];
  const royalCustom = royalBranches.filter(b => knownRoyal.indexOf(b) < 0);
  if (royalCustom.length > 0) document.getElementById('royalCustomName').value = royalCustom.join('、');
  checkRoyalLimit();
  // 额外系勾选并渲染分支
  Object.keys(extraMap).forEach(sys => {
    const cb = document.querySelector('input[name="extra_sys"][value="' + sys + '"]');
    if (cb) cb.checked = true;
  });
  onExtraSystemChange();
  // 回填额外系分支与自定义分支
  Object.keys(extraMap).forEach(sys => {
    extraMap[sys].forEach(b => {
      const cb = document.querySelector('input[name="ability_' + sys + '"][value="' + b + '"]');
      if (cb) cb.checked = true;
    });
    const customInput = document.querySelector('input[data-custom-branch="' + sys + '"]');
    if (customInput) {
      const known = (ABILITY_BRANCHES[sys] || []);
      const customs = extraMap[sys].filter(b => known.indexOf(b) < 0);
      if (customs.length > 0) { customBranches[sys] = customs.slice(); renderCustomBranchTags(sys); }
    }
  });
  // 能力详解自定义描述
  updateAbilityDetail();
  if (c.customDetails) {
    Object.keys(c.customDetails).forEach(k => {
      const el = document.querySelector('[data-ability-custom="' + k + '"]');
      if (el) el.value = c.customDetails[k];
    });
  }
  // 图片：沿用原图（多张），可重新上传/删除
  imageList = Array.isArray(c.images) && c.images.length ? c.images.slice() : (c.image ? [c.image] : []);
  renderGallery();
  if (imageList.length) {
    const zone = document.getElementById('uploadZone');
    zone.querySelector('.icon').textContent = '\u2705';
    zone.querySelector('.tip').textContent = '已载入 ' + imageList.length + ' 张原图，可继续上传或删除';
  }
  // 配色
  if (c.colorIndex != null && COLOR_SCHEMES[c.colorIndex]) {
    selectedColorIdx = c.colorIndex;
    selectedColor = COLOR_SCHEMES[selectedColorIdx];
  } else if (c.colorPrimary && c.colorAccent) {
    selectedColorIdx = -1;
    selectedColor = buildCustomTheme(c.colorPrimary, c.colorAccent);
    customPrimary = { hex: c.colorPrimary, name: customPrimary && customPrimary.name || '' };
    customAccent = { hex: c.colorAccent, name: customAccent && customAccent.name || '' };
  } else {
    selectedColorIdx = 0;
    selectedColor = COLOR_SCHEMES[0];
  }
  renderFormColorGrid();
  applyFormTheme(selectedColor);
}

function editChar(i) {
  const all = loadAll();
  const c = all[i];
  if (!c) return;
  fillFormFromData(c);
  // 进入编辑模式
  editingIndex = i;
  document.getElementById('btnSubmit').textContent = '更 新 登 记';
  const tip = document.getElementById('editTip');
  tip.style.display = '';
  tip.innerHTML = '正在编辑「' + escapeHtml(c.code) + ' · ' + escapeHtml(c.name) + '」，修改完成后点击「更新登记」保存；点「重置」可退出编辑。';
  document.getElementById('charForm').scrollIntoView({ behavior: 'smooth' });
}

// 缩略图加载失败时回退为人设名字首字
function thumbFallback(el) {
  if (!el || !el.parentNode) return;
  const ch = el.getAttribute('data-fallback') || '?';
  const d = document.createElement('div');
  d.className = 'thumb';
  d.style.cssText = 'display:flex;align-items:center;justify-content:center;color:var(--text-dim);font-size:22px;';
  d.textContent = ch;
  el.parentNode.replaceChild(d, el);
}

function renderList() {
  const all = loadAll();
  const grid = document.getElementById('cardGrid');
  const btn = document.getElementById('btnClearAll');
  if (all.length === 0) {
    grid.innerHTML = '<div class="empty-tip">尚未有人设登记。快来提交第一份吧。</div>';
    btn.style.display = 'none';
    return;
  }
  btn.style.display = '';
  grid.innerHTML = all.map((c, i) => `
    <div class="char-card">
      ${c.image ? `<img class="thumb" src="${c.image}" alt="" data-fallback="${escapeHtml((c.name || c.code || '?')[0])}" onerror="thumbFallback(this)">` : '<div class="thumb" style="display:flex;align-items:center;justify-content:center;color:var(--text-dim);font-size:22px;">' + escapeHtml((c.name || c.code || '?')[0]) + '</div>'}
      <div class="info">
        <div class="name">${escapeHtml(c.code)} · ${escapeHtml(c.name)}</div>
        <div class="meta">
          <span>${c.gender}</span>
          <span>${c.species_type}${c.species_detail ? '（'+escapeHtml(c.species_detail)+'）' : ''}</span>
          <span>${c.age}岁</span>
          <span>${escapeHtml(c.org)}</span>
          <span>${c.faction_label}</span>
          <span>${COLOR_SCHEMES[c.colorIndex] ? `<span class="color-dot" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${COLOR_SCHEMES[c.colorIndex].primary};box-shadow:0 0 0 2px ${COLOR_SCHEMES[c.colorIndex].accent};vertical-align:middle;"></span>` : ''}</span>
          <span style="display:block;margin-top:2px;">能力：${escapeHtml(Array.isArray(c.abilities) ? c.abilities.join('；') : c.abilities)}</span>
        </div>
      </div>
      <div class="card-actions">
        <a class="btn-show" href="/show.html?code=${encodeURIComponent(c.code)}" target="_blank" rel="noopener">展示页</a>
        <button class="btn-edit" onclick="editChar(${i})">编辑</button>
        <button class="btn-del" onclick="delChar(${i})">删除</button>
      </div>
    </div>
  `).join('');
}

function delChar(i) {
  const all = loadAll();
  if (!confirm('确定删除「' + all[i].code + ' · ' + all[i].name + '」的人设登记吗？')) return;
  all.splice(i, 1);
  saveAll(all);
  renderList();
  // 同步删除到服务器
  if (currentUser) {
    fetch('/api/save-all-characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characters: all })
    }).catch(() => {});
  }
}

function clearAll() {
  if (!confirm('确定清空全部人设登记吗？此操作不可撤销。')) return;
  saveAll([]);
  renderList();
}

function escapeHtml(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

renderFormColorGrid();
initCustomPicker();
applyFormTheme(COLOR_SCHEMES[selectedColorIdx]);
renderList();
checkLogin();
