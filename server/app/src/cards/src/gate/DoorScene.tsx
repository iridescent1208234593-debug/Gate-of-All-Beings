import { useEffect, useRef, useState } from 'react';
import './door-scene.css';

const W = 1920;
const H = 1180;
const PSD_W = 2100;
const PSD_H = 1300;
const DOOR_X = 905;
const DOOR_Y = 610;
const SPIRIT_X = 995;
const SPIRIT_Y = 610;
// The prototype starts its white flash 2.1s after the push; music changes at that beat.
export const DOOR_MUSIC_SWITCH_MS = 2100;
const DOOR_REVEAL_MS = 3400;
const SCENE_END_MS = 4700;
const ease = (value: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, value)), 3);
const layers = [
  { name: 'base', depth: 0, src: new URL('./door-assets/base.png', import.meta.url).href },
  { name: 'far', depth: .012, src: new URL('./door-assets/far.png', import.meta.url).href },
  { name: 'water', depth: .02, src: new URL('./door-assets/water.png', import.meta.url).href },
  { name: 'gate', depth: .024, src: new URL('./door-assets/gate.png', import.meta.url).href },
  { name: 'gatetree', depth: .028, src: new URL('./door-assets/gatetree.png', import.meta.url).href },
  { name: 'steps', depth: .034, src: new URL('./door-assets/steps.png', import.meta.url).href },
  { name: 'fg', depth: .08, src: new URL('./door-assets/fg.png', import.meta.url).href },
];
const spiritSrc = new URL('./door-assets/spirit.png', import.meta.url).href;
const pieces = [
  [722, 454, 1324, 793, 0], [1277, 613, 1350, 683, .35], [650, 599, 728, 668, .55],
  [1830, 566, 1955, 699, .7], [1639, 984, 1797, 1098, .85], [1805, 1033, 1856, 1078, 1],
];
type Props = { onFinish: () => void; onFlashStart: () => void; onReveal: () => void };

