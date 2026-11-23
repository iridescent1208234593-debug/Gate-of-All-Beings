import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

const TRACKS = {
  ext: new URL('./audio/lxh_demo1_ext.mp3', import.meta.url).href,
  demo2: new URL('./audio/lxh_demo2_unfinished.mp3', import.meta.url).href,
};
const STORAGE_KEY = 'zszm.door.bgm';
const LAST_TRACK_KEY = 'zszm.door.bgm.last';
const CROSSFADE = 1.2;
const MUTE_FADE = 0.8;
const MAIN_VOLUME = 0.7;
const SPLIT_MODE = new URLSearchParams(window.location.search).get('bgm') === 'split';

export type MusicChoice = 'auto' | 'ext' | 'demo2' | 'mute';
type TrackPlan = { track: 'ext' | 'demo2'; first: number; from: number; to: number; crossfade: number };
type AudioVoice = { gain: GainNode; track: TrackPlan['track']; sources: Set<AudioBufferSourceNode>; timer: number; alive: boolean; stop: (seconds: number) => void };
type OpeningMusicApi = {
  choice: MusicChoice;
  muted: boolean;
  choose: (choice: MusicChoice) => void;
  toggleMute: () => void;
  setInside: (inside: boolean) => void;
};

const EXT_DOOR: TrackPlan = { track: 'ext', first: 0, from: 0.75, to: 19, crossfade: 2.4 };
const EXT_INSIDE: TrackPlan = { track: 'ext', first: 19.3, from: 33, to: 52.74, crossfade: 3 };
const DEMO2_LOOP: TrackPlan = { track: 'demo2', first: 0, from: 0.75, to: 19.5, crossfade: 2.6 };
const readChoice = (key: string, fallback: string) => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
const writeChoice = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* storage can be unavailable */ } };
const isChoice = (value: string): value is MusicChoice => value === 'auto' || value === 'ext' || value === 'demo2' || value === 'mute';

const MusicContext = createContext<OpeningMusicApi | null>(null);

