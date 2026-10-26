/**
 * 图二 · 种族列表页。
 *
 * 所有尺寸/坐标都来自对设计稿的实测（见文件内的注释标注），单位是设计稿像素，
 * 通过 em 定位（画布 font-size = k 倍 rem，1em = k 个设计像素）。
 *
 * 交互（按你的确认）：
 *   - 分类方块：只切换高亮，列表**始终显示全部种族**
 *   - 搜索框：按名称实时过滤列表（无占位文字，只有放大镜图标）
 *   - 卡片：点击切换当前选中种族
 *   - 右下角方形按钮：确认当前选中的种族
 */
import { CATEGORIES, RACES, LIST_CANVAS } from './races.js';

const CATEGORY_ICONS = import.meta.glob('./media/race-categories/*.png', { eager: true, import: 'default', query: '?url' });
const AVATARS = import.meta.glob('./media/race-avatars/*.png', { eager: true, import: 'default', query: '?url' });

const MAGNIFIER = `<svg class="race-search-icon" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
  <circle cx="43" cy="43" r="26" fill="none" stroke="currentColor" stroke-width="10"/>
  <path d="M62 62 L82 82" stroke="currentColor" stroke-width="12" stroke-linecap="round"/>
</svg>`;

const ARROW = `<svg class="race-submit-icon" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
  <path d="M20 52 H74 M56 32 L78 52 L56 72" fill="none" stroke="currentColor" stroke-width="11"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

export function createRaceList({ root, onConfirm, onBack, initialSelected = null }) {
  const events = new AbortController();
  const listen = (target, type, listener) => target.addEventListener(type, listener, { signal: events.signal });
  const canvas = root.querySelector('#race-list-canvas');
  const backBtn = root.querySelector('[data-back]');
  if (!canvas || !backBtn) throw new Error('种族列表界面缺少必要的 DOM 结构');

  canvas.innerHTML = '';

  /* ---------------------------------------------------------- 顶部分类方块 */
  // 实测：80×80，x 从 177 起、间距 99，y = 80
  // 直接挂在画布上（不套全屏容器），否则容器会挡住别的界面层的点击
  const chips = new Map();
  for (const [idx, cat] of CATEGORIES.entries()) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'race-chip';
    btn.dataset.category = cat.id;
    btn.style.left = `${177 + idx * 99}em`;
    btn.style.top = '80em';
    btn.setAttribute('aria-label', cat.name);
    const icon = document.createElement('img');
    icon.className = 'race-category-icon';
    icon.alt = '';
    icon.draggable = false;
    icon.src = CATEGORY_ICONS[`./media/race-categories/cat-${String(idx + 1).padStart(2, '0')}.png`];
    btn.appendChild(icon);
    listen(btn, 'click', () => setCategory(cat.id));
    canvas.appendChild(btn);
    chips.set(cat.id, btn);
  }

  /* -------------------------------------------------------------- 搜索框 */
  // 实测：x=712 y=92，宽 333 高 60；深灰描边、内部黑底，左侧放大镜，无占位文字
  const searchBox = document.createElement('div');
  searchBox.className = 'race-search';
  searchBox.style.left = '712em';
  searchBox.style.top = '92em';
  searchBox.style.width = '333em';
  searchBox.style.height = '60em';
  searchBox.innerHTML = MAGNIFIER;
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'race-search-input';
  searchInput.id = 'race-search';
  searchInput.setAttribute('aria-label', '搜索种族');
  searchInput.autocomplete = 'off';
  searchInput.autocapitalize = 'off';
  searchInput.spellcheck = false;
  searchBox.appendChild(searchInput);
  canvas.appendChild(searchBox);

  /* ------------------------------------------------------------ 确认按钮 */
  // 实测：58×58，x=1081 y=93，浅色底 + 白色箭头
  const submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.className = 'race-submit';
  submitBtn.id = 'race-submit';
  submitBtn.style.left = '1081em';
  submitBtn.style.top = '93em';
  submitBtn.setAttribute('aria-label', '确认选择');
  submitBtn.innerHTML = ARROW;
  listen(submitBtn, 'click', confirm);
  canvas.appendChild(submitBtn);

  /* -------------------------------------------------------------- 分隔线 */
  // 实测：y≈168，x 从 164 到 1141
  const divider = document.createElement('div');
  divider.className = 'race-divider';
  divider.style.left = '164em';
  divider.style.top = '168em';
  divider.style.width = '977em';
  canvas.appendChild(divider);

  /* ---------------------------------------------------------- 卡片滚动区 */
  // 实测：卡片 144×145，列 x = 268/470/672/874（列距 202），行 y = 267/463/660（行距 196.5）
  // 滚动区从 x=164 y=200 起，宽 1000 高 640；内部 padding 让首卡落在 (268, 267)
  const scroller = document.createElement('div');
  scroller.className = 'race-grid-scroll';
  scroller.style.left = '164em';
  scroller.style.top = '200em';
  scroller.style.width = '1000em';
  scroller.style.height = '640em';
  const grid = document.createElement('div');
  grid.className = 'race-grid';
  grid.style.paddingLeft = '104em'; // 268 - 164
  grid.style.paddingTop = '67em'; // 267 - 200
  grid.style.columnGap = '58em'; // 202 - 144
  grid.style.rowGap = '51.5em'; // 196.5 - 145
  scroller.appendChild(grid);
  canvas.appendChild(scroller);

  /** @type {Map<string, HTMLButtonElement>} */
  const cards = new Map();
  for (const race of RACES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'race-card';
    btn.dataset.race = race.id;
    btn.style.width = '144em';
    btn.style.height = '145em';
    btn.setAttribute('aria-label', race.name);
    const avatar = document.createElement('img');
    avatar.className = 'race-avatar';
    avatar.alt = '';
    avatar.draggable = false;
    avatar.src = AVATARS[`./media/race-avatars/${race.id}.png`];
    btn.appendChild(avatar);
    listen(btn, 'click', () => { setSelected(race.id); confirm(); });
    grid.appendChild(btn);
    cards.set(race.id, btn);
  }

  let selectedId = initialSelected;
  let activeCategory = null;

  function setSelected(id) {
    selectedId = id;
    for (const [rid, el] of cards) el.classList.toggle('is-selected', rid === id);
  }

  setSelected(selectedId);

  function setCategory(id) {
    activeCategory = id;
    for (const [cid, el] of chips) el.classList.toggle('is-selected', cid === id);
  }

  /** 搜索过滤：按名称子串匹配（不区分大小写），只影响显示，不改变选中状态 */
  function applyFilter() {
    const q = searchInput.value.trim().toLowerCase();
    let visible = 0;
    for (const race of RACES) {
      const el = cards.get(race.id);
      const hit = q === '' || race.name.toLowerCase().includes(q);
      el.hidden = !hit;
      if (hit) visible++;
    }
    return visible;
  }

  function confirm() {
    if (!selectedId) {
      console.warn('[众生之门] 尚未选中种族，确认按钮无效');
      return;
    }
    if (typeof onConfirm === 'function') onConfirm(selectedId);
  }

  listen(searchInput, 'input', applyFilter);
  // 回车直接确认，和用户名输入框的手感保持一致
  listen(searchInput, 'keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirm();
    }
  });

  listen(backBtn, 'click', () => {
    if (typeof onBack === 'function') onBack();
  });

  return {
    dispose() { events.abort(); },
    show() {
      root.classList.add('is-active');
      root.setAttribute('aria-hidden', 'false');
    },
    hide() {
      root.classList.remove('is-active');
      root.setAttribute('aria-hidden', 'true');
    },
    setSelected,
    setCategory,
    /** 进入时清空搜索并滚回顶部 */
    reset() {
      searchInput.value = '';
      applyFilter();
      scroller.scrollTop = 0;
    },
    get selected() {
      return selectedId;
    },
    get category() {
      return activeCategory;
    },
    get element() {
      return root;
    },
    cardCount: cards.size,
    chipCount: chips.size,
    visibleCount: applyFilter,
  };
}

export default createRaceList;