export function DoorScene({ onFinish, onFlashStart, onReveal }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const spiritRef = useRef<HTMLCanvasElement>(null);
  const turbulenceRef = useRef<SVGFETurbulenceElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef(0);
  const drawRef = useRef<FrameRequestCallback | null>(null);
  const reducedTimer = useRef<number | null>(null);
  const enteredAt = useRef<number | null>(null);
  const elapsedHidden = useRef(0);
  const flashCalled = useRef(false);
  const revealCalled = useRef(false);
  const finishCalled = useRef(false);
  const pointer = useRef({ x: 0, y: 0, cx: 0, cy: 0 });
  const [entering, setEntering] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [ready, setReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const reduceRef = useRef(reduceMotion);
  reduceRef.current = reduceMotion;

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => setReduceMotion(media.matches);
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    const portal = portalRef.current;
    const fx = fxRef.current;
    const spirit = spiritRef.current;
    if (!stage || !portal || !fx || !spirit) return;
    let cancelled = false;
    const flies = Array.from({ length: 22 }, (_, i) => ({ x: Math.random() * W, y: 180 + Math.random() * 820, ph: Math.random() * 7, sp: .3 + Math.random() * .6 }));
    const fit = () => {
      for (const canvas of [portal, fx, spirit]) {
        const dpr = Math.min(devicePixelRatio || 1, 1.5);
        canvas.width = Math.round(canvas.clientWidth * dpr);
        canvas.height = Math.round(canvas.clientHeight * dpr);
      }
    };
    const resize = new ResizeObserver(fit);
    resize.observe(stage);
    fit();
    const img = new Image();
    img.src = spiritSrc;
    imgRef.current = img;
    void Promise.all(layers.map(layer => {
      const image = new Image(); image.src = layer.src;
      return image.decode().catch(() => undefined);
    }).concat([img.decode().catch(() => undefined)])).then(() => { if (!cancelled) setReady(true); });

    const draw = (now: number) => {
      frameRef.current = 0;
      if (cancelled || document.hidden) return;
      const portalCtx = portal.getContext('2d');
      const fxCtx = fx.getContext('2d');
      const spiritCtx = spirit.getContext('2d');
      const s = portal.width / W;
      if (portalCtx) {
        portalCtx.clearRect(0, 0, portal.width, portal.height);
        const reduce = reduceRef.current;
        const pulse = reduce ? 1 : 1 + Math.sin(now / 2200) * .04;
        const glow = portalCtx.createRadialGradient(DOOR_X * s, DOOR_Y * s, 10 * s, DOOR_X * s, DOOR_Y * s, 330 * (W / 1300) * s * pulse);
        glow.addColorStop(0, 'rgba(255,255,250,1)'); glow.addColorStop(.4, 'rgba(250,250,240,1)');
        glow.addColorStop(.72, 'rgba(240,243,226,1)'); glow.addColorStop(1, 'rgba(226,236,208,1)');
        portalCtx.fillStyle = glow; portalCtx.fillRect(0, 0, portal.width, portal.height);
        if (!reduce) for (let i = 0; i < 26; i++) {
          const p = (now / 9000 + i * .0385) % 1, a = Math.sin(p * Math.PI);
          const x = (DOOR_X - 140 * (W / 1300) + (i * 97 % 280) * (W / 1300) + Math.sin(now / 1600 + i) * 14) * s;
          const y = (DOOR_Y + 170 * (W / 1300) - p * 340 * (W / 1300)) * s;
          portalCtx.fillStyle = `rgba(255,255,255,${.7 * a})`; portalCtx.beginPath(); portalCtx.arc(x, y, (1.6 + i % 3) * (W / 1300) * s, 0, Math.PI * 2); portalCtx.fill();
        }
      }
      if (fxCtx) {
        fxCtx.clearRect(0, 0, fx.width, fx.height);
        if (!reduceRef.current) for (const fly of flies) {
          const x = (fly.x + Math.sin(now / 2600 * fly.sp + fly.ph) * 40) * fx.width / PSD_W;
          const y = (fly.y + Math.cos(now / 3100 * fly.sp + fly.ph) * 26) * fx.height / PSD_H;
          const a = .35 + .35 * Math.sin(now / 900 * fly.sp + fly.ph);
          const glow = fxCtx.createRadialGradient(x, y, 0, x, y, 9 * (W / 1300) * fx.width / PSD_W);
          glow.addColorStop(0, `rgba(255,240,170,${a})`); glow.addColorStop(1, 'rgba(255,240,170,0)');
          fxCtx.fillStyle = glow; fxCtx.beginPath(); fxCtx.arc(x, y, 9 * (W / 1300) * fx.width / PSD_W, 0, Math.PI * 2); fxCtx.fill();
        }
      }
      const start = enteredAt.current;
      if (spiritCtx) {
        spiritCtx.clearRect(0, 0, spirit.width, spirit.height);
        if (start !== null && img.complete) {
          const t = (now - start) / 1000;
          const scale = spirit.width / PSD_W;
          pieces.forEach(([x0, y0, x1, y1, delay], i) => {
            const lt = t - delay - .15; if (lt <= 0) return;
            const pcx = (x0 + x1) / 2, pcy = (y0 + y1) / 2, w = x1 - x0, h = y1 - y0;
            let x: number, y: number, sc: number, a: number;
            if (i === 0) {
              const grow = ease(lt / 1.6); sc = .3 + .7 * grow + Math.max(0, lt - 1.6) * .22;
              x = SPIRIT_X + (pcx - SPIRIT_X) * grow; y = SPIRIT_Y + (pcy - SPIRIT_Y) * grow + Math.sin(lt * 2.1) * 4;
              a = Math.min(1, lt / .9) * .92;
            } else {
              const go = ease(lt / 1.7), drift = Math.max(0, lt - 1.2), dx = pcx - SPIRIT_X, dy = pcy - SPIRIT_Y, d = Math.hypot(dx, dy) || 1;
              x = SPIRIT_X + dx * go + dx / d * drift * 34 + Math.sin(lt * 1.7 + i) * 6;
              y = SPIRIT_Y + dy * go + dy / d * drift * 34 - drift * 22 + Math.cos(lt * 1.3 + i) * 5;
              sc = .35 + .65 * go + drift * .06;
              a = Math.min(1, lt / .6) * Math.max(0, 1 - Math.max(0, lt - 1.9) / 1.4) * .95;
            }
            if (a <= 0) return;
            spiritCtx.save(); spiritCtx.globalAlpha = a; spiritCtx.translate(x * scale, y * scale);
            spiritCtx.rotate(Math.sin(lt * .9 + i) * .04); spiritCtx.scale(sc, sc);
            spiritCtx.drawImage(img, x0, y0, w, h, -w / 2 * scale, -h / 2 * scale, w * scale, h * scale); spiritCtx.restore();
          });
        }
      }
      const p = pointer.current;
      if (reduceRef.current) { p.cx = 0; p.cy = 0; }
      p.cx += (p.x - p.cx) * .06; p.cy += (p.y - p.cy) * .06;
      for (const layer of stage.querySelectorAll<HTMLElement>('[data-depth]')) {
        const depth = Number(layer.dataset.depth);
        layer.style.transform = `translate(${-p.cx * depth * W}px, ${-p.cy * depth * H * .6}px) scale(1.06)`;
      }
      const portalLayer = stage.querySelector<HTMLElement>('.door-portal');
      if (portalLayer) portalLayer.style.transform = `translate(${-p.cx * .01 * W}px, ${-p.cy * .01 * H * .6}px) scale(1.06)`;
      if (!reduceRef.current) turbulenceRef.current?.setAttribute('baseFrequency', `${.004 + Math.sin(now / 5000) * .0008} ${.03 + Math.cos(now / 4000) * .004}`);
      if (enteredAt.current !== null) {
        const elapsed = elapsedHidden.current + now - enteredAt.current;
        if (!flashCalled.current && elapsed >= DOOR_MUSIC_SWITCH_MS) { flashCalled.current = true; onFlashStart(); }
        if (!revealCalled.current && elapsed >= DOOR_REVEAL_MS) { revealCalled.current = true; setRevealing(true); onReveal(); }
        if (elapsed >= SCENE_END_MS) {
          if (!finishCalled.current) { finishCalled.current = true; onFinish(); }
          return;
        }
      }
      if (!reduceRef.current || enteredAt.current !== null) frameRef.current = requestAnimationFrame(draw);
    };
    drawRef.current = draw;
    const onPointer = (event: PointerEvent) => {
      pointer.current.x = event.clientX / innerWidth - .5; pointer.current.y = event.clientY / innerHeight - .5;
    };
    const visibility = () => {
      if (document.hidden) {
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
        if (enteredAt.current !== null) { elapsedHidden.current += performance.now() - enteredAt.current; enteredAt.current = null; }
      } else if (!frameRef.current) {
        if (elapsedHidden.current > 0 && enteredAt.current === null) enteredAt.current = performance.now();
        frameRef.current = requestAnimationFrame(draw);
      }
    };
    window.addEventListener('pointermove', onPointer);
    document.addEventListener('visibilitychange', visibility);
    frameRef.current = requestAnimationFrame(draw);
    return () => {
      cancelled = true; resize.disconnect(); window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', visibility);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      drawRef.current = null;
      if (reducedTimer.current !== null) window.clearTimeout(reducedTimer.current);
      imgRef.current = null;
    };
    // Timeline refs are used so the animation loop does not restart during state updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!reduceMotion && !document.hidden && !frameRef.current && drawRef.current) frameRef.current = requestAnimationFrame(drawRef.current);
  }, [reduceMotion]);

  const begin = () => {
    if (entering || finishCalled.current) return;
    setEntering(true);
    elapsedHidden.current = 0;
    flashCalled.current = false;
    revealCalled.current = false;
    if (reduceRef.current) {
      onFlashStart(); onReveal(); setRevealing(true); flashCalled.current = true; revealCalled.current = true;
      reducedTimer.current = window.setTimeout(() => { if (!finishCalled.current) { finishCalled.current = true; onFinish(); } }, 650);
    } else enteredAt.current = performance.now();
  };
  const skip = () => {
    if (finishCalled.current) return;
    finishCalled.current = true;
    onFlashStart();
    onFinish();
  };
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !entering) { event.preventDefault(); skip(); }
      else if ((event.key === 'Enter' || event.key === ' ') && !entering && !(event.target instanceof HTMLButtonElement)) { event.preventDefault(); begin(); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [entering]);

  return <section className={`door-scene${entering ? ' is-entering' : ''}${revealing ? ' is-revealing' : ''}${ready ? ' is-ready' : ''}${reduceMotion ? ' is-reduced-motion' : ''}`} aria-label="门前场景">
    <div className="door-view">
      <div ref={stageRef} className="door-stage">
        <div className="door-world">
          <img className="door-layer door-base" data-depth="0" src={layers[0].src} alt="" />
          <canvas ref={portalRef} className="door-portal" aria-hidden="true" />
          {layers.slice(1).map(layer => <img key={layer.name} className={`door-layer door-${layer.name}`} data-depth={layer.depth} src={layer.src} alt="" />)}
          <div className="door-vignette" aria-hidden="true" />
          <div className="door-shade" aria-hidden="true" />
          <canvas ref={fxRef} className="door-fx" aria-hidden="true" />
          <canvas ref={spiritRef} className="door-layer door-spirit" data-depth=".05" aria-hidden="true" />
          <button className="door-hit" type="button" aria-label="推开门" onClick={begin} disabled={entering} />
          <p className="door-hint" aria-hidden="true">推 开 门</p>
        </div>
        <div className="door-flash" aria-hidden="true" />
      </div>
    </div>
    <p className="door-credit">门原画 · 程三一 老师</p>
    <button className="door-skip" type="button" onClick={skip} disabled={entering}>跳过</button>
    <svg className="door-filters" aria-hidden="true"><filter id="door-ripple" x="0" y="0" width="100%" height="100%"><feTurbulence ref={turbulenceRef} type="fractalNoise" baseFrequency=".004 .03" numOctaves="2" seed="3" result="noise" /><feDisplacementMap in="SourceGraphic" in2="noise" scale="6" xChannelSelector="R" yChannelSelector="G" /></filter></svg>
  </section>;
}