export function OpeningMusicProvider({ children }: { children: ReactNode }) {
  const initial = readChoice(STORAGE_KEY, 'auto');
  const [choice, setChoice] = useState<MusicChoice>(isChoice(initial) ? initial : 'auto');
  const choiceRef = useRef<MusicChoice>(isChoice(initial) ? initial : 'auto');
  const initialLast = readChoice(LAST_TRACK_KEY, 'auto');
  const lastTrack = useRef<'auto' | 'ext' | 'demo2'>(initialLast === 'ext' || initialLast === 'demo2' ? initialLast : 'auto');
  const phase = useRef(false);
  const enteredAt = useRef(0);
  const sequence = useRef(0);
  const context = useRef<AudioContext | null>(null);
  const master = useRef<GainNode | null>(null);
  const cache = useRef(new Map<string, AudioBuffer>());
  const loading = useRef(new Map<string, Promise<AudioBuffer>>());
  const voice = useRef<AudioVoice | null>(null);
  const fetches = useRef<AbortController | null>(null);
  const retireTimers = useRef(new Set<number>());
  const [started, setStarted] = useState(false);
  const muted = choice === 'mute';

  const effectiveChoice = useCallback(() => choiceRef.current === 'mute' ? lastTrack.current : choiceRef.current, []);
  const getPlan = useCallback((forInside = phase.current): TrackPlan => {
    const selected = effectiveChoice();
    if (selected === 'auto' && SPLIT_MODE && !forInside) return DEMO2_LOOP;
    if (selected === 'auto' && SPLIT_MODE && forInside) return { ...EXT_INSIDE };
    if (selected === 'demo2') return { ...DEMO2_LOOP, first: forInside ? 0.75 : DEMO2_LOOP.first };
    if (forInside) {
      const recentEntry = performance.now() - enteredAt.current < 6000;
      return recentEntry ? EXT_INSIDE : { ...EXT_INSIDE, first: EXT_INSIDE.from };
    }
    return EXT_DOOR;
  }, [effectiveChoice]);

  const ensureAudio = useCallback(() => {
    if (context.current) return context.current;
    const AudioContextCtor = window.AudioContext;
    if (!AudioContextCtor) return null;
    try {
      const ctx = new AudioContextCtor();
      const out = ctx.createGain();
      out.gain.value = 0;
      out.connect(ctx.destination);
      context.current = ctx;
      fetches.current = new AbortController();
      master.current = out;
      return ctx;
    } catch { return null; }
  }, []);

  const getBuffer = useCallback((track: TrackPlan['track']) => {
    const url = TRACKS[track];
    const existing = cache.current.get(url);
    if (existing) return Promise.resolve(existing);
    const pending = loading.current.get(url);
    if (pending) return pending;
    const ctx = ensureAudio();
    if (!ctx) return Promise.reject(new Error('Audio unavailable'));
    const request = fetch(url, { signal: fetches.current?.signal }).then(response => {
      if (!response.ok) throw new Error(`Audio request failed: ${response.status}`);
      return response.arrayBuffer();
    }).then(data => ctx.decodeAudioData(data)).then(buffer => {
      if (context.current === ctx) cache.current.set(url, buffer);
      return buffer;
    }).finally(() => {
      if (loading.current.get(url) === request) loading.current.delete(url);
    });
    loading.current.set(url, request);
    return request;
  }, [ensureAudio]);

  const makeVoice = useCallback((plan: TrackPlan, fadeIn: number): AudioVoice => {
    const ctx = context.current!;
    const buffer = cache.current.get(TRACKS[plan.track])!;
    const gain = ctx.createGain();
    gain.connect(master.current!);
    const active: AudioVoice = { gain, track: plan.track, sources: new Set(), timer: 0, alive: true, stop: () => {} };
    const up = new Float32Array(64), down = new Float32Array(64);
    for (let i = 0; i < up.length; i++) { const p = i / (up.length - 1); up[i] = Math.sin(p * Math.PI / 2); down[i] = Math.cos(p * Math.PI / 2); }
    const schedule = (when: number, offset: number, initialFade: number) => {
      if (!active.alive) return;
      const source = ctx.createBufferSource(), segmentGain = ctx.createGain();
      source.buffer = buffer; source.connect(segmentGain); segmentGain.connect(gain);
      const end = Math.min(plan.to, buffer.duration), length = end - offset;
      if (initialFade) segmentGain.gain.setValueCurveAtTime(up, when, initialFade);
      else segmentGain.gain.setValueAtTime(1, when);
      segmentGain.gain.setValueCurveAtTime(down, when + length - plan.crossfade, plan.crossfade);
      source.start(when, offset); source.stop(when + length + 0.05);
      active.sources.add(source);
      source.onended = () => {
        active.sources.delete(source);
        source.disconnect();
        segmentGain.disconnect();
      };
      const next = when + length - plan.crossfade;
      active.timer = window.setTimeout(() => schedule(next, plan.from, plan.crossfade), Math.max(0, (next - ctx.currentTime - 1.5) * 1000));
    };
    schedule(ctx.currentTime + 0.05, plan.first, fadeIn);
    active.stop = seconds => {
      if (!active.alive) return;
      active.alive = false; window.clearTimeout(active.timer);
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + seconds);
      for (const source of active.sources) { try { source.stop(now + seconds + 0.05); } catch { /* already stopped */ } }
      if (!seconds) {
        gain.disconnect();
        return;
      }
      const timer = window.setTimeout(() => {
        retireTimers.current.delete(timer);
        gain.disconnect();
      }, (seconds + 0.2) * 1000);
      retireTimers.current.add(timer);
    };
    return active;
  }, []);

  const setMuted = useCallback((next: boolean) => {
    const ctx = context.current, out = master.current;
    if (!ctx || !out || !started) return;
    const now = ctx.currentTime;
    out.gain.cancelScheduledValues(now);
    out.gain.setValueAtTime(out.gain.value, now);
    out.gain.linearRampToValueAtTime(next ? 0 : MAIN_VOLUME, now + MUTE_FADE);
  }, [started]);

  const start = useCallback(async (fadeIn = 3) => {
    if (started || document.hidden || choiceRef.current === 'mute') return;
    const ctx = ensureAudio();
    if (!ctx) return;
    try { await ctx.resume(); } catch { return; }
    if (context.current !== ctx || document.hidden) return;
    let plan = getPlan();
    try {
      await getBuffer(plan.track);
      let latest = getPlan();
      while (context.current === ctx && latest.track !== plan.track) {
        plan = latest;
        await getBuffer(plan.track);
        latest = getPlan();
      }
      plan = latest;
    } catch { return; }
    // The choice can change while decodeAudioData is pending; read the mutable ref again.
    const currentChoice = choiceRef.current as MusicChoice;
    if (context.current !== ctx || document.hidden || ctx.state !== 'running' || currentChoice === 'mute' || voice.current) return;
    const out = master.current!;
    const now = ctx.currentTime + 0.05;
    out.gain.setValueAtTime(0, now);
    out.gain.linearRampToValueAtTime(MAIN_VOLUME, now + fadeIn);
    voice.current = makeVoice(plan, 0);
    setStarted(true);
  }, [ensureAudio, getBuffer, getPlan, makeVoice, started]);

  const switchTo = useCallback(async (plan: TrackPlan) => {
    if (!started) { void start(); return; }
    const sequenceId = ++sequence.current;
    try { await getBuffer(plan.track); } catch { return; }
    if (sequenceId !== sequence.current || !context.current || !voice.current) return;
    const current = voice.current;
    if (current.track === plan.track) return;
    current.stop(CROSSFADE);
    voice.current = makeVoice(plan, CROSSFADE);
  }, [getBuffer, makeVoice, start, started]);

  const choose = useCallback((next: MusicChoice) => {
    if (!isChoice(next)) return;
    sequence.current++;
    const previousTrack = voice.current?.track ?? null;
    choiceRef.current = next;
    setChoice(next);
    writeChoice(STORAGE_KEY, next);
    if (next === 'mute') {
      if (choice !== 'mute') lastTrack.current = choice;
      writeChoice(LAST_TRACK_KEY, lastTrack.current);
      setMuted(true);
      return;
    }
    lastTrack.current = next;
    writeChoice(LAST_TRACK_KEY, next);
    if (choice === 'mute') setMuted(false);
    if (!started) { void start(3); return; }
    const plan = getPlan();
    if (plan.track !== previousTrack) void switchTo(plan);
  }, [choice, getPlan, setMuted, start, started, switchTo]);

  const toggleMute = useCallback(() => {
    if (!started && choice !== 'mute') { void start(); return; }
    if (choice === 'mute') choose(lastTrack.current);
    else choose('mute');
  }, [choice, choose, start, started]);

  const setInside = useCallback((next: boolean) => {
    if (phase.current === next) return;
    sequence.current++;
    phase.current = next;
    if (next) enteredAt.current = performance.now();
    if (started && choice !== 'mute') void switchTo(getPlan(next));
  }, [choice, getPlan, started, switchTo]);

  const startRef = useRef(start);
  startRef.current = start;
  useEffect(() => { void start(); }, [start]);
  useEffect(() => {
    const onGesture = () => { void startRef.current(); };
    const onVisibility = () => {
      const ctx = context.current;
      if (!ctx) return;
      if (document.hidden) void ctx.suspend().catch(() => {});
      else if (voice.current) void ctx.resume().catch(() => {});
      else void startRef.current();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pointerdown', onGesture, { once: true, capture: true });
    window.addEventListener('keydown', onGesture, { once: true, capture: true });
    return () => {
      window.removeEventListener('pointerdown', onGesture, { capture: true });
      window.removeEventListener('keydown', onGesture, { capture: true });
      document.removeEventListener('visibilitychange', onVisibility);
      ++sequence.current;
      voice.current?.stop(0);
      voice.current = null;
      for (const timer of retireTimers.current) window.clearTimeout(timer);
      retireTimers.current.clear();
      fetches.current?.abort();
      fetches.current = null;
      loading.current.clear();
      cache.current.clear();
      const ctx = context.current;
      context.current = null;
      master.current?.disconnect();
      master.current = null;
      if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => {});
    };
  }, []);

  const value = useMemo(() => ({ choice, muted, choose, toggleMute, setInside }), [choice, muted, choose, toggleMute, setInside]);
  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
}

export function useOpeningMusic() {
  const value = useContext(MusicContext);
  if (!value) throw new Error('useOpeningMusic must be used within OpeningMusicProvider');
  return value;
}
