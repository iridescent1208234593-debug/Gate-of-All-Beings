import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Sparkles, Volume2, HelpCircle, Film, RefreshCw, Video, LogIn, LogOut, Box, Layers, ArrowLeft, Flame } from 'lucide-react';
import { ReferenceStage } from './components/reference/ReferenceStage';
import { SpiritGatheringScene, PHASES, type GatheringPhase } from './components/SpiritGatheringScene';
import { SpiritDispersalScene, DISPERSAL_PHASES, type DispersalPhase } from './components/SpiritDispersalScene';
import { ControlBar } from './components/ControlBar';
import { AudioVoiceSubtitle } from './components/AudioVoiceSubtitle';
import { LayerInspector } from './components/LayerInspector';
import { VideoCompareView } from './components/VideoCompareView';
import { ThemeMode } from './types';
import { speakGreeting } from './utils/sound';

type ViewMode = 'menu' | 'video' | '3d' | '2d' | 'juling' | 'sanling';

export default function App() {
  // Animation state
   const JULING_DURATION = 120.0; // 聚灵漫长过程 - 120秒
  const SANLING_DURATION = 60.0; // 散灵动画时长（60秒）
  const DURATION = 6.0; // Total duration in seconds (matches 6s original video)
  const [progress, setProgress] = useState(() => Math.max(0,Math.min(1,Number(new URLSearchParams(location.search).get('t')||0)/6)));
  const [isPlaying, setIsPlaying] = useState(() => !new URLSearchParams(location.search).has('t'));
  const [speed, setSpeed] = useState(1.0);
  const [loop, setLoop] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [is3DMode, setIs3DMode] = useState(() => new URLSearchParams(location.search).get('view')!=='2d');
  const [theme, setTheme] = useState<ThemeMode>('original');
  const [showInspector, setShowInspector] = useState(false);
  const [showVideoCompare, setShowVideoCompare] = useState(false);
  const [clickedCreature, setClickedCreature] = useState<string | null>(null);
  const [gatheringPhase, setGatheringPhase] = useState<GatheringPhase>('primordial');
  const [dispersalPhase, setDispersalPhase] = useState<DispersalPhase>('complete');

  // View selection page: menu | video | 3d | 2d | juling
  const [viewMode, setViewMode] = useState<ViewMode>(() => {const v=new URLSearchParams(location.search).get('view');return v==='2d'||v==='3d'?v:'menu';});
  const activeDuration = viewMode === 'juling' ? JULING_DURATION : viewMode === 'sanling' ? SANLING_DURATION : DURATION;

  // User login state
  const [user, setUser] = useState<{ logged_in: boolean; nickname?: string; picture?: string } | null>(null);
  useEffect(() => {
    fetch(import.meta.env.BASE_URL + "api/user").then(r => r.json()).then(setUser).catch(() => setUser({ logged_in: false }));
  }, []);

  // Visible animation layers
  const [visibleLayers, setVisibleLayers] = useState({
    moon: true,
    creatures: true,
    bushes: true,
    gate: true,
    text: true,
  });

  // Animation ticker loop
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const activeVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const updateAnimation = (time: number) => {
      if (lastTimeRef.current !== null && isPlaying) {
        const delta = (time - lastTimeRef.current) / 1000; // in seconds
        setProgress((prev) => {
          let next = prev + (delta * speed) / activeDuration;
          if (next >= 1) {
            if (loop) {
              next = 0;
            } else {
              next = 1;
              setIsPlaying(false);
            }
          }
          return next;
        });
      }
      lastTimeRef.current = time;
      requestRef.current = requestAnimationFrame(updateAnimation);
    };

    if (isPlaying) {
      requestRef.current = requestAnimationFrame(updateAnimation);
    } else {
      lastTimeRef.current = null;
    }

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, speed, loop, viewMode]);

  // Voice speech trigger at complete milestone (progress >= 0.85)
  const hasSpokenRef = useRef(false);
  useEffect(() => {
    if (viewMode === '2d' || viewMode === '3d') return;
    if (progress < 0.1) {
      hasSpokenRef.current = false;
    }
    if (progress >= 0.85 && !hasSpokenRef.current && soundEnabled && isPlaying) {
      hasSpokenRef.current = true;
      speakGreeting('你好，欢迎来到众生门', undefined, activeVideoRef.current);
    }
  }, [progress, soundEnabled, isPlaying, viewMode]);

  // 2D/3D 模式下关闭原视频对比时解绑视频引用，语音问候回退到 CDN 原声
  useEffect(() => {
    if ((viewMode === '2d' || viewMode === '3d') && !showVideoCompare) {
      activeVideoRef.current = null;
    }
  }, [viewMode, showVideoCompare]);

  // Controls handlers
  const handlePlayToggle = () => {
    if (progress >= 1) setProgress(0);
    setIsPlaying(!isPlaying);
  };

  const handleReplay = () => {
    setProgress(0);
    setIsPlaying(true);
    hasSpokenRef.current = false;
  };

  const handleSeek = (val: number) => {
    setIsPlaying(false);
    setProgress(val);
  };

  const handleCreatureClick = (name: string) => {
    setClickedCreature(name);
    setTimeout(() => setClickedCreature(null), 3000);
  };

  const handleSpeakVoice = () => {
    speakGreeting('你好，欢迎来到众生门', undefined, activeVideoRef.current);
  };

  // Enter a view mode
  const enterView = (mode: ViewMode) => {
    setIs3DMode(mode === '3d');
    setViewMode(mode);
    setProgress(0);
    setIsPlaying(true);
    hasSpokenRef.current = false;
  };

  // Jump to keyframes (for 6.0s duration)
  const keyframeMilestones = [
    { label: '1.0s 星光成球', val: 1/6, desc: '星光聚集，圆月出现' },
    { label: '2.0s 植物展开', val: 2/6, desc: '基座和植物依次展开' },
    { label: '2.7s 灵体显现', val: 2.7/6, desc: '鹿灵、鲸灵与团子灵' },
    { label: '3.2s 标志展开', val: 3.2/6, desc: '图形文字逐渐显现' },
    { label: '4.0s 完整展示', val: 4/6, desc: '完整构图定格' },
  ];

  const julingKeyframes = PHASES.map((ph) => ({
    label: `${(ph.startTime * JULING_DURATION).toFixed(1)}s ${ph.label}`,
    val: ph.startTime,
    desc: ph.description,
  }));

  const sanlingKeyframes = DISPERSAL_PHASES.map((ph) => ({
    label: `${(ph.startTime * SANLING_DURATION).toFixed(1)}s ${ph.label}`,
    val: ph.startTime,
    desc: ph.description,
  }));

  const activeKeyframes = viewMode === 'juling' ? julingKeyframes : viewMode === 'sanling' ? sanlingKeyframes : keyframeMilestones;


  // ========== 选择页 ==========
  const renderMenu = () => (
    <main className="w-full max-w-4xl my-6 flex flex-col items-center gap-8">
      <h2 className="qc-h2 w-full">选择复现模式</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 w-full">
        {/* 原视频 */}
        <button
          onClick={() => enterView('video')}
          className="group qc-card qc-card--hover p-8 flex flex-col items-center gap-4 cursor-pointer"
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform" style={{ background: 'var(--qc-accent)' }}>
            <Film className="w-8 h-8 text-white" />
          </div>
          <div className="text-lg font-bold tracking-wide">原视频</div>
          <p className="qc-hint text-center leading-relaxed">导入并播放原始视频，逐帧对照复现效果</p>
          <span className="mt-auto qc-tag qc-tag--accent">进入 →</span>
        </button>

        {/* 3D */}
        <button
          onClick={() => enterView('3d')}
          className="group qc-card qc-card--hover p-8 flex flex-col items-center gap-4 cursor-pointer"
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform" style={{ background: 'var(--qc-gold)' }}>
            <Box className="w-8 h-8 text-white" />
          </div>
          <div className="text-lg font-bold tracking-wide">3D 场景</div>
          <p className="qc-hint text-center leading-relaxed">立体视角还原灵质空间，支持视角旋转与实时交互</p>
          <span className="mt-auto qc-tag qc-tag--gold">进入 →</span>
        </button>

        {/* 2D */}
        <button
          onClick={() => enterView('2d')}
          className="group qc-card qc-card--hover p-8 flex flex-col items-center gap-4 cursor-pointer"
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform" style={{ background: 'var(--qc-accent)' }}>
            <Layers className="w-8 h-8 text-white" />
          </div>
          <div className="text-lg font-bold tracking-wide">2D 场景</div>
          <p className="qc-hint text-center leading-relaxed">平面视角复现星光吸附与众生门展开动画</p>
          <span className="mt-auto qc-tag qc-tag--accent">进入 →</span>
        </button>

        {/* 聚灵 */}
        <button
          onClick={() => enterView('juling')}
          className="group qc-card qc-card--hover p-8 flex flex-col items-center gap-4 cursor-pointer"
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform" style={{ background: 'var(--qc-gold)' }}>
            <Flame className="w-8 h-8 text-white" />
          </div>
          <div className="text-lg font-bold tracking-wide">聚灵诞生</div>
          <p className="qc-hint text-center leading-relaxed">生灵汇聚、物质灵交织，精灵成形，妖精诞生的完整聚灵过程</p>
          <span className="mt-auto qc-tag qc-tag--gold">进入 →</span>
        </button>
        {/* 散灵 */}
        <button
          onClick={() => enterView('sanling')}
          className="group qc-card qc-card--hover p-8 flex flex-col items-center gap-4 cursor-pointer"
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform" style={{ background: 'var(--qc-accent)' }}>
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <div className="text-lg font-bold tracking-wide">散灵回归</div>
          <p className="qc-hint text-center leading-relaxed">生灵飘散、身体渐透、化为漫天光点升空，温柔回归大地</p>
          <span className="mt-auto qc-tag qc-tag--accent">进入 →</span>
        </button>
      </div>
    </main>
  );

  const currentPhaseConfig = PHASES.find(p => p.name === gatheringPhase);
  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-3 sm:p-6">
      {/* Top Title Header */}
      <header className="w-full max-w-4xl flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--qc-border)]">
        <div className="flex items-center gap-3">
          {viewMode !== 'menu' && (
            <button
              onClick={() => setViewMode('menu')}
              className="qc-btn qc-btn--ghost qc-btn--sm flex items-center gap-1"
              title="返回选择页"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>返回选择</span>
            </button>
          )}

        </div>

        {/* Quick Phase Jump Buttons & Video Import Toggle */}
        <div className="flex flex-wrap items-center gap-1.5">
          {viewMode !== 'menu' && (
            <>
              {viewMode === '3d' || viewMode === '2d' ? (
                <button
                  onClick={() => setShowVideoCompare(!showVideoCompare)}
                  className={`qc-tab flex items-center gap-1 ${showVideoCompare ? 'is-active' : ''}`}
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>原视频导入对比</span>
                </button>
              ) : null}

              {activeKeyframes.map((m) => (
                <button
                  key={m.label}
                  onClick={() => {
                    setProgress(m.val);
                    setIsPlaying(false);
                  }}
                  className="qc-tab font-mono"
                  title={m.desc}
                >
                  {m.label}
                </button>
              ))}
            </>
          )}
        </div>
      </header>

      {/* ========== 选择页 / 主舞台 ========== */}
      {viewMode === 'menu' ? (
        renderMenu()
      ) : (
        <main className="w-full max-w-4xl my-4 flex flex-col items-center gap-4">
          {/* 原视频模式：专注原视频导入与播放 */}
          {viewMode === 'video' ? (
            <>
              <div className="w-full qc-banner qc-banner--accent py-2 text-xs" style={{ marginBottom: 0 }}>
                <Film className="w-4 h-4" style={{ color: 'var(--qc-accent)' }} />
                <span>原视频模式：导入本地原视频，与复现动画逐帧对照；点击右上角「返回选择」可切换 3D / 2D 模式</span>
              </div>
              <div className="w-full">
                <VideoCompareView
                  progress={progress}
                  duration={DURATION}
                  isPlaying={isPlaying}
                  soundEnabled={soundEnabled}
                  onSeek={handleSeek}
                  onVideoLoaded={(el) => {
                    activeVideoRef.current = el;
                  }}
                />
              </div>
              {/* Control Bar */}
              <ControlBar
                isPlaying={isPlaying}
                progress={progress}
                duration={DURATION}
                speed={speed}
                loop={loop}
                soundEnabled={soundEnabled}
                theme={theme}
                showInspector={showInspector}
                is3DMode={is3DMode}
                onToggle3DMode={() => setIs3DMode(!is3DMode)}
                onPlayToggle={handlePlayToggle}
                onReplay={handleReplay}
                onSeek={handleSeek}
                onSpeedChange={setSpeed}
                onLoopToggle={() => setLoop(!loop)}
                onSoundToggle={() => setSoundEnabled(!soundEnabled)}
                onThemeChange={setTheme}
                onToggleInspector={() => setShowInspector(!showInspector)}
                onSpeakVoice={handleSpeakVoice}
              />
            </>
          ) : viewMode === 'juling' ? (
            <>
              {/* 聚灵阶段指示 */}
              <div className="w-full qc-banner qc-banner--accent py-2 text-xs" style={{ marginBottom: 0, borderRadius: '999px' }}>
                <Flame className="w-4 h-4" style={{ color: 'var(--qc-accent)' }} />
                <span>{`聚灵阶段：${currentPhaseConfig?.label ?? gatheringPhase} — ${currentPhaseConfig?.description ?? ''}`}</span>
              </div>

              {/* 聚灵阶段进度条 */}
              <div className="w-full flex items-center gap-1 px-2">
                {PHASES.map((ph) => {
                  const isActive = gatheringPhase === ph.name;
                  const width = (ph.endTime - ph.startTime) * 100;
                  return (
                    <button
                      key={ph.name}
                      onClick={() => { setProgress(ph.startTime); setIsPlaying(false); }}
                      className="h-2 rounded-full transition-all duration-200 ease-out cursor-pointer"
                      style={{ width: `${width}%`, background: 'var(--qc-accent)', opacity: isActive ? 1 : progress >= ph.startTime ? 0.45 : 0.18 }}
                      title={`${ph.label}: ${ph.description}`}
                    />
                  );
                })}
              </div>

              {/* 3D 聚灵场景 */}
              <div className="w-full relative rounded-2xl overflow-hidden border bg-black" style={{ aspectRatio: '16/9', borderColor: 'var(--qc-border)', boxShadow: 'var(--qc-shadow-md)' }}>
                <SpiritGatheringScene
                  progress={progress}
                  isPlaying={isPlaying}
                  onPhaseChange={setGatheringPhase}
                />
              </div>

              {/* 控制栏 */}
              <ControlBar
                isPlaying={isPlaying}
                progress={progress}
                duration={JULING_DURATION}
                speed={speed}
                loop={loop}
                soundEnabled={soundEnabled}
                theme={theme}
                showInspector={showInspector}
                is3DMode={true}
                onPlayToggle={handlePlayToggle}
                onReplay={handleReplay}
                onSeek={handleSeek}
                onSpeedChange={setSpeed}
                onLoopToggle={() => setLoop(!loop)}
                onSoundToggle={() => setSoundEnabled(!soundEnabled)}
                onThemeChange={setTheme}
                onToggleInspector={() => setShowInspector(!showInspector)}
                onSpeakVoice={handleSpeakVoice}
              />
            
            </>
          ) : viewMode === 'sanling' ? (
            <>
              {/* 散灵阶段指示 */}
              <div className="w-full qc-banner qc-banner--gold py-2 text-xs" style={{ marginBottom: 0, borderRadius: '999px' }}>
                <Sparkles className="w-4 h-4" style={{ color: 'var(--qc-gold)' }} />
                <span>{`散灵阶段：${DISPERSAL_PHASES.find(ph => ph.name === dispersalPhase)?.label ?? dispersalPhase} — ${DISPERSAL_PHASES.find(ph => ph.name === dispersalPhase)?.description ?? ''}`}</span>
              </div>

              {/* 散灵阶段指示器 */}
              <div className="w-full flex items-center gap-1 px-2">
                {DISPERSAL_PHASES.map((ph) => {
                  const isActive = dispersalPhase === ph.name;
                  const isPast = progress > ph.endTime;
                  return (
                    <div key={ph.name} className="flex-1 flex flex-col items-center gap-1">
                      <div className="h-1 w-full rounded-full transition-colors"
                        style={{ background: 'var(--qc-gold)', opacity: isActive ? 1 : isPast ? 0.45 : 0.18 }} />
                      <span className="text-[9px]" style={{ color: isActive ? 'var(--qc-gold)' : 'var(--qc-dim)', fontWeight: isActive ? 500 : 400 }}>
                        {ph.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* 3D Canvas */}
              <div className="w-full aspect-video rounded-2xl overflow-hidden border bg-black" style={{ borderColor: 'var(--qc-border)', boxShadow: 'var(--qc-shadow-md)' }}>
                <SpiritDispersalScene progress={progress} isPlaying={isPlaying} onPhaseChange={setDispersalPhase} />
              </div>

              {/* Control Bar */}
              <ControlBar
                isPlaying={isPlaying}
                progress={progress}
                duration={SANLING_DURATION}
                speed={speed}
                loop={loop}
                soundEnabled={soundEnabled}
                theme={theme}
                showInspector={showInspector}
                is3DMode={true}
                onPlayToggle={handlePlayToggle}
                onReplay={handleReplay}
                onSeek={handleSeek}
                onSpeedChange={setSpeed}
                onLoopToggle={() => setLoop(!loop)}
                onSoundToggle={() => setSoundEnabled(!soundEnabled)}
                onThemeChange={setTheme}
                onToggleInspector={() => setShowInspector(!showInspector)}
                onSpeakVoice={handleSpeakVoice}
              />

            </>
          ) : (
            <>
              {/* 原视频对比面板：仅在需要时挂载，避免隐藏的 <video> 被手机浏览器
                  的原生播放器层顶到页面上（表现为「进入 2D/3D 直接变成视频」） */}
              {showVideoCompare && (
                <div className="w-full">
                  <VideoCompareView
                    progress={progress}
                    duration={DURATION}
                    isPlaying={isPlaying}
                    soundEnabled={soundEnabled}
                    onSeek={handleSeek}
                    onVideoLoaded={(el) => {
                      activeVideoRef.current = el;
                    }}
                  />
                </div>
              )}

              {/* Living Scene Stage */}
              <div className="w-full relative rounded-2xl overflow-hidden border bg-black" style={{ borderColor: 'var(--qc-border)', boxShadow: 'var(--qc-shadow-md)' }}>
                <ReferenceStage progress={progress} isPlaying={isPlaying} speed={speed}
                  soundEnabled={soundEnabled&&!showVideoCompare} theme={theme} is3DMode={is3DMode}
                  onToggle3DMode={()=>setIs3DMode(v=>!v)} onSeek={handleSeek}
                  visibleLayers={visibleLayers} onCreatureClick={handleCreatureClick}/>
              </div>

              {/* Audio Voice Subtitle Banner */}
              <AudioVoiceSubtitle
                isVisible={progress >= 0.8}
                onSpeak={handleSpeakVoice}
                clickedCreature={clickedCreature}
                text="你好，欢迎来到众生之门"
                subtext="Hello, Welcome to Gate of Living All Creatures"
              />

              {/* Control Bar */}
              <ControlBar
                isPlaying={isPlaying}
                progress={progress}
                duration={DURATION}
                speed={speed}
                loop={loop}
                soundEnabled={soundEnabled}
                theme={theme}
                showInspector={showInspector}
                is3DMode={is3DMode}
                onToggle3DMode={() => setIs3DMode(!is3DMode)}
                onPlayToggle={handlePlayToggle}
                onReplay={handleReplay}
                onSeek={handleSeek}
                onSpeedChange={setSpeed}
                onLoopToggle={() => setLoop(!loop)}
                onSoundToggle={() => setSoundEnabled(!soundEnabled)}
                onThemeChange={setTheme}
                onToggleInspector={() => setShowInspector(!showInspector)}
                onSpeakVoice={handleSpeakVoice}
              />

              {/* Layer Breakdown Drawer */}
              {showInspector && (
                <LayerInspector
                  visibleLayers={visibleLayers}
                  onToggleLayer={(k) => setVisibleLayers((s) => ({ ...s, [k]: !s[k] }))}
                  onResetLayers={() =>
                    setVisibleLayers({
                      moon: true,
                      creatures: true,
                      bushes: true,
                      gate: true,
                      text: true,
                    })
                  }
                />
              )}
            </>
          )}
        </main>
      )}

      {/* Footer Info & Keyframes Summary */}
      <footer className="w-full max-w-4xl text-xs pt-3 border-t flex flex-wrap items-center justify-between gap-2" style={{ color: 'var(--qc-dim)', borderColor: 'var(--qc-border)' }}>
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4" style={{ color: 'var(--qc-accent)' }} />
          <span>时间轴对齐：00:01 光环圆月 → 00:02 树丛灵体 → 00:03 众生之门展开 → 00:04 语音问候</span>
        </div>
        <div className="flex items-center gap-3 font-mono">
          <span>点击灵体与圆月可实时互动</span>
          <span>•</span>
          <span>Web Audio 音效合成</span>
        </div>
      </footer>
    </div>
  );
}
