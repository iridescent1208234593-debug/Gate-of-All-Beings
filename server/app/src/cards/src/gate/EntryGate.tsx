import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import '@lxh/shared-ui/lxh-ui.css';
import '@lxh/shared-ui/lxh-intro.js';
import '@lxh/shared-ui/intro-controls.css';
import { ReferenceScene2D } from '../components/reference/ReferenceScene2D';
import { ALL_LAYERS, DURATION } from '../components/reference/sceneModel';
import type { GateSceneHandle } from '../embed/gateEmbed';
import { speakGreeting } from '../utils/sound';
import { useOpeningMusic, type MusicChoice } from './OpeningMusic';
import type { ThemeMode } from '../types';
import '../components/reference/reference.css';
import './gate.css';

const GATE_LAYERS = { ...ALL_LAYERS, text: false };
const MIN_WAIT = 2.5;
const FRAME_CAP = 1 / 30;
const SPEAK_AT = 2.5;
const GREETING = '你好，欢迎来到众生门';
const THEMES: { id: ThemeMode; label: string; color: string }[] = [
  { id: 'original', label: 'Classic Night', color: '#85A96F' },
  { id: 'twilight', label: 'Twilight Blue', color: '#74B9FF' },
  { id: 'emerald', label: 'Emerald Forest', color: '#2ED573' },
  { id: 'golden', label: 'Golden Dusk', color: '#F3C248' },
  { id: 'cyber', label: 'Cyber Neon', color: '#FD79A8' },
];
const FIRST_FRAME_MARK = 'gate:first-frame';
const MUSIC_CHOICES: { id: MusicChoice; label: string; detail?: string }[] = [
  { id: 'auto', label: '自动', detail: '推荐' },
  { id: 'ext', label: '配乐 1', detail: 'lxh demo1延长' },
  { id: 'demo2', label: '配乐 2', detail: 'lxh demo2 · 试听 / 未完成' },
  { id: 'mute', label: '静音' },
];

// The single first-frame measure for ops/perf/zszm-startup.mjs: the first drawn scene frame
// (3D render or 2D fallback). The 2D placeholder shown while the runtime loads is empty at t=0.
function markFirstFrame() {
  if (!performance.getEntriesByName(FIRST_FRAME_MARK, 'mark').length) performance.mark(FIRST_FRAME_MARK);
}

