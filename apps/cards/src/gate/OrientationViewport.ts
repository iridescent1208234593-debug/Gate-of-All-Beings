import { isPhone, type Orientation } from './OrientationGuard';

// A landscape iframe gives CSS media queries, viewport units, dialogs, canvas and
// pointer coordinates the same viewport. Rotating only the app DOM cannot do that.
// No fullscreen permission or system auto-rotate setting is required.
export function mountOrientationViewport(): (() => void) | null {
  if (window.frameElement?.hasAttribute('data-gate-viewport')) {
    // Account and site links must still navigate the browser, not an embedded login page.
    const base = document.querySelector('base') || document.head.appendChild(document.createElement('base'));
    base.target = '_top';
    return null;
  }
  if (!isPhone()) return null;
  const root = document.getElementById('root')!;
  const frame = document.createElement('iframe');
  frame.setAttribute('data-gate-viewport', '');
  frame.title = '众生之门';
  frame.allow = 'fullscreen; autoplay';
  let orientation: Orientation = 'portrait';
  const sync = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const rotated = orientation === 'landscape' && height > width;
    frame.style.cssText = `position:fixed;left:0;top:0;border:0;transform-origin:0 0;width:${rotated ? height : width}px;height:${rotated ? width : height}px;transform:${rotated ? 'rotate(90deg) translateY(-100%)' : 'none'};`;
  };
  const change = (event: Event) => {
    const next = (event as CustomEvent).detail;
    if (next !== 'landscape' && next !== 'portrait') return;
    orientation = next;
    sync();
  };
  frame.addEventListener('gate:orientation', change);
  // The native installation offer belongs to the top window. Keep the existing
  // in-game installation UI able to invoke that real offer from a tap.
  let installOffer: Event | null = null;
  const offer = () => {
    if (!installOffer || !frame.contentWindow) return;
    const native = installOffer as Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, { prompt: () => { installOffer = null; return native.prompt(); }, userChoice: native.userChoice });
    frame.contentWindow.dispatchEvent(event);
  };
  const beforeInstall = (event: Event) => { event.preventDefault(); installOffer = event; offer(); };
  const installed = () => { installOffer = null; frame.contentWindow?.dispatchEvent(new Event('appinstalled')); };
  frame.addEventListener('load', offer);
  window.addEventListener('beforeinstallprompt', beforeInstall);
  window.addEventListener('appinstalled', installed);
  window.addEventListener('resize', sync);
  sync();
  frame.src = window.location.href;
  root.appendChild(frame);
  return () => {
    window.removeEventListener('resize', sync);
    window.removeEventListener('beforeinstallprompt', beforeInstall);
    window.removeEventListener('appinstalled', installed);
    frame.removeEventListener('gate:orientation', change);
    frame.remove();
  };
}
