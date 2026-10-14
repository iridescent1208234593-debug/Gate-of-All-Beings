import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { ReferenceScene2D } from '../components/reference/ReferenceScene2D';
import { ReferenceScene3D } from '../components/reference/ReferenceScene3D';
import { ALL_LAYERS, DURATION } from '../components/reference/sceneModel';
import { speakGreeting } from '../utils/sound';
import type { ThemeMode } from '../types';
import '../components/reference/reference.css';
import './gate.css';

/**
 * 开场加载页：全屏复用复现场景的 3D 渲染逻辑，叠加标题、可拖动的进度条与「进入众生之门」按钮。
 * 与卡牌主游戏完全解耦——本组件只负责开场，主游戏由 GameShell 决定何时挂载。
 */
const GATE_LAYERS = { ...ALL_LAYERS, text: false }; // 隐去场景内的标题图层，避免与页面标题重影
const MIN_WAIT = 2.5;   // 最短停留：让场景「门扉展开」的动画走完，避免一闪而过
const FORCE_WAIT = 4.5; // 场景迟迟不就绪时的兜底时间，同时也是降级 2D 的阈值
const FRAME_CAP = 1 / 30; // 进度与场景时钟按 30fps 更新
const SPEAK_AT = 2.5;   // 场景展开完成后补回原版开场问候音
const GREETING = '你好，欢迎来到众生门';
// 右上角配色控件：每次加载随机取一套，随时可手动切换
const THEMES: { id: ThemeMode; label: string; color: string }[] = [
  { id: 'original', label: 'Classic Night', color: '#85A96F' },
  { id: 'twilight', label: 'Twilight Blue', color: '#74B9FF' },
  { id: 'emerald', label: 'Emerald Forest', color: '#2ED573' },
  { id: 'golden', label: 'Golden Dusk', color: '#F3C248' },
  { id: 'cyber', label: 'Cyber Neon', color: '#FD79A8' },
];

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export function EntryGate({ leaving, onEnter, onSkip }: { leaving: boolean; onEnter: () => void; onSkip: () => void }) {
  const [clock, setClock] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);
  const [webgl] = useState(hasWebGL);
  const [theme, setTheme] = useState<ThemeMode>(() => THEMES[Math.floor(Math.random() * THEMES.length)].id);
  const [soundOn, setSoundOn] = useState(true);
  const [unlocked, setUnlocked] = useState(false); // 音频需先由用户手势解锁，否则浏览器会拒绝播放
  const [gateOpen, setGateOpen] = useState(false); // 门一旦开启便保持可用：把进度拖回去也不会让「进入」失效
  const playing = useRef(true); // 默认只播一遍：推进到 DURATION 后停下，拖动进度条后交用户控制
  const spoken = useRef(false);

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
    let raf = 0;
    let last = 0;
    let acc = 0;
    const step = (time: number) => {
      raf = requestAnimationFrame(step);
      if (!last) last = time;
      acc += (time - last) / 1000;
      last = time;
      if (acc < FRAME_CAP) return;
      const dt = acc;
      acc = 0;
      if (!playing.current) return;
      setClock(value => {
        const next = Math.min(DURATION, value + dt);
        if (next >= DURATION) playing.current = false;
        return next;
      });
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  // 场景秒数单调走完一遍后定格，不再往复呼吸
  const seconds = Math.min(DURATION, clock);
  const ratio = seconds / DURATION;
  // 门开启后不再收回：拖动进度条回看动画时，「进入」按钮依旧可点
  useEffect(() => {
    if (gateOpen) return;
    if ((sceneReady && seconds >= MIN_WAIT) || seconds >= FORCE_WAIT) setGateOpen(true);
  }, [gateOpen, sceneReady, seconds]);
  const usable = gateOpen;
  // 3D 走不动（设备无 WebGL 或初始化超时）时，退回 2D 矢量场景
  const use3D = webgl && (sceneReady || clock < FORCE_WAIT);

  // 手势解锁后、场景展开完成时补回原版开场音频（CDN 原声，失败再退回语音合成）
  useEffect(() => {
    if (leaving || !soundOn || !unlocked || spoken.current || seconds < SPEAK_AT) return;
    spoken.current = true;
    speakGreeting(GREETING);
  }, [leaving, soundOn, unlocked, seconds]);

  function seek(value: number) {
    playing.current = false; // 接管后不再自动推进，便于停在任意一帧
    setClock(Math.max(0, Math.min(DURATION, value)));
  }

  return (
    <section className={`gate ${leaving ? 'is-leaving' : ''}`} aria-label="众生之门 开场">
      <div className="gate-stage" aria-hidden="true">
        {use3D
          ? <ReferenceScene3D seconds={seconds} theme={theme} layers={GATE_LAYERS} resetView={0} onReady={() => setSceneReady(true)} />
          : <ReferenceScene2D seconds={seconds} theme={theme} layers={GATE_LAYERS} />}
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
        <button
          type="button"
          className="gate-sound"
          onClick={() => { setSoundOn(on => { if (!on) spoken.current = false; return !on; }); }}
          title={soundOn ? '关闭声音' : '开启声音'}
          aria-label={soundOn ? '关闭声音' : '开启声音'}
          aria-pressed={soundOn}
        >
          {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
        </button>
      </div>
      <div className="gate-content">
        <p className="gate-eyebrow">罗小黑战记 · 非商业同人</p>
        <h1 className="gate-title">众生之门</h1>
        <p className="gate-subtitle">THE GATE OF ALL BEINGS</p>
        <p className="gate-hint">单指旋转 · 双指缩放</p>
        <button className="gate-enter" disabled={!usable} onClick={onEnter}>进入众生之门</button>
        <button className="gate-skip" type="button" onClick={onSkip}>跳过 / Skip</button>
        <p className="gate-progress">
          <span>{usable ? '门已开启' : '正在开启众生之门…'}</span>
          <span className="gate-bar">
            <i style={{ width: `${ratio * 100}%` }} />
            <input
              className="gate-range"
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
        </p>
      </div>
    </section>
  );
}