// paused: held while something covers the intro (the phone rotate prompt), resumed where it stopped.
export function EntryGate({ leaving, paused = false, onEnter, onSkip }: { leaving: boolean; paused?: boolean; onEnter: () => void; onSkip: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GateSceneHandle | null>(null);
  const fallbackPlaying = useRef(true);
  const fallbackTime = useRef(0);
  const spoken = useRef(false);
  const rangeRef = useRef<HTMLInputElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const musicMenuRef = useRef<HTMLDivElement>(null);
  const musicButtonRef = useRef<HTMLButtonElement>(null);
  const musicMenuRootRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<ThemeMode>('original');
  const lastUiUpdate = useRef(0);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const syncPlayback = useRef(() => {});
  const [clock, setClock] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);
  const [using3D, setUsing3D] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => THEMES[Math.floor(Math.random() * THEMES.length)].id);
  const [musicMenuOpen, setMusicMenuOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const music = useOpeningMusic();
  themeRef.current = theme;

  useEffect(() => window.LXHIntro.bindSkip(skipRef.current, onSkip), [onSkip]);

  useEffect(() => {
    const unlock = () => setUnlocked(true);
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let fallbackRaf = 0;
    let lastTime = 0;
    let elapsed = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const fallbackTick = (time: number) => {
      fallbackRaf = 0;
      if (cancelled || document.hidden || pausedRef.current || !fallbackPlaying.current) return;
      if (!lastTime) lastTime = time;
      elapsed += (time - lastTime) / 1000;
      lastTime = time;
      if (elapsed >= FRAME_CAP) {
        const step = elapsed;
        elapsed = 0;
        fallbackTime.current = Math.min(DURATION, fallbackTime.current + step);
        setClock(fallbackTime.current);
        if (fallbackTime.current >= MIN_WAIT) setGateOpen(true);
        if (fallbackTime.current >= DURATION) fallbackPlaying.current = false;
      }
      if (fallbackPlaying.current) fallbackRaf = requestAnimationFrame(fallbackTick);
    };

    let fallbackStarted = false;
    const startFallback = () => {
      if (cancelled) return;
      fallbackStarted = true;
      markFirstFrame();
      setSceneReady(true);
      setUsing3D(false);
      if (reducedMotion.matches) {
        fallbackPlaying.current = false;
        fallbackTime.current = DURATION;
        setClock(DURATION);
        setGateOpen(true);
      } else {
        fallbackPlaying.current = true;
        if (!pausedRef.current) fallbackRaf = requestAnimationFrame(fallbackTick);
      }
    };

    const onVisibilityChange = () => {
      const scene = sceneRef.current;
      if (document.hidden || pausedRef.current) {
        scene?.pause();
        if (fallbackRaf) cancelAnimationFrame(fallbackRaf);
        fallbackRaf = 0;
      } else if (scene) {
        if (!reducedMotion.matches && scene.getTime() < DURATION) scene.play();
      } else if (fallbackStarted && fallbackPlaying.current && !fallbackRaf) {
        lastTime = 0;
        fallbackRaf = requestAnimationFrame(fallbackTick);
      }
    };
    syncPlayback.current = onVisibilityChange;

    const onMotionChange = (event: MediaQueryListEvent) => {
      if (!event.matches) return;
      sceneRef.current?.seek(DURATION);
      fallbackPlaying.current = false;
      fallbackTime.current = DURATION;
      setClock(DURATION);
      setGateOpen(true);
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    reducedMotion.addEventListener('change', onMotionChange);

    void import('../embed/gateEmbed').then(({ LXHGate }) => {
      if (cancelled) return;
      const host = hostRef.current;
      if (!host || !LXHGate.hasWebGL()) {
        startFallback();
        return;
      }

      try {
        const scene = LXHGate.createScene(host, {
          theme: themeRef.current,
          autoplay: false,
          layers: GATE_LAYERS,
          interactive: true,
          scrollFriendly: false,
          pixelRatio: 1.5,
          onFrame: ({ t }) => {
            markFirstFrame();
            const now = performance.now();
            if (t >= DURATION || now - lastUiUpdate.current >= 1000 * FRAME_CAP) {
              lastUiUpdate.current = now;
              setClock(t);
            }
            if (t >= MIN_WAIT) setGateOpen(true);
          },
          onGateOpen: () => setGateOpen(true),
        });
        if (!scene) {
          startFallback();
          return;
        }
        sceneRef.current = scene;
        setUsing3D(true);
        setSceneReady(true);
        if (reducedMotion.matches) {
          scene.seek(DURATION);
          setClock(DURATION);
          setGateOpen(true);
        } else if (!document.hidden && !pausedRef.current) {
          scene.play();
        }
      } catch (error) {
        console.warn('[众生之门] 开场场景初始化失败：', error);
        startFallback();
      }
    }).catch(error => {
      console.warn('[众生之门] 开场动画资源加载失败：', error);
      startFallback();
    });

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      reducedMotion.removeEventListener('change', onMotionChange);
      if (fallbackRaf) cancelAnimationFrame(fallbackRaf);
      sceneRef.current?.destroy();
      sceneRef.current = null;
      syncPlayback.current = () => {};
    };
  }, []);
  const wasPaused = useRef(paused);
  useEffect(() => {
    if (wasPaused.current === paused) return;
    wasPaused.current = paused;
    syncPlayback.current();
  }, [paused]);

  const seconds = Math.min(DURATION, clock);
  useEffect(() => { window.LXHIntro.syncProgress(rangeRef.current, seconds, DURATION); }, [seconds]);
  useEffect(() => {
    if (sceneReady && seconds >= MIN_WAIT) setGateOpen(true);
  }, [sceneReady, seconds]);
  useEffect(() => { sceneRef.current?.setTheme(theme); }, [theme]);
  useEffect(() => {
    if (leaving || music.muted || !unlocked || spoken.current || seconds < SPEAK_AT) return;
    spoken.current = true;
    speakGreeting(GREETING);
  }, [leaving, music.muted, unlocked, seconds]);

  useEffect(() => {
    if (!musicMenuOpen) return;
    const selected = musicMenuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]');
    (selected || musicMenuRef.current?.querySelector<HTMLButtonElement>('button'))?.focus({ preventScroll: true });
    const onPointerDown = (event: PointerEvent) => {
      if (!musicMenuRootRef.current?.contains(event.target as Node)) setMusicMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation();
        setMusicMenuOpen(false);
        musicButtonRef.current?.focus({ preventScroll: true });
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const items = [...(musicMenuRef.current?.querySelectorAll<HTMLButtonElement>('[data-music-choice]') || [])];
        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        if (!items.length) return;
        event.preventDefault();
        items[(index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [music.choice, musicMenuOpen]);

  function seek(value: number) {
    const next = Math.max(0, Math.min(DURATION, value));
    fallbackPlaying.current = false;
    fallbackTime.current = next;
    sceneRef.current?.seek(next);
    setClock(next);
    if (next >= MIN_WAIT) setGateOpen(true);
  }

  return (
    <section className={`gate ${leaving ? 'is-leaving' : ''}`} aria-label="众生之门 开场">
      <div className="gate-stage" aria-hidden="true">
        <div ref={hostRef} className="gate-scene-host" />
        {!using3D && <ReferenceScene2D seconds={seconds} theme={theme} layers={GATE_LAYERS} />}
      </div>
      <div className="gate-veil" aria-hidden="true" />
      <div className="gate-tools">
        {THEMES.map(t => (
          <button
            key={t.id}
            type="button"
            className={`gate-swatch ${theme === t.id ? 'is-active' : ''}`}
            style={{ background: t.color }}
            title={`配色：${t.label}`}
            aria-label={`切换到配色 ${t.label}`}
            aria-pressed={theme === t.id}
            onClick={() => setTheme(t.id)}
          />
        ))}
        <div className="gate-audio-choice" ref={musicMenuRootRef}>
          <button
            type="button"
            className="gate-sound"
            onClick={() => { if (music.muted) spoken.current = false; music.toggleMute(); }}
            title={music.muted ? '开启声音' : '关闭声音'}
            aria-label={music.muted ? '开启声音' : '关闭声音'}
            aria-pressed={!music.muted}
          >
            {music.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <button
            ref={musicButtonRef}
            type="button"
            className="gate-music-button"
            aria-haspopup="menu"
            aria-expanded={musicMenuOpen}
            aria-controls="gate-music-menu"
            title="选择开场配乐"
            onClick={() => setMusicMenuOpen(open => !open)}
          >曲 · {music.choice === 'demo2' ? '配乐 2' : music.choice === 'ext' ? '配乐 1' : music.choice === 'mute' ? '静音' : '自动'}</button>
          <div id="gate-music-menu" ref={musicMenuRef} className="gate-music-menu" role="menu" aria-label="开场配乐" hidden={!musicMenuOpen}>
            {MUSIC_CHOICES.map(option => (
              <button key={option.id} type="button" role="menuitemradio" data-music-choice={option.id} aria-checked={music.choice === option.id}
                onClick={() => { if (option.id !== 'mute') spoken.current = false; music.choose(option.id); setMusicMenuOpen(false); musicButtonRef.current?.focus({ preventScroll: true }); }}>
                <span>{option.label}</span>{option.detail && <small>{option.detail}</small>}
              </button>
            ))}
            <p>配乐 · 小废物 老师</p>
          </div>
        </div>
        <span className="gate-language-host" />
      </div>
      <img className="gate-mark" src="https://iridescently.xyz/assets/iridescently-mark.png" alt="Iridescently" />
      <div className="gate-content">
        <p className="gate-eyebrow">罗小黑战记 · 非商业同人</p>
        <h1 className="gate-title">众生之门</h1>
        <p className="gate-subtitle">THE GATE OF ALL BEINGS</p>
        <p className="gate-hint">单指旋转 · 双指缩放</p>
        <button className="gate-enter" disabled={!gateOpen} onClick={onEnter}>进入众生之门</button>
        <p className="gate-progress">
          <span>{gateOpen ? '门已开启' : sceneReady ? '正在开启众生之门…' : '正在准备开场…'}</span>
          <span className="gate-bar lxh-intro-track">
            <input
              ref={rangeRef}
              className="gate-range lxh-intro-range"
              type="range"
              min={0}
              max={DURATION}
              step={0.05}
              value={seconds}
              aria-label="开场动画进度"
              aria-valuetext={`${seconds.toFixed(1)} / ${DURATION} 秒`}
              onChange={event => seek(Number(event.target.value))}
            />
          </span>
          <span className="gate-progress-time"><time>{window.LXHIntro.formatTime(seconds)}</time><span>/</span><time>{window.LXHIntro.formatTime(DURATION)}</time></span>
        </p>
      </div>
      <button ref={skipRef} className="gate-skip lxh-intro-skip" type="button">跳过 ↘</button>
    </section>
  );
}
