export type ThemeMode = 'original' | 'twilight' | 'emerald' | 'golden' | 'cyber';

export type AnimationPhase = 'idle' | 'moon' | 'bushes' | 'gate' | 'complete';

export interface CreatureState {
  isHovered: boolean;
  isClicked: boolean;
  expression: 'happy' | 'surprised' | 'blink' | 'normal';
}

export interface SoundConfig {
  enabled: boolean;
  volume: number; // 0 to 1
  voiceEnabled: boolean;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  opacity: number;
  life: number;
  maxLife: number;
}
