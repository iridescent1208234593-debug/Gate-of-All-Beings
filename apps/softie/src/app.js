import './style.css';
import { getCurrentLanguage, translate } from './i18n.js';

// softie 入口：可独立运行，也可被统一壳无 iframe 挂载（mount/unmount）。
let container, home, spirit, homeModule, spiritModule, spiritScene, pageToken = 0;

function routeMode() {
  const path = location.pathname.replace(/\/+$/, '');
  if (path.endsWith('/debug')) return 'debug';
  if (path.endsWith('/create')) return 'create';
  return 'play';
}

function showHome() {
  spiritScene?.setActive(false);
  if (home) home.hidden = false;
  if (spirit) spirit.hidden = true;
  if (container) {
    container.classList.remove('playing-spirit');
    container.dataset.softiePage = 'home';
    document.dispatchEvent(new Event('softie-route'));
    const loading = container.querySelector('#loading');
    if (loading && !homeModule) loading.hidden = false;
  }
  document.title = translate(getCurrentLanguage(), 'title');
  homeModule ??= import('./main.js');
}

async function showSpirit() {
  const token = ++pageToken;
  spiritScene?.setActive(false);
  if (home) home.hidden = true;
  if (spirit) spirit.hidden = false;
  if (container) {
    container.classList.add('playing-spirit');
    container.dataset.softiePage = 'spirit';
    document.dispatchEvent(new Event('softie-route'));
    const loading = container.querySelector('#loading');
    if (loading) loading.hidden = true;
  }
  document.title = '灵体试验场 · 林间灵域';
  if (spiritScene) { spiritScene.setMode(routeMode()); spiritScene.setActive(true); return; }
  spirit.textContent = '正在准备灵体试验场…';
  spiritModule ??= import('./games/spirit-playground/view.js');
  spiritModule.then(({ mountSpiritPlayground }) => {
    if (token !== pageToken) return;
    spiritScene = mountSpiritPlayground(spirit);
    spiritScene.setMode(routeMode());
    spiritScene.setActive(true);
  }).catch((error) => {
    console.error('[spirit-playground] loading:', error);
    if (token !== pageToken) return;
    spirit.textContent = '灵体试验场加载失败，请刷新重试。';
  });
}

function onClick(event) {
  const link = event.target.closest('a');
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const href = link.getAttribute('href') || '';
  if (href.includes('games/spirit-playground')) {
    event.preventDefault();
    history.pushState(null, '', href);
    showSpirit();
    container.scrollTop = 0;
    return;
  }
  if (href === '.' || href === './' || href === '/' || href === '') {
    event.preventDefault();
    showHome();
    container.scrollTop = 0;
  }
}

function onPopState() {
  if (container) showSpirit();
}

export function mount(el) {
  container = el || document.body;
  home = container.querySelector('.playground');
  spirit = document.createElement('main');
  spirit.className = 'spirit-playground';
  spirit.hidden = true;
  container.append(spirit);
  container.addEventListener('click', onClick);
  window.addEventListener('popstate', onPopState);
  // The softie module now opens directly into the public spirit experience.
  showSpirit();
  return unmount;
}

export function unmount() {
  container?.removeEventListener('click', onClick);
  window.removeEventListener('popstate', onPopState);
  spiritScene?.dispose?.();
  spiritScene = null;
  home?.remove();
  spirit?.remove();
  home = spirit = container = undefined;
}

if (window.__iridescentlyEmbed) {
  window.__iridescentlyDispose = mount(window.__iridescentlyEmbed);
} else if (document.querySelector('.playground')) {
  mount(document.body);
}
