import { useCallback, useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';
import './orientation.css';

export type OrientationPhase = 'opening' | 'game';
export type Orientation = 'landscape' | 'portrait';
const PREF_KEY = 'zszm.orientation';

export function isPhone() {
  return window.matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) <= 600;
}
function readPref(): Orientation {
  try { return sessionStorage.getItem(PREF_KEY) === 'portrait' ? 'portrait' : 'landscape'; } catch { return 'landscape'; }
}

export function useOrientationGuard(phase: OrientationPhase) {
  const [phone] = useState(isPhone);
  const [enteredPortrait] = useState(() => window.matchMedia('(orientation: portrait)').matches);
  const [ready, setReady] = useState(false);
  const [pref, setPref] = useState(readPref);
  // One delay per visit, independent of viewport changes and opening phases.
  useEffect(() => {
    if (!phone) return;
    const timer = window.setTimeout(() => setReady(true), 5000);
    return () => window.clearTimeout(timer);
  }, [phone]);
  const portraitAllowed = phase === 'game' && pref === 'portrait';
  useEffect(() => {
    if (!phone) return;
    const orientation = ready && !portraitAllowed ? 'landscape' : 'portrait';
    window.frameElement?.dispatchEvent(new CustomEvent('gate:orientation', { detail: orientation }));
  }, [phone, ready, portraitAllowed]);
  // 离开玩法时把外层旋转交还竖屏；否则切到其它模块/回到门庭后整个门户仍是横着的。
  useEffect(() => {
    if (!phone) return;
    const frame = window.frameElement;
    return () => {
      frame?.dispatchEvent(new CustomEvent('gate:orientation', { detail: 'portrait' }));
    };
  }, [phone]);
  const choose = useCallback((next: Orientation) => {
    try { sessionStorage.setItem(PREF_KEY, next); } catch { /* private mode: this page only */ }
    setPref(next);
  }, []);
  return { phone, phase, portraitAllowed, blocked: phone && enteredPortrait && !ready && !portraitAllowed, choose };
}

export function OrientationGuard({ phone, phase, portraitAllowed, blocked, choose }: ReturnType<typeof useOrientationGuard>) {
  if (!phone) return null;
  if (blocked) return (
    <div className="orient-guard" role="status" aria-labelledby="orient-guard-title">
      <Smartphone className="orient-guard__phone" size={46} strokeWidth={1.4} aria-hidden="true" />
      <h2 id="orient-guard-title">即将自动切换横屏</h2>
      <p>五秒后自动进入横向画面，无需转动手机。</p>
    </div>
  );
  if (phase !== 'game') return null;
  return portraitAllowed
    ? <button type="button" className="orient-toggle" onClick={() => choose('landscape')}>切换横屏</button>
    : <button type="button" className="orient-toggle" onClick={() => choose('portrait')}>切换竖屏</button>;
}
