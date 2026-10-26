import { useCallback, useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';
import './orientation.css';

// Phones play landscape: forced from the intro through onboarding, the default inside the game,
// where the player may switch to portrait. Desktop and tablets are untouched.
// A real lock needs Fullscreen + Screen Orientation (Android Chrome); elsewhere (iPhone Safari)
// the guard asks the player to turn the phone and pauses the intro until they do.
export type OrientationPhase = 'opening' | 'game';
type Orientation = 'landscape' | 'portrait';
type LockableOrientation = ScreenOrientation & { lock?: (orientation: Orientation) => Promise<void> };

// Per tab: a refresh keeps the player's choice, a new visit starts landscape again.
const PREF_KEY = 'zszm.orientation';
const PHONE_SHORT_SIDE = 600;

function isPhone() {
  return window.matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) <= PHONE_SHORT_SIDE;
}
// The viewport, not screen.orientation.type: they can disagree (desktop-mode sites, emulators), and the
// on-screen keyboard can only make a portrait viewport look landscape, never the other way round.
function isPortrait() {
  return window.matchMedia('(orientation: portrait)').matches;
}
function readPref(): Orientation {
  try { return sessionStorage.getItem(PREF_KEY) === 'portrait' ? 'portrait' : 'landscape'; } catch { return 'landscape'; }
}
function writePref(pref: Orientation) {
  try { sessionStorage.setItem(PREF_KEY, pref); } catch { /* private mode: this page only */ }
}
function canLock() {
  const orientation = screen.orientation as LockableOrientation | undefined;
  return !!(document.fullscreenEnabled && document.documentElement.requestFullscreen && typeof orientation?.lock === 'function');
}
// Must run inside a tap. Portrait never enters fullscreen on its own; it only re-locks an existing one.
async function lockTo(orientation: Orientation) {
  const screenOrientation = screen.orientation as LockableOrientation | undefined;
  if (!screenOrientation?.lock) return;
  try {
    if (!document.fullscreenElement) {
      if (orientation === 'portrait' || !canLock()) return;
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    }
    await screenOrientation.lock(orientation);
  } catch { /* refused or unsupported: the rotate prompt stays as the fallback */ }
}

export function useOrientationGuard(phase: OrientationPhase) {
  const [phone] = useState(isPhone);
  const [portrait, setPortrait] = useState(isPortrait);
  const [pref, setPref] = useState(readPref);
  useEffect(() => {
    if (!phone) return;
    const sync = () => setPortrait(isPortrait());
    const media = window.matchMedia('(orientation: portrait)');
    screen.orientation?.addEventListener('change', sync);
    media.addEventListener('change', sync);
    window.addEventListener('resize', sync);
    return () => {
      screen.orientation?.removeEventListener('change', sync);
      media.removeEventListener('change', sync);
      window.removeEventListener('resize', sync);
    };
  }, [phone]);
  const choose = useCallback((next: Orientation) => {
    writePref(next);
    setPref(next);
    void lockTo(next);
  }, []);
  const portraitAllowed = phase === 'game' && pref === 'portrait';
  return { phone, phase, portraitAllowed, blocked: phone && portrait && !portraitAllowed, choose };
}

export function OrientationGuard({ phone, phase, portraitAllowed, blocked, choose }: ReturnType<typeof useOrientationGuard>) {
  const [lockable] = useState(canLock);
  if (!phone) return null;
  if (blocked) return (
    <div className="orient-guard" role="dialog" aria-modal="true" aria-labelledby="orient-guard-title" aria-describedby="orient-guard-text">
      <Smartphone className="orient-guard__phone" size={46} strokeWidth={1.4} aria-hidden="true" />
      <h2 id="orient-guard-title">横过手机，门外更开阔</h2>
      <p id="orient-guard-text">
        {phase === 'opening' ? '众生之门的开场与初始化按横屏设计，横过来后会从这里继续。' : '门庭默认横屏游玩，也可以改用竖屏。'}
        {!lockable && <><br />画面不转时，请先关闭系统的「竖排方向锁定」。</>}
      </p>
      <div className="orient-guard__actions">
        {lockable && <button type="button" className="orient-guard__primary" onClick={() => void lockTo('landscape')}>全屏横屏</button>}
        {phase === 'game' && <button type="button" onClick={() => choose('portrait')}>切换竖屏</button>}
      </div>
    </div>
  );
  if (phase !== 'game') return null;
  return portraitAllowed
    ? <button type="button" className="orient-toggle" onClick={() => choose('landscape')}>切换横屏</button>
    : <button type="button" className="orient-toggle" onClick={() => choose('portrait')}>切换竖屏</button>;
}
