import React from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Sparkles, Layers, Sliders, MessageSquare, Box } from 'lucide-react';
import { ThemeMode } from '../types';

interface ControlBarProps {
  isPlaying: boolean;
  progress: number; // 0 to 1
  duration: number; // in seconds
  speed: number;
  loop: boolean;
  soundEnabled: boolean;
  theme: ThemeMode;
  showInspector: boolean;
  is3DMode?: boolean;
  onToggle3DMode?: () => void;
  onPlayToggle: () => void;
  onReplay: () => void;
  onSeek: (value: number) => void;
  onSpeedChange: (speed: number) => void;
  onLoopToggle: () => void;
  onSoundToggle: () => void;
  onThemeChange: (theme: ThemeMode) => void;
  onToggleInspector: () => void;
  onSpeakVoice: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  isPlaying,
  progress,
  duration,
  speed,
  loop,
  soundEnabled,
  theme,
  showInspector,
  is3DMode = true,
  onToggle3DMode,
  onPlayToggle,
  onReplay,
  onSeek,
  onSpeedChange,
  onLoopToggle,
  onSoundToggle,
  onThemeChange,
  onToggleInspector,
  onSpeakVoice,
}) => {
  const currentTime = (progress * duration).toFixed(1);
  const totalTime = duration.toFixed(1);

  const themes: { id: ThemeMode; label: string; color: string }[] = [
    { id: 'original', label: 'Classic Night', color: '#85A96F' },
    { id: 'twilight', label: 'Twilight Blue', color: '#74B9FF' },
    { id: 'emerald', label: 'Emerald Forest', color: '#2ED573' },
    { id: 'golden', label: 'Golden Dusk', color: '#F3C248' },
    { id: 'cyber', label: 'Cyber Neon', color: '#FD79A8' },
  ];

  return (
    <div className="w-full qc-card flex flex-col gap-4">
      {/* Top Timeline Scrubber Bar */}
      <div className="flex items-center gap-3 w-full">
        <span className="font-mono text-xs w-10 text-right" style={{ color: 'var(--qc-dim)' }}>{currentTime}s</span>
        <div className="relative flex-1 flex items-center">
          <input
            type="range"
            min="0"
            max="1"
            step="0.005"
            value={progress}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="qc-range w-full cursor-pointer"
          />
        </div>
        <span className="font-mono text-xs w-10" style={{ color: 'var(--qc-dim)' }}>{totalTime}s</span>
      </div>

      {/* Main Playback & Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Playback Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onPlayToggle}
            className="qc-btn flex items-center justify-center" style={{ padding: '10px 14px' }}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>

          <button
            onClick={onReplay}
            className="qc-btn qc-btn--ghost flex items-center justify-center" style={{ padding: '10px 14px' }}
            title="Replay Animation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={onLoopToggle}
            className={`qc-tab ${loop ? 'is-active' : ''}`}
          >
            Loop: {loop ? 'ON' : 'OFF'}
          </button>

          {/* Speed selector */}
          <div className="flex items-center gap-1">
            {[0.5, 1.0, 1.5, 2.0].map((s) => (
              <button
                key={s}
                onClick={() => onSpeedChange(s)}
                className={`qc-tab font-mono ${speed === s ? 'is-active' : ''}`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Audio & Interaction Controls */}
        <div className="flex items-center gap-2">
          {/* Voice Speech Trigger */}
          <button
            onClick={onSpeakVoice}
            className="qc-btn qc-btn--gold-ghost qc-btn--sm flex items-center gap-1.5"
            title="Play Voice Greeting"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Voice Greeting</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={onSoundToggle}
            className={`qc-tab ${soundEnabled ? 'is-active' : ''}`}
            title={soundEnabled ? 'Mute Sound FX' : 'Enable Sound FX'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* 3D Mode Toggle */}
          {onToggle3DMode && (
            <button
              onClick={onToggle3DMode}
              className={`qc-tab flex items-center gap-1.5 ${is3DMode ? 'is-active' : ''}`}
              title="切换 3D / 2D 渲染模式"
            >
              <Box className="w-3.5 h-3.5" />
              <span>{is3DMode ? '3D 模式' : '2D 模式'}</span>
            </button>
          )}

          {/* Layer Inspector Toggle */}
          <button
            onClick={onToggleInspector}
            className={`qc-tab flex items-center gap-1.5 ${showInspector ? 'is-active' : ''}`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Layers</span>
          </button>
        </div>
      </div>

      {/* Theme Selection Row */}
      <div className="flex flex-wrap items-center justify-between pt-2 border-t text-xs" style={{ borderColor: 'var(--qc-border)' }}>
        <span className="flex items-center gap-1.5" style={{ color: 'var(--qc-dim)' }}>
          <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--qc-accent)' }} /> Color Palette:
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => onThemeChange(t.id)}
              className={`qc-tag flex items-center gap-1.5 cursor-pointer transition-all ${theme === t.id ? 'qc-tag--gold' : ''}`}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
