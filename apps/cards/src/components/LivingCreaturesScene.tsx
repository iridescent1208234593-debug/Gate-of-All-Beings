import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { Box, Layers, Ruler } from 'lucide-react';
import { BlockTypography } from './BlockTypography';
import { ThreeCanvas3D } from './ThreeCanvas3D';
import { CreatureState, Particle, ThemeMode } from '../types';
import { playCreaturePop, playMoonChime, playBushRustle, playGateUnfold } from '../utils/sound';

const STAGGERED_PARTICLES = [
  // Wave 1 (0.0s - 0.3s, progress delay 0.00 - 0.04)
  { wave: 1, angle: 0.15, radius: 130, delay: 0.00, size: 1.8, speed: 1.1 },
  { wave: 1, angle: 1.20, radius: 105, delay: 0.01, size: 3.8, speed: 1.2 },
  { wave: 1, angle: 2.40, radius: 145, delay: 0.02, size: 1.2, speed: 0.9 },
  { wave: 1, angle: 3.75, radius: 115, delay: 0.03, size: 2.6, speed: 1.0 },
  { wave: 1, angle: 4.95, radius: 135, delay: 0.02, size: 4.2, speed: 1.15 },
  { wave: 1, angle: 5.60, radius: 110, delay: 0.04, size: 2.0, speed: 0.95 },

  // Wave 2 (0.3s - 0.6s, progress delay 0.05 - 0.09)
  { wave: 2, angle: 0.65, radius: 150, delay: 0.05, size: 3.6, speed: 1.0 },
  { wave: 2, angle: 1.85, radius: 105, delay: 0.06, size: 1.5, speed: 1.1 },
  { wave: 2, angle: 3.10, radius: 160, delay: 0.07, size: 3.2, speed: 1.3 },
  { wave: 2, angle: 4.30, radius: 120, delay: 0.08, size: 1.4, speed: 0.9 },
  { wave: 2, angle: 0.40, radius: 95,  delay: 0.06, size: 3.5, speed: 1.1 },
  { wave: 2, angle: 2.15, radius: 140, delay: 0.09, size: 2.4, speed: 0.85 },

  // Wave 3 (0.6s - 0.9s, progress delay 0.10 - 0.14)
  { wave: 3, angle: 1.05, radius: 155, delay: 0.10, size: 2.2, speed: 1.05 },
  { wave: 3, angle: 1.60, radius: 120, delay: 0.11, size: 4.0, speed: 1.2 },
  { wave: 3, angle: 2.80, radius: 165, delay: 0.12, size: 1.3, speed: 1.25 },
  { wave: 3, angle: 3.45, radius: 112, delay: 0.11, size: 2.8, speed: 1.0 },
  { wave: 3, angle: 4.75, radius: 125, delay: 0.13, size: 3.5, speed: 0.9 },
  { wave: 3, angle: 6.00, radius: 145, delay: 0.14, size: 1.6, speed: 1.15 },

  // Wave 4 (0.9s - 1.2s, progress delay 0.15 - 0.18)
  { wave: 4, angle: 0.85, radius: 102, delay: 0.15, size: 3.9, speed: 0.95 },
  { wave: 4, angle: 2.60, radius: 158, delay: 0.16, size: 1.8, speed: 1.2 },
  { wave: 4, angle: 3.90, radius: 118, delay: 0.17, size: 1.1, speed: 1.0 },
  { wave: 4, angle: 5.15, radius: 142, delay: 0.18, size: 3.1, speed: 1.1 },
];

interface SceneProps {
  progress: number; // 0 to 1 (animating through timeline)
  theme: ThemeMode;
  soundEnabled: boolean;
  is3DMode?: boolean;
  onToggle3DMode?: () => void;
  onCreatureClick?: (name: string) => void;
  onToggleTheme?: () => void;
}

export const LivingCreaturesScene: React.FC<SceneProps> = ({
  progress,
  theme,
  soundEnabled,
  is3DMode: is3DModeProp,
  onToggle3DMode,
  onCreatureClick,
  onToggleTheme,
}) => {
  // Custom 3D vs 2D Mode State
  const [internalIs3DMode, setInternalIs3DMode] = useState(true);
  const is3D = is3DModeProp !== undefined ? is3DModeProp : internalIs3DMode;

  // Virtual Ruler & Dimension Guides State
  const svgRef = useRef<SVGSVGElement>(null);
  const [showRuler, setShowRuler] = useState(false);
  const [rulerPinA, setRulerPinA] = useState<{ x: number; y: number }>({ x: 78, y: 165 });
  const [rulerPinB, setRulerPinB] = useState<{ x: number; y: number }>({ x: 322, y: 165 });
  const [draggingPin, setDraggingPin] = useState<'A' | 'B' | null>(null);

  const handlePinPointerDown = (pin: 'A' | 'B', e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingPin(pin);
    if (svgRef.current) {
      try {
        svgRef.current.setPointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingPin || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.max(10, Math.min(390, Math.round(((e.clientX - rect.left) / rect.width) * 400)));
    const y = Math.max(10, Math.min(310, Math.round(((e.clientY - rect.top) / rect.height) * 320)));
    if (draggingPin === 'A') {
      setRulerPinA({ x, y });
    } else if (draggingPin === 'B') {
      setRulerPinB({ x, y });
    }
  };

  const handleSvgPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingPin) {
      setDraggingPin(null);
      if (svgRef.current) {
        try {
          svgRef.current.releasePointerCapture(e.pointerId);
        } catch (_) {}
      }
    }
  };

  const handleToggle3D = (targetMode: boolean) => {
    if (onToggle3DMode) {
      onToggle3DMode();
    }
    setInternalIs3DMode(targetMode);
  };

  // Mouse parallax motion values
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { stiffness: 120, damping: 18 };
  const parallaxX = useSpring(useTransform(mouseX, [-300, 300], [-10, 10]), springConfig);
  const parallaxY = useSpring(useTransform(mouseY, [-300, 300], [-8, 8]), springConfig);

  // Interactive 3D Ground Rotation on Mouse Slide & Drag (Spec 4.3)
  const groundRotateY = useSpring(useTransform(mouseX, [-250, 250], [-22, 22]), springConfig);
  const groundRotateX = useSpring(useTransform(mouseY, [-250, 250], [14, -14]), springConfig);

  // Interactive Drag-to-Rotate State
  const [dragRotateY, setDragRotateY] = useState(0);
  const [isDraggingGround, setIsDraggingGround] = useState(false);
  const dragStartXRef = useRef(0);
  const startAngleRef = useRef(0);

  // Combined 3D Rotation Angle Y
  const totalGroundRotateY = useTransform(groundRotateY, (v) => v + dragRotateY);

  // Hover target for focus highlight & tooltip (Spec 4.2)
  const [hoveredTarget, setHoveredTarget] = useState<'left' | 'right' | 'front' | 'sphere' | null>(null);

  // Creature bounce states (Spec 4.3)
  const [leftBounce, setLeftBounce] = useState(false);
  const [rightBounce, setRightBounce] = useState(false);
  const [frontBounce, setFrontBounce] = useState(false);
  const [spherePulse, setSpherePulse] = useState(false);

  // Continuous Idle Animation Timer for Spirits (floating bobbing & breathing)
  const [idleTime, setIdleTime] = useState(0);

  useEffect(() => {
    let animId: number;
    const updateIdle = () => {
      setIdleTime(performance.now() / 1000);
      animId = requestAnimationFrame(updateIdle);
    };
    animId = requestAnimationFrame(updateIdle);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Trigger bounce on all creatures with stagger
  const triggerAllBounce = () => {
    setSpherePulse(true);
    setTimeout(() => setSpherePulse(false), 500);

    setLeftBounce(true);
    setTimeout(() => setLeftBounce(false), 450);

    setTimeout(() => {
      setFrontBounce(true);
      setTimeout(() => setFrontBounce(false), 450);
    }, 60);

    setTimeout(() => {
      setRightBounce(true);
      setTimeout(() => setRightBounce(false), 450);
    }, 120);
  };

  // Dynamic particle canvas for sparkle effects
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Track which spirits have already spawned entrance particles
  const deerEntranceParticlesSpawned = useRef(false);
  const whaleEntranceParticlesSpawned = useRef(false);
  const blobEntranceParticlesSpawned = useRef(false);
  const particlesRef = useRef<Particle[]>([]);

  // Sound triggers based on key milestone progress transitions
  const prevProgressRef = useRef<number>(0);

  useEffect(() => {
    const prev = prevProgressRef.current;
   if (soundEnabled) {
      // Phase 1: Moon Coalesce (around 0.25 - sphere starts appearing at 1.5s)
      if (prev < 0.25 && progress >= 0.25) {
        playMoonChime(0.6);
      }
      // Phase 2: Foliage & Spirits Burst Outward (around 0.45 - foliage starts at 2.7s)
      if (prev < 0.45 && progress >= 0.45) {
        playBushRustle(0.6);
        setTimeout(() => playCreaturePop(0.5, 1.2), 150);
        setTimeout(() => playCreaturePop(0.5, 1.6), 300);
      }
      // Phase 3: Isometric Gate Unfold (around 0.75 - gate starts at 4.5s)
      if (prev < 0.75 && progress >= 0.75) {
        playGateUnfold(0.7);
      }
    }
    prevProgressRef.current = progress;
  }, [progress, soundEnabled]);

  // Handle mouse move for parallax
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  // Pointer Drag Handlers for 3D Ground Platform Rotation (Spec 4.3)
  const handlePointerDownGround = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDraggingGround(true);
    dragStartXRef.current = e.clientX;
    startAngleRef.current = dragRotateY;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}
  };

  const handlePointerMoveGround = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingGround) {
      const deltaX = e.clientX - dragStartXRef.current;
      setDragRotateY(startAngleRef.current + deltaX * 0.65);
    }
  };

  const handlePointerUpGround = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingGround) {
      setIsDraggingGround(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  // Sparkle Burst Trigger
  const spawnParticles = (x: number, y: number, color = '#FFFDD0', count = 12) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3.5;
      particlesRef.current.push({
        id: Math.random().toString(36).substring(2, 9),
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5,
        size: 2 + Math.random() * 4,
        color,
        opacity: 1,
        life: 0,
        maxLife: 30 + Math.random() * 25,
      });
    }
  };

  // Canvas particle render loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current.forEach((p, index) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // gravity
        p.life += 1;
        p.opacity = 1 - p.life / p.maxLife;

        if (p.life >= p.maxLife) {
          particlesRef.current.splice(index, 1);
          return;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.restore();
      });

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  // Sync canvas size  // Sync canvas size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.parentElement?.clientWidth || 600;
    canvas.height = canvas.parentElement?.clientHeight || 600;
  }, []);

  // Theme palettes
  const themeStyles = {
    original: {
      moonColor: '#FAF5DC',
      moonGlow: 'rgba(250, 245, 220, 0.45)',
      leafDark: '#2D4222',
      leafMid: '#537B3D',
      leafLight: '#7BAA5B',
      leafLime: '#A3D182',
      boxTop: '#75A056',
      boxFrontLeft: '#3A542A',
      boxFrontRight: '#243719',
      creatureBody: '#EFF5EC',
      accentText: '#FAF5DC',
    },
    twilight: {
      moonColor: '#FFEAA7',
      moonGlow: 'rgba(255, 234, 167, 0.45)',
      leafDark: '#1E272E',
      leafMid: '#0984E3',
      leafLight: '#74B9FF',
      leafLime: '#81ECEC',
      boxTop: '#0984E3',
      boxFrontLeft: '#00A8FF',
      boxFrontRight: '#192A56',
      creatureBody: '#F5F6FA',
      accentText: '#FFEAA7',
    },
    emerald: {
      moonColor: '#ECCC68',
      moonGlow: 'rgba(236, 204, 104, 0.4)',
      leafDark: '#006266',
      leafMid: '#009432',
      leafLight: '#2ED573',
      leafLime: '#7BED9F',
      boxTop: '#2ED573',
      boxFrontLeft: '#009432',
      boxFrontRight: '#006266',
      creatureBody: '#F1F2F6',
      accentText: '#ECCC68',
    },
    golden: {
      moonColor: '#FFFFFF',
      moonGlow: 'rgba(255, 255, 255, 0.5)',
      leafDark: '#B27A18',
      leafMid: '#D49B28',
      leafLight: '#F3C248',
      leafLime: '#FFE283',
      boxTop: '#F3C248',
      boxFrontLeft: '#D49B28',
      boxFrontRight: '#8C5A0D',
      creatureBody: '#FFFDF0',
      accentText: '#FFFFFF',
    },
    cyber: {
      moonColor: '#FF7675',
      moonGlow: 'rgba(255, 118, 117, 0.5)',
      leafDark: '#2C3A47',
      leafMid: '#6C5CE7',
      leafLight: '#A29BFE',
      leafLime: '#FD79A8',
      boxTop: '#A29BFE',
      boxFrontLeft: '#6C5CE7',
      boxFrontRight: '#341F97',
      creatureBody: '#DFE6E9',
      accentText: '#FD79A8',
    },
  }[theme];

  // Normalized Timeline Calculations matching video frame-by-frame:
  // Phase 1 (1.00s - 2.50s / progress 0.167 -> 0.417): Sphere fade in (matches original video)
  // Original: 0-1s is BLACK, sphere appears at 1.0s
  const sphereProgress = Math.min(1, Math.max(0, (progress - 0.167) / 0.25)); // 0 -> 1 from 1.0s to 2.5s
  
  // Smooth cubic ease-out curve: rapid silky expansion smoothly decelerating into full scale at 1.5s
  const sphereScale = sphereProgress === 0 ? 0 : 1 - Math.pow(1 - sphereProgress, 3);

  // Phase 2 (2.00s - 4.00s / progress 0.333 - 0.667): Foliage and platform (matches original video)
  // Original: green foliage starts at 2.0s, extends from y=30% to y=80%
  const outwardEmerge = Math.min(1, Math.max(0, (progress - 0.333) / 0.334)); // 0 -> 1 from 2.0s to 4.0s
  const emergeEase = Math.sin((outwardEmerge * Math.PI) / 2); // smooth ease-out curve

  // 1. Stage A: Vertical elongation down from sphere bottom edge (small inverted triangle -> long inverted triangle)
  const vertStretching = Math.min(1, outwardEmerge / 0.30); // 2.0s -> 2.6s
  const vertEase = Math.sin((vertStretching * Math.PI) / 2);

  // 2. Stage B: Unfolding outward where upper section spreads faster & wider ("上面铺的更快更大", turning into isometric square platform)
  const upperSpreadProgress = Math.min(1, Math.max(0, (outwardEmerge - 0.05) / 0.95)); // spreads quickly right after 1.1s
  const upperEase = 1 - Math.pow(1 - upperSpreadProgress, 2.2);

  // Axis-Symmetric Polygon Points Interpolation for Grass Plane (100% Upright & Centered around X = 200):
  const pTopY = 145 - upperEase * (145 - 75); // upper edge spreads fast & wide up to y=75
  const pBottomY = 155 + vertEase * (245 - 155) + upperEase * (255 - 245); // settles at y=255
  
  // Half-width (dx) from centerline X = 200 (guarantees perfect axis-symmetry at all frames, exact square ratio)
  const dx = 8 + vertEase * 22 + upperEase * (122 - 30); // 8 -> 30 -> 122 (gives isometric square 244 x 180)
  const pLeftX = 200 - dx;  // Always 200 - dx
  const pRightX = 200 + dx; // Always 200 + dx

  // Left & Right Y points are ALWAYS exact vertical midpoint of pTopY and pBottomY!
  // This guarantees 100% upright, perfectly straight isometric diamond geometry right from 1.1s!
  const pLeftY = (pTopY + pBottomY) / 2;
  const pRightY = (pTopY + pBottomY) / 2;

  // Leaf/foliage sprouting factors (staggered blossoming growth: front sprouts first, then back ear leaves bloom outwards like a flower bud)
  const frontSproutGrowth = Math.min(1, Math.max(0, (progress - 0.35) / 0.22));
  const frontEarGrowth = Math.min(1, Math.max(0, (progress - 0.40) / 0.25));
  const backEarGrowth = Math.min(1, Math.max(0, (progress - 0.45) / 0.26));
  const leafGrowth = Math.max(frontSproutGrowth, backEarGrowth);

  // Spirit emergence factor (sprouting WITH the grass, not after)
  const spiritEmergeBase = Math.min(1, Math.max(0, (progress - 0.38) / 0.28));
  
  // Staggered entrance timing: deer first, then whale, then blob
  const deerEntranceDelay = 0.0;
  const whaleEntranceDelay = 0.08;
  const blobEntranceDelay = 0.16;
  
  // Individual spirit emergence with stagger
  const deerEmerge = Math.min(1, Math.max(0, (spiritEmergeBase - deerEntranceDelay) / (1 - deerEntranceDelay)));
  const whaleEmerge = Math.min(1, Math.max(0, (spiritEmergeBase - whaleEntranceDelay) / (1 - whaleEntranceDelay)));
  const blobEmerge = Math.min(1, Math.max(0, (spiritEmergeBase - blobEntranceDelay) / (1 - blobEntranceDelay)));
  
  // Enhanced entrance animation with dynamic actions per spirit
  // Each spirit has unique "pushing through grass" movements
  
  const calculateDeerEntrance = (emerge: number, time: number) => {
    if (emerge === 0) return { ease: 0, squashX: 1, squashY: 1, popPhase: 0, headTilt: 0, earFlop: 0, bodyWiggle: 0, antlerShake: 0, anticipationDip: 0 };
    
    const squeezePhase = Math.min(1, emerge / 0.6);
    const popPhase = Math.max(0, (emerge - 0.6) / 0.4);
    
    // Squash/stretch during entrance
    const squashX = squeezePhase < 1 ? 1.3 - squeezePhase * 0.4 : 1;
    const squashY = squeezePhase < 1 ? 0.65 + squeezePhase * 0.2 : 0.85 + popPhase * 0.15;
    
    // Spring overshoot for pop-out
    // Anticipation dip: spirit squats down before popping up
    const anticipationDip = emerge < 0.15 ? Math.sin(emerge / 0.15 * Math.PI) * 5 : 0;
    // Celebration bounce when fully emerged
    const celebration = emerge > 0.9 ? Math.sin((emerge - 0.9) / 0.1 * Math.PI * 4) * 3 * (1 - emerge) * 10 : 0;

    const springOvershoot = popPhase > 0 ? Math.sin(popPhase * Math.PI * 2.5) * 0.18 * (1 - popPhase) : 0;
    const ease = emerge + springOvershoot + celebration * 0.01;
    
    // Dynamic actions during entrance
    // Head tilts side to side as pushing through grass
    const headTilt = Math.sin(emerge * 12) * (1 - emerge) * 15;
    // Ears flop dramatically when emerging
    const earFlop = Math.sin(emerge * 15) * (1 - ease) * 25 + (popPhase > 0 ? Math.sin(popPhase * 8) * 12 : 0);
    // Body wiggles left-right while pushing up
    const bodyWiggle = Math.sin(emerge * 10) * (1 - emerge) * 8;
    // Antlers shake when breaking through
    const antlerShake = popPhase > 0 ? Math.sin(popPhase * 20) * 15 * (1 - popPhase) : Math.sin(emerge * 18) * (1 - emerge) * 8;
    
    return { ease, squashX, squashY, popPhase, headTilt, earFlop, bodyWiggle, antlerShake, anticipationDip };
  };
  
  const calculateWhaleEntrance = (emerge: number, time: number) => {
    if (emerge === 0) return { ease: 0, squashX: 1, squashY: 1, popPhase: 0, bodyUndulate: 0, tailWhip: 0, spoutBurst: 0, flipperWave: 0, whaleAntDip: 0 };
    
    const squeezePhase = Math.min(1, emerge / 0.6);
    const popPhase = Math.max(0, (emerge - 0.6) / 0.4);
    
    const squashX = squeezePhase < 1 ? 1.25 - squeezePhase * 0.35 : 1;
    const squashY = squeezePhase < 1 ? 0.7 + squeezePhase * 0.15 : 0.85 + popPhase * 0.15;
    
    const whaleAntDip = emerge < 0.12 ? Math.sin(emerge / 0.12 * Math.PI) * 6 : 0;
    const whaleCelebration = emerge > 0.88 ? Math.sin((emerge - 0.88) / 0.12 * Math.PI * 3) * 4 * (1 - emerge) * 8 : 0;
    const springOvershoot = popPhase > 0 ? Math.sin(popPhase * Math.PI * 2.5) * 0.18 * (1 - popPhase) : 0;
    const ease = emerge + springOvershoot + whaleCelebration * 0.01;
    
    // Whale-specific actions
    // Body undulates like swimming while emerging
    const bodyUndulate = Math.sin(emerge * 14) * (1 - emerge) * 12;
    // Tail whips back and forth energetically
    const tailWhip = Math.sin(emerge * 18) * (1 - ease) * 35 + (popPhase > 0 ? Math.sin(popPhase * 12) * 20 : 0);
    // Spout bursts water when breaking through
    const spoutBurst = popPhase > 0.1 ? Math.sin(popPhase * 15) * (1 - popPhase) * 1.8 : 0;
    // Flippers wave while pushing through
    const flipperWave = Math.sin(emerge * 16) * (1 - emerge) * 20;
    
    return { ease, squashX, squashY, popPhase, bodyUndulate, tailWhip, spoutBurst, flipperWave, whaleAntDip };
  };
  
  const calculateBlobEntrance = (emerge: number, time: number) => {
    if (emerge === 0) return { ease: 0, squashX: 1, squashY: 1, popPhase: 0, bodyBounce: 0, haloSpin: 0, tuftFlap: 0, squishPulse: 0, blobAntDip: 0 };
    
    const squeezePhase = Math.min(1, emerge / 0.6);
    const popPhase = Math.max(0, (emerge - 0.6) / 0.4);
    
    const squashX = squeezePhase < 1 ? 1.35 - squeezePhase * 0.45 : 1;
    const squashY = squeezePhase < 1 ? 0.6 + squeezePhase * 0.25 : 0.85 + popPhase * 0.15;
    
    const blobAntDip = emerge < 0.1 ? Math.sin(emerge / 0.1 * Math.PI) * 7 : 0;
    const blobCelebration = emerge > 0.85 ? Math.sin((emerge - 0.85) / 0.15 * Math.PI * 5) * 5 * (1 - emerge) * 6 : 0;
    const springOvershoot = popPhase > 0 ? Math.sin(popPhase * Math.PI * 2.5) * 0.2 * (1 - popPhase) : 0;
    const ease = emerge + springOvershoot + blobCelebration * 0.01;
    
    // Blob-specific actions
    // Body bounces up and down excitedly
    const bodyBounce = Math.sin(emerge * 16) * (1 - emerge) * 6;
    // Halo spins rapidly when emerging
    const haloSpin = emerge * 720 + (popPhase > 0 ? popPhase * 360 : 0);
    // Tufts flap wildly
    const tuftFlap = Math.sin(emerge * 20) * (1 - ease) * 30;
    // Squish pulse - blob alternates between wide and tall
    const squishPulse = Math.sin(emerge * 12) * (1 - emerge) * 0.25;
    
    return { ease, squashX, squashY, popPhase, bodyBounce, haloSpin, tuftFlap, squishPulse, blobAntDip };
  };
  
  const deerEntrance = calculateDeerEntrance(deerEmerge, idleTime);
  const whaleEntrance = calculateWhaleEntrance(whaleEmerge, idleTime);
  const blobEntrance = calculateBlobEntrance(blobEmerge, idleTime);
  
  // Global spirit emergence for shared effects
  const spiritEmerge = spiritEmergeBase;
  const spiritEase = deerEntrance.ease;

  // Idle floating & breathing calculations for spirits (seconds-based continuous smooth movement)
  // Deer spirit (left) - float, breathe, sway + ear wiggle + antler sway
  const leftFloatY = Math.sin(idleTime * 2.2) * 5.5;
  const leftScaleBreathe = 1 + Math.sin(idleTime * 1.8) * 0.035;
  const leftSwayRotate = Math.sin(idleTime * 1.4) * 3;
  const leftGlowPulse = 0.82 + Math.sin(idleTime * 3.2) * 0.18;
  const leftEarWiggle = Math.sin(idleTime * 2.5) * 8;
  const leftAntlerSway = Math.sin(idleTime * 1.5) * 4;

  // Whale spirit (right) - swimming undulation + tail wag + fountain pulse + flipper flap
  const rightFloatY = Math.cos(idleTime * 2.4 + 1.2) * 6.5;
  const rightScaleBreathe = 1 + Math.cos(idleTime * 2.0 + 1.2) * 0.04;
  const rightSwayRotate = Math.sin(idleTime * 1.5 + 1.2) * 3.5;
  const rightGlowPulse = 0.82 + Math.cos(idleTime * 3.4 + 1.2) * 0.18;
  const rightTailWag = Math.sin(idleTime * 3.0) * 12;
  const rightFountainPulse = 0.7 + Math.sin(idleTime * 2.8) * 0.3;
  const rightFlipperFlap = Math.sin(idleTime * 2.0) * 8;

  // Blob spirit (front) - happy bob with squash-stretch + halo spin + tuft wiggle
  const frontFloatY = Math.sin(idleTime * 2.6 + 2.4) * 4.8;
  const frontScaleBreathe = 1 + Math.sin(idleTime * 2.2 + 2.4) * 0.035;
  const frontSwayRotate = Math.cos(idleTime * 1.6 + 2.4) * 2.5;
  const frontGlowPulse = 0.82 + Math.sin(idleTime * 3.0 + 2.4) * 0.18;
  const frontSquashX = 1 + Math.sin(idleTime * 5.2 + 2.4) * 0.06;
  const frontSquashY = 1 - Math.sin(idleTime * 5.2 + 2.4) * 0.06;
  const frontHaloRotate = (idleTime * 35) % 360;
  const frontTuftWiggle = Math.sin(idleTime * 3.0) * 10;

  // Grass surface Y at each spirit position (for emergence clip masking)
  const leftGrassY = (pLeftY + pTopY) / 2;
  const rightGrassY = (pRightY + pTopY) / 2;
  const frontGrassY = pBottomY - 5;

  // ===== PER-SPIRIT INDEPENDENT EXPRESSION ANIMATIONS =====
  // Helper: calculate blink value for a given time offset and cycle length
  const calcBlink = (t: number, cycle: number, dblCycle: number) => {
    const bc = t % cycle;
    const bp = bc < 0.15 ? 1 - bc / 0.15 : bc > cycle - 0.5 ? (bc - (cycle - 0.5)) / 0.5 : 0;
    const dbc = t % dblCycle;
    const db = dbc < 0.12 ? 1 - dbc / 0.12 : dbc > 0.25 && dbc < 0.37 ? 1 - (dbc - 0.25) / 0.12 : 0;
    return Math.max(bp, db);
  };

  // --- Deer Spirit Expressions (blink every 4.0s) ---
  const deerEyeBlink = calcBlink(idleTime, 4.0, 6.5);
  const deerSmileWidth = 0.8 + Math.sin(idleTime * 1.2) * 0.2;
  const deerEyebrowLift = Math.sin(idleTime * 0.8) * 0.8;
  const deerTongueCycle = idleTime % 12.0;
  const deerTonguePoke = deerTongueCycle > 10.0 && deerTongueCycle < 10.8 ? Math.sin((deerTongueCycle - 10.0) / 0.8 * Math.PI) : 0;

  // --- Whale Spirit Expressions (blink every 3.8s, offset by 1.5s) ---
  const whaleEyeBlink = calcBlink(idleTime + 1.5, 3.8, 7.0);
  const whaleSmileWidth = 0.75 + Math.sin(idleTime * 1.0 + 1.5) * 0.25;
  const whaleEyebrowLift = Math.sin(idleTime * 0.7 + 1.5) * 0.6;

  // --- Blob Spirit Expressions (blink every 4.5s, offset by 3.0s) ---
  const blobEyeBlink = calcBlink(idleTime + 3.0, 4.5, 8.0);
  const blobSmileWidth = 0.85 + Math.sin(idleTime * 1.4 + 3.0) * 0.15;
  const blobCheekPuff = 1 + Math.sin(idleTime * 1.5 + 2.4) * 0.08;

  // ===== EXTRA PER-SPIRIT IDLE ANIMATIONS (lively varied movements) =====
  // Deer: head tilt, paw lift, tail flick
  const deerHeadTilt = Math.sin(idleTime * 0.9) * 6 + Math.sin(idleTime * 2.3) * 3;
  const deerPawLift = Math.max(0, Math.sin(idleTime * 1.8)) * 4;
  const deerTailFlick = Math.sin(idleTime * 4.0) * 10 * (Math.sin(idleTime * 0.3) > 0.7 ? 1 : 0.2);
  const deerNoseWiggle = Math.sin(idleTime * 6.0) * 1.5;

  // Whale: spout variation, body roll, fin wave, jaw move
  const whaleSpoutExtra = Math.max(0, Math.sin(idleTime * 0.5)) * 0.5;
  const whaleBodyRoll = Math.sin(idleTime * 1.2) * 4;
  const whaleFinWave = Math.sin(idleTime * 2.5) * 6 + Math.sin(idleTime * 5.0) * 3;
  const whaleJawOpen = Math.max(0, Math.sin(idleTime * 0.6)) * 2;

  // Blob: wobble jiggle, hop bounce, body morph, eye spin
  const blobWobble = Math.sin(idleTime * 4.0) * 3;
  const blobHop = Math.max(0, Math.sin(idleTime * 1.5 + 2.4)) * 5;
  const blobMorphX = 1 + Math.sin(idleTime * 2.0) * 0.08;
  const blobMorphY = 1 + Math.cos(idleTime * 2.0) * 0.08;
  const blobEyeSpin = (idleTime * 20) % 360;
  const blobBlushPulse = 0.5 + Math.sin(idleTime * 2.0) * 0.2;

  // Spawn entrance particles when each spirit breaks through the grass
  useEffect(() => {
    // Deer spirit entrance particles (at 60% emergence - when it pops out)
    if (deerEmerge > 0.6 && !deerEntranceParticlesSpawned.current) {
      deerEntranceParticlesSpawned.current = true;
      // Spawn grass/leaf particles bursting upward from deer position
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const x = (75 / 400) * rect.width;
        const y = (leftGrassY / 320) * rect.height;
        for (let i = 0; i < 15; i++) {
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
          const speed = 2 + Math.random() * 4;
          particlesRef.current.push({
            id: Math.random().toString(36).substring(2, 9),
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1,
            size: 2 + Math.random() * 3,
            color: themeStyles.leafLight,
            opacity: 1,
            life: 0,
            maxLife: 40 + Math.random() * 30,
          });
        }
        // Add white sparkles
        for (let i = 0; i < 8; i++) {
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
          const speed = 1.5 + Math.random() * 3;
          particlesRef.current.push({
            id: Math.random().toString(36).substring(2, 9),
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 2,
            size: 1.5 + Math.random() * 2.5,
            color: '#FFFFFF',
            opacity: 1,
            life: 0,
            maxLife: 25 + Math.random() * 20,
          });
        }
      }
    }
    
    // Whale spirit entrance particles
    if (whaleEmerge > 0.6 && !whaleEntranceParticlesSpawned.current) {
      whaleEntranceParticlesSpawned.current = true;
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const x = (315 / 400) * rect.width;
        const y = (rightGrassY / 320) * rect.height;
        for (let i = 0; i < 15; i++) {
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
          const speed = 2 + Math.random() * 4;
          particlesRef.current.push({
            id: Math.random().toString(36).substring(2, 9),
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1,
            size: 2 + Math.random() * 3,
            color: themeStyles.leafLight,
            opacity: 1,
            life: 0,
            maxLife: 40 + Math.random() * 30,
          });
        }
        for (let i = 0; i < 8; i++) {
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
          const speed = 1.5 + Math.random() * 3;
          particlesRef.current.push({
            id: Math.random().toString(36).substring(2, 9),
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 2,
            size: 1.5 + Math.random() * 2.5,
            color: '#FFFFFF',
            opacity: 1,
            life: 0,
            maxLife: 25 + Math.random() * 20,
          });
        }
      }
    }
    
    // Blob spirit entrance particles
    if (blobEmerge > 0.6 && !blobEntranceParticlesSpawned.current) {
      blobEntranceParticlesSpawned.current = true;
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const x = (200 / 400) * rect.width;
        const y = (frontGrassY / 320) * rect.height;
        for (let i = 0; i < 15; i++) {
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
          const speed = 2 + Math.random() * 4;
          particlesRef.current.push({
            id: Math.random().toString(36).substring(2, 9),
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1,
            size: 2 + Math.random() * 3,
            color: themeStyles.leafLight,
            opacity: 1,
            life: 0,
            maxLife: 40 + Math.random() * 30,
          });
        }
        for (let i = 0; i < 8; i++) {
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
          const speed = 1.5 + Math.random() * 3;
          particlesRef.current.push({
            id: Math.random().toString(36).substring(2, 9),
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 2,
            size: 1.5 + Math.random() * 2.5,
            color: '#FFFFFF',
            opacity: 1,
            life: 0,
            maxLife: 25 + Math.random() * 20,
          });
        }
      }
    }
    
    // Reset particle flags when spirits disappear (for re-entrance)
    if (deerEmerge < 0.1) deerEntranceParticlesSpawned.current = false;
    if (whaleEmerge < 0.1) whaleEntranceParticlesSpawned.current = false;
    if (blobEmerge < 0.1) blobEntranceParticlesSpawned.current = false;
  }, [deerEmerge, whaleEmerge, blobEmerge, themeStyles.leafLight]);

  // Axis-Symmetric Floor Shadow Interpolation (100% Upright & Centered around X = 200)
  const shadowDx = dx + 10;
  const sTopY = pTopY + 3;
  const sBottomY = pBottomY + 8;
  const sLeftX = 200 - shadowDx;
  const sRightX = 200 + shadowDx;
  const sLeftY = (sTopY + sBottomY) / 2;
  const sRightY = (sTopY + sBottomY) / 2;

  // Phase 3 (4.00s - 6.00s / progress 0.667 - 1.0): Gate text (matches original video)
  // Original: gate text appears around 3.5-4.0s
  const gateUnfold = Math.min(1, Math.max(0, (progress - 0.667) / 0.333)); // 0 -> 1 from 4.0s to 6.0s

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full h-[520px] sm:h-[600px] flex items-center justify-center overflow-hidden bg-black rounded-2xl cursor-crosshair select-none"
    >
      {/* Background Particle Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 z-20 pointer-events-none" />

      {/* Custom 3D vs 2D Mode Switch & Virtual Ruler Control Overlay */}
      <div className="absolute top-3 right-3 z-30 flex items-center gap-2 p-1.5 rounded-xl bg-slate-900/85 backdrop-blur-md border border-white/20 text-xs shadow-xl select-none">
        <div className="flex items-center gap-1 bg-slate-800/90 rounded-lg p-0.5 border border-slate-700/80">
          <button
            type="button"
            onClick={() => handleToggle3D(true)}
            className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              is3D
                ? 'bg-emerald-500 text-white shadow-md font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>3D 模型</span>
          </button>
          <button
            type="button"
            onClick={() => handleToggle3D(false)}
            className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              !is3D
                ? 'bg-emerald-500 text-white shadow-md font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>2D 平面</span>
          </button>
        </div>

        {/* Virtual Ruler Toggle Button */}
        <button
          type="button"
          onClick={() => setShowRuler(!showRuler)}
          className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 border ${
            showRuler
              ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-lg shadow-amber-500/20'
              : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:text-white'
          }`}
        >
          <Ruler className="w-3.5 h-3.5" />
          <span>虚拟量尺</span>
        </button>

        {is3D && (
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 text-[11px] text-emerald-300 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>↔ 拖拽/滑动 3D 旋转</span>
          </div>
        )}
      </div>

      {/* Virtual Ruler HUD Diagnostic Panel (Top Left) */}
      {showRuler && (
        <div className="absolute top-16 left-3 z-30 p-3 rounded-xl bg-slate-950/95 backdrop-blur-md border border-amber-500/50 text-amber-300 text-xs shadow-2xl font-mono w-[280px]">
          <div className="font-bold flex items-center justify-between text-amber-400 mb-2 border-b border-amber-500/30 pb-1.5">
            <div className="flex items-center gap-1.5">
              <Ruler className="w-4 h-4 text-amber-400 animate-pulse" />
              <span>动态量尺 (Dynamic Ruler)</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
              {(progress * 100).toFixed(0)}% 帧
            </span>
          </div>

          <div className="space-y-1.5 text-[11px] text-slate-200">
            {/* Real-Time Animated Boundary Tracker */}
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 space-y-1">
              <div className="text-[10px] text-amber-400/90 font-bold uppercase tracking-wider mb-0.5">动画实时跟踪尺寸</div>
              <div className="flex justify-between">
                <span className="text-slate-400">展开基座宽 (W):</span>
                <span className="font-semibold text-cyan-300">{Math.round(dx * 2)} px</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">展开基座高 (D):</span>
                <span className="font-semibold text-cyan-300">{Math.round(pBottomY - pTopY)} px</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">核心球体直径 (⌀):</span>
                <span className="font-semibold text-amber-200">{Math.round(104 * sphereScale)} px</span>
              </div>
            </div>

            {/* Interactive Draggable Endpoint Measurement Tape */}
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 space-y-1">
              <div className="text-[10px] text-amber-400/90 font-bold uppercase tracking-wider mb-0.5 flex justify-between">
                <span>自定义双端点测量</span>
                <span className="text-emerald-400 font-normal">可拖拽 🔵A / 🔴B</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">端点 A 坐标:</span>
                <span className="font-semibold text-blue-400">({rulerPinA.x}, {rulerPinA.y})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">端点 B 坐标:</span>
                <span className="font-semibold text-red-400">({rulerPinB.x}, {rulerPinB.y})</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-1 mt-1">
                <span className="text-slate-300 font-bold">两点实测距离 (L):</span>
                <span className="font-bold text-amber-400 text-xs">
                  {Math.round(Math.hypot(rulerPinB.x - rulerPinA.x, rulerPinB.y - rulerPinA.y))} px
                </span>
              </div>
            </div>

            {/* Quick Snap Presets */}
            <div className="pt-1 flex items-center gap-1.5 text-[10px]">
              <span className="text-slate-400">快吸对齐:</span>
              <button
                type="button"
                onClick={() => {
                  setRulerPinA({ x: Math.round(pLeftX), y: Math.round(pLeftY) });
                  setRulerPinB({ x: Math.round(pRightX), y: Math.round(pRightY) });
                }}
                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition-colors cursor-pointer"
              >
                基座对角
              </button>
              <button
                type="button"
                onClick={() => {
                  setRulerPinA({ x: 200, y: Math.round(pTopY) });
                  setRulerPinB({ x: 200, y: Math.round(pBottomY) });
                }}
                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition-colors cursor-pointer"
              >
                基座纵深
              </button>
              <button
                type="button"
                onClick={() => {
                  setRulerPinA({ x: Math.round(200 - 52 * sphereScale), y: 115 });
                  setRulerPinB({ x: Math.round(200 + 52 * sphereScale), y: 115 });
                }}
                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 transition-colors cursor-pointer"
              >
                球直径
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Parallax Container */}
      <motion.div
        style={{ x: showRuler ? 0 : parallaxX, y: showRuler ? 0 : parallaxY }}
        className="relative z-10 w-full max-w-md h-full flex flex-col items-center justify-center p-4"
      >
        {/* ================= STAGE A & B: CELESTIAL SPHERE & ISOMETRIC GRASS PLANE (3D / 2D MODE) ================= */}
        <div className="relative z-20 w-full max-w-[420px] aspect-[4/3] flex items-center justify-center my-1 pointer-events-auto select-none">
          {/* Real WebGL 3D Scene Layer (Active when is3D is true) */}
          {is3D && (
            <div className="absolute inset-0 z-0">
              <ThreeCanvas3D
                progress={progress}
                dragRotateY={dragRotateY}
                mouseX={mouseX.get()}
                mouseY={mouseY.get()}
                theme={theme}
                isDragging={isDraggingGround}
                onPointerDown={handlePointerDownGround}
                onPointerMove={handlePointerMoveGround}
                onPointerUp={handlePointerUpGround}
                onSphereClick={() => {
                  triggerAllBounce();
                  if (onCreatureClick) onCreatureClick('核心 3D 之球 (3D Core Orb)');
                }}
              />
            </div>
          )}

          {/* Integrated Overlay SVG Canvas (Particles, Foliage, Creatures, Tooltips, or 2D Fallback) */}
          <svg
            ref={svgRef}
            className={`relative z-10 w-full h-full overflow-visible touch-none select-none ${
              showRuler || draggingPin ? 'pointer-events-auto' : 'pointer-events-none'
            }`}
            viewBox="0 0 400 320"
            onPointerMove={handleSvgPointerMove}
            onPointerUp={handleSvgPointerUp}
            onPointerCancel={handleSvgPointerUp}
          >
            <defs>
              {/* 3D Isometric Grass Surface Gradient */}
              <linearGradient id="isoGrassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={themeStyles.leafMid} />
                <stop offset="50%" stopColor={themeStyles.leafDark} />
                <stop offset="100%" stopColor="#1E2F18" />
              </linearGradient>

              {/* 3D Box Left Face Gradient */}
              <linearGradient id="boxLeftGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={themeStyles.boxFrontLeft} />
                <stop offset="100%" stopColor="#172412" />
              </linearGradient>

              {/* 3D Box Right Face Gradient */}
              <linearGradient id="boxRightGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={themeStyles.boxFrontRight} />
                <stop offset="100%" stopColor="#0E160B" />
              </linearGradient>

              {/* Translucent Milk White Spirit Body Gradient ("半透明奶白色魂灵") */}
              <radialGradient id="milkWhiteSpiritBody" cx="45%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.96" />
                <stop offset="35%" stopColor="#FFFDF0" stopOpacity="0.88" />
                <stop offset="70%" stopColor="#FEFCE8" stopOpacity="0.75" />
                <stop offset="100%" stopColor="#FEF08A" stopOpacity="0.55" />
              </radialGradient>

              {/* Inner White Core Glow */}
              <radialGradient id="spiritCoreGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#FFFBEB" stopOpacity="0.0" />
              </radialGradient>

              {/* Translucent Soul Outer Halo Glow Filter */}
              <filter id="spiritSoulGlow" x="-60%" y="-60%" width="220%" height="220%">
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#FFFFFF" floodOpacity="0.9" />
                <feDropShadow dx="0" dy="0" stdDeviation="10" floodColor="#FEF08A" floodOpacity="0.5" />
             </filter>

              {/* Spirit emergence clip masks - spirits rise FROM within the grass surface */}
              <clipPath id="deerSpiritClip">
                <rect x="0" y="-50" width="200" height={Math.max(0, leftGrassY + 55)} />
              </clipPath>
              <clipPath id="whaleSpiritClip">
                <rect x="200" y="-50" width="200" height={Math.max(0, rightGrassY + 55)} />
              </clipPath>
              <clipPath id="blobSpiritClip">
                <rect x="130" y="130" width="140" height={Math.max(0, frontGrassY - 125)} />
              </clipPath>
            </defs>

            {/* 1. INITIAL CONVERGING STARRY DOTS & BLACK HOLE SUCTION (0.00s - 1.50s) */}
            {progress < 0.32 && (
              <g>
                {/* Center Attraction Core */}
                {sphereProgress > 0 && (
                  <circle
                    cx="200"
                    cy="115"
                    r={Math.max(0, sphereProgress * 30)}
                    fill={themeStyles.moonColor}
                    opacity={sphereProgress * 0.5}
                  />
                )}
                {STAGGERED_PARTICLES.map((p, i) => {
                  // Not born yet (wave has not triggered): hide particle completely
                  if (progress < p.delay) return null;

                  const duration = 0.08 / p.speed;
                  const localP = Math.max(0, Math.min(1, (progress - p.delay) / duration));

                  if (localP >= 0 && localP < 1) {
                    const currentDist = p.radius * Math.pow(1 - localP, 2.0); // black hole suction acceleration
                    const spiralAngle = p.angle + localP * 0.8;
                    const x1 = 200 + Math.cos(spiralAngle) * currentDist;
                    const y1 = 115 + Math.sin(spiralAngle) * currentDist * 0.85;

                    // Bright pure white starlight (opacity 1.0, crisp white)
                    const opacity = localP > 0.85 ? (1 - (localP - 0.85) / 0.15) : 1.0;

                    // Initial spawn (localP < 0.25): render as bright, crisp pure white circular dot with glow shadow
                    if (localP < 0.25) {
                      return (
                        <circle
                          key={i}
                          cx={x1}
                          cy={y1}
                          r={p.size}
                          fill="#FFFFFF"
                          opacity={opacity}
                          filter="drop-shadow(0 0 3px #FFFFFF)"
                        />
                      );
                    }

                    // As pulled inward by suction (localP >= 0.25): stretch into crisp white line streak accelerating to center
                    const streakLen = Math.min(26, (localP - 0.15) * 28 * (p.size / 2.2));
                    const x2 = x1 + Math.cos(spiralAngle) * streakLen;
                    const y2 = y1 + Math.sin(spiralAngle) * streakLen * 0.85;

                    return (
                      <line
                        key={i}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="#FFFFFF"
                        strokeWidth={p.size * 0.85}
                        strokeLinecap="round"
                        opacity={opacity}
                        filter="drop-shadow(0 0 2px #FFFFFF)"
                      />
                    );
                  }

                  // Absorbed into center sphere
                  return null;
                })}
              </g>
            )}

            {/* 2. BACK FOLIAGE & GROUND PLATFORM (2D Fallback Mode Only) */}
            {!is3D && progress >= 0.15 && (
              <g
                style={{
                  opacity: outwardEmerge > 0.001 ? 1 : 0,
                }}
              >
                {/* 2D ISOMETRIC GRASS PLATFORM */}
                <polygon
                  points={`${200},${sTopY} ${sRightX},${sRightY} ${200},${sBottomY} ${sLeftX},${sLeftY}`}
                  fill="rgba(0,0,0,0.35)"
                  filter="blur(8px)"
                />
                <polygon
                  points={`${200},${pTopY} ${pRightX},${pRightY} ${200},${pBottomY} ${pLeftX},${pLeftY}`}
                  fill="url(#isoGrassGrad)"
                  stroke={themeStyles.leafLight}
                  strokeWidth={1.2 + emergeEase * 1.3}
                />

                {/* BACK EAR LEAVES (Behind Sphere, blooming outwards like a flower bud) */}
                {backEarGrowth > 0.01 && (
                  <g style={{ opacity: backEarGrowth }}>
                    {/* Left Outer Ear (Dark Moss Green) */}
                    <path
                      d="M 125,145 C 95,90 85,50 115,40 C 130,35 145,80 148,145 Z"
                      fill={themeStyles.leafDark}
                      style={{
                        transformOrigin: '135px 145px',
                        transform: `scale(${backEarGrowth}) rotate(${-(1 - backEarGrowth) * 25}deg)`,
                      }}
                    />
                    {/* Left Main Tall Ear (Mid Green) */}
                    <path
                      d="M 148,145 C 130,80 120,38 142,30 C 158,24 168,75 168,145 Z"
                      fill={themeStyles.leafMid}
                      style={{
                        transformOrigin: '155px 145px',
                        transform: `scale(${backEarGrowth}) rotate(${-(1 - backEarGrowth) * 18}deg)`,
                      }}
                    />
                    {/* Left Inner Accent Ear (Light Green) */}
                    <path
                      d="M 160,145 C 148,95 142,60 156,52 C 168,46 175,88 175,145 Z"
                      fill={themeStyles.leafLight}
                      style={{
                        transformOrigin: '165px 145px',
                        transform: `scale(${backEarGrowth}) rotate(${-(1 - backEarGrowth) * 10}deg)`,
                      }}
                    />

                    {/* Right Inner Accent Ear (Light Green) */}
                    <path
                      d="M 225,145 C 225,88 232,46 244,52 C 258,60 252,95 240,145 Z"
                      fill={themeStyles.leafLight}
                      style={{
                        transformOrigin: '235px 145px',
                        transform: `scale(${backEarGrowth}) rotate(${(1 - backEarGrowth) * 10}deg)`,
                      }}
                    />
                    {/* Right Main Tall Ear (Mid Green) */}
                    <path
                      d="M 232,145 C 232,75 242,24 258,30 C 280,38 270,80 252,145 Z"
                      fill={themeStyles.leafMid}
                      style={{
                        transformOrigin: '245px 145px',
                        transform: `scale(${backEarGrowth}) rotate(${(1 - backEarGrowth) * 18}deg)`,
                      }}
                    />
                    {/* Right Outer Ear (Dark Moss Green) */}
                    <path
                      d="M 252,145 C 255,80 270,35 285,40 C 315,50 305,90 275,145 Z"
                      fill={themeStyles.leafDark}
                      style={{
                        transformOrigin: '265px 145px',
                        transform: `scale(${backEarGrowth}) rotate(${(1 - backEarGrowth) * 25}deg)`,
                      }}
                    />
                  </g>
                )}
              </g>
            )}

            {/* 3. 2D MODE FALLBACK: CENTRAL LUMINOUS SPHERE */}
            {!is3D && sphereScale > 0.001 && (
              <g
                style={{
                  transformOrigin: '200px 115px',
                  transform: `scale(${sphereScale * (spherePulse ? 1.62 : 1.5)})`,
                  opacity: sphereScale > 0.01 ? (hoveredTarget && hoveredTarget !== 'sphere' ? 0.65 : 1) : 0,
                  transition: spherePulse ? 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
                }}
                className="cursor-pointer group pointer-events-auto"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  spawnParticles(rect.width / 2, rect.height / 2, themeStyles.moonColor, 18);
                  if (soundEnabled) playMoonChime(0.85);
                  triggerAllBounce();
                  if (onCreatureClick) onCreatureClick('2D 核心之球 (2D Core Sphere)');
                }}
                onDoubleClick={() => {
                  if (onToggleTheme) onToggleTheme();
                  if (soundEnabled) playGateUnfold(0.8);
                }}
                onMouseEnter={() => setHoveredTarget('sphere')}
                onMouseLeave={() => setHoveredTarget(null)}
              >
                {/* Sphere Shadow on Grass Surface */}
                <ellipse cx="200" cy="155" rx="42" ry="14" fill="rgba(0,0,0,0.3)" />

                {/* Sphere Body */}
                <circle
                  cx="200"
                  cy="115"
                  r="52"
                  fill={themeStyles.moonColor}
                  filter={`drop-shadow(0 0 ${spherePulse ? '35px' : '25px'} ${themeStyles.moonGlow})`}
                />
              </g>
            )}

            {/* 4. FRONT FOLIAGE & EAR LEAVES (2D Fallback Mode Only) */}
            {!is3D && progress >= 0.35 && frontEarGrowth > 0.01 && (
              <g style={{ opacity: frontEarGrowth }}>
                {/* Front Left Tall Ear Leaves */}
                <path
                  d="M 132,175 C 112,122 110,80 135,70 C 150,65 162,112 158,172 Z"
                  fill={themeStyles.leafMid}
                  style={{
                    transformOrigin: '145px 175px',
                    transform: `scale(${frontEarGrowth})`,
                  }}
                />
                <path
                  d="M 148,178 C 132,130 130,92 148,85 C 160,80 170,122 166,178 Z"
                  fill={themeStyles.leafLight}
                  style={{
                    transformOrigin: '155px 178px',
                    transform: `scale(${frontEarGrowth})`,
                  }}
                />

                {/* Front Right Tall Ear Leaves */}
                <path
                  d="M 268,175 C 288,122 290,80 265,70 C 250,65 238,112 242,172 Z"
                  fill={themeStyles.leafMid}
                  style={{
                    transformOrigin: '255px 175px',
                    transform: `scale(${frontEarGrowth})`,
                  }}
                />
                <path
                  d="M 252,178 C 268,130 270,92 252,85 C 240,80 230,122 234,178 Z"
                  fill={themeStyles.leafLight}
                  style={{
                    transformOrigin: '245px 178px',
                    transform: `scale(${frontEarGrowth})`,
                  }}
                />

                {/* Foreground Side Ear Sprouts */}
                <path
                  d="M 85,168 C 65,140 60,110 82,105 C 95,100 110,135 118,172 Z"
                  fill={themeStyles.leafMid}
                  style={{
                    transformOrigin: '100px 170px',
                    transform: `scale(${frontEarGrowth})`,
                  }}
                />
                <path
                  d="M 98,172 C 85,148 82,122 98,118 C 108,114 120,142 128,178 Z"
                  fill={themeStyles.leafLight}
                  style={{
                    transformOrigin: '110px 175px',
                    transform: `scale(${frontEarGrowth})`,
                  }}
                />

                <path
                  d="M 315,168 C 335,140 340,110 318,105 C 305,100 290,135 282,172 Z"
                  fill={themeStyles.leafMid}
                  style={{
                    transformOrigin: '300px 170px',
                    transform: `scale(${frontEarGrowth})`,
                  }}
                />
                <path
                  d="M 302,172 C 315,148 318,122 302,118 C 292,114 280,142 272,178 Z"
                  fill={themeStyles.leafLight}
                  style={{
                    transformOrigin: '290px 175px',
                    transform: `scale(${frontEarGrowth})`,
                  }}
                />

                {/* Front Ground Edge Ear Sprouts */}
                <path
                  d="M 145,210 C 130,180 128,155 142,152 C 152,148 165,178 168,220 Z"
                  fill={themeStyles.leafLight}
                  style={{
                    transformOrigin: '150px 210px',
                    transform: `scale(${frontSproutGrowth})`,
                  }}
                />
                <path
                  d="M 255,210 C 270,180 272,155 258,152 C 248,148 235,178 232,220 Z"
                  fill={themeStyles.leafLight}
                  style={{
                    transformOrigin: '250px 210px',
                    transform: `scale(${frontSproutGrowth})`,
                  }}
                />
                <path
                  d="M 182,240 C 172,215 170,195 182,192 C 190,188 202,212 205,248 Z"
                  fill={themeStyles.leafLime}
                  style={{
                    transformOrigin: '190px 240px',
                    transform: `scale(${frontSproutGrowth})`,
                  }}
                />

                {/* Glowing Sprouts / Buds on Ground Surface */}
                <circle cx="115" cy="155" r={4.5 * frontSproutGrowth} fill={themeStyles.leafLime} className="animate-pulse" />
                <circle cx="155" cy="195" r={5 * frontSproutGrowth} fill={themeStyles.leafLime} />
                <circle cx="200" cy="235" r={6 * frontSproutGrowth} fill={themeStyles.leafLime} className="animate-pulse" />
                <circle cx="245" cy="195" r={5 * frontSproutGrowth} fill={themeStyles.leafLime} />
                <circle cx="285" cy="155" r={4.5 * frontSproutGrowth} fill={themeStyles.leafLime} className="animate-pulse" />
              </g>
            )}

            {/* 3. SPIRITS / CREATURES (Emerging as translucent eggshell yellow glowing spirits along with the grass) */}
            {spiritEmerge > 0.01 && (
              <>
                {/* 5.1 Left Spirit: 小鹿精灵 (Little Deer Spirit: Pure White Line-Art Antlers & Head, Translucent Milk-White Spirit Body) */}
                                <g clipPath="url(#deerSpiritClip)">
                <g
                  className="cursor-pointer transition-transform duration-200"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    spawnParticles(rect.width / 2, rect.height / 2, '#FFFFFF', 18);
                    if (soundEnabled) playCreaturePop(0.8, 1.4);
                    setLeftBounce(true);
                    setTimeout(() => setLeftBounce(false), 420);
                    if (onCreatureClick) onCreatureClick('小鹿精灵');
                  }}
                  onMouseEnter={() => setHoveredTarget('left')}
                  onMouseLeave={() => setHoveredTarget(null)}
                  style={{
                    transformOrigin: '75px 125px',
                    transform: `translate(${deerEntrance.bodyWiggle}px, ${(1 - deerEntrance.ease) * 80 + leftFloatY - deerPawLift + deerEntrance.anticipationDip + (leftBounce ? -18 : 0)}px) scale(${deerEntrance.ease * leftScaleBreathe * deerEntrance.squashX * (hoveredTarget === 'left' ? 1.18 : 1)}, ${deerEntrance.ease * leftScaleBreathe * deerEntrance.squashY * (hoveredTarget === 'left' ? 1.18 : 1)}) rotate(${leftSwayRotate + deerEntrance.headTilt + deerHeadTilt + (hoveredTarget === 'left' ? -3 : 0)}deg)`,
                    opacity: deerEntrance.ease * (hoveredTarget && hoveredTarget !== 'left' ? 0.65 : 1),
                  }}
                >
                  {/* Ground Aura Light & Shadow */}
                  <ellipse cx="75" cy="132" rx="20" ry="7" fill="#FEF08A" opacity={0.35 * leftGlowPulse} filter="blur(4px)" />
                  <ellipse cx="75" cy="132" rx="16" ry="5.5" fill="rgba(0,0,0,0.22)" />

                  {/* Deer Tail with flick animation */}
                  <g style={{ transformOrigin: '55px 128px', transform: `rotate(${-deerTailFlick}deg)` }}>
                    <path d="M 55,128 C 45,122 42,132 52,130 Z" fill="url(#milkWhiteSpiritBody)" stroke="#FFFFFF" strokeWidth="1.5" />
                  </g>

                  {/* Pure White Line-Art Antlers (纯白鹿角线稿) */}
                  <g style={{ transformOrigin: '64px 94px', transform: `rotate(${leftAntlerSway + deerEntrance.antlerShake}deg)` }}>
                    <path
                      d="M 64,94 C 54,76 42,65 38,55 C 36,62 46,72 50,78 C 40,75 33,76 36,82 C 43,84 54,90 62,96"
                      fill="rgba(255, 255, 255, 0.45)"
                      stroke="#FFFFFF"
                      strokeWidth="2.0"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      filter="url(#spiritSoulGlow)"
                    />
                  </g>
                  <g style={{ transformOrigin: '86px 94px', transform: `rotate(${-leftAntlerSway + deerEntrance.antlerShake}deg)` }}>
                    <path
                      d="M 86,94 C 96,76 108,65 112,55 C 114,62 104,72 100,78 C 110,75 117,76 114,82 C 107,84 96,90 88,96"
                      fill="rgba(255, 255, 255, 0.45)"
                      stroke="#FFFFFF"
                      strokeWidth="2.0"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      filter="url(#spiritSoulGlow)"
                    />
                  </g>

                  {/* Deer Ears with wiggle and entrance flop animation */}
                  <g style={{ transformOrigin: '58px 101px', transform: `rotate(${leftEarWiggle + deerEntrance.earFlop + deerNoseWiggle}deg)` }}>
                    <path d="M 58,98 C 42,92 40,105 58,104 Z" fill="url(#milkWhiteSpiritBody)" stroke="#FFFFFF" strokeWidth="1.8" />
                  </g>
                  <g style={{ transformOrigin: '92px 101px', transform: `rotate(${-leftEarWiggle - deerEntrance.earFlop}deg)` }}>
                    <path d="M 92,98 C 108,92 110,105 92,104 Z" fill="url(#milkWhiteSpiritBody)" stroke="#FFFFFF" strokeWidth="1.8" />
                  </g>

                  {/* Main Translucent Milk White Spirit Body (半透明奶白身体) */}
                  <circle cx="75" cy="114" r="21" fill="url(#milkWhiteSpiritBody)" stroke="#FFFFFF" strokeWidth="2.2" filter="url(#spiritSoulGlow)" />

                  {/* Inner Core Glow */}
                  <circle cx="75" cy="114" r="13" fill="url(#spiritCoreGlow)" />

                  {/* Forehead Spirit Star/Leaf Mark */}
                  <path d="M 75,102 Q 80,110 75,118 Q 70,110 75,102 Z" fill="#FFFFFF" fillOpacity="0.9" stroke="#FFFFFF" strokeWidth="1.0" />

                  {/* Cute Blinking Eyes & Blush (deer-specific independent cycle) */}
                  {/* Left Eye with blink */}
                  <g style={{ transformOrigin: '68px 110px' }}>
                    <ellipse cx="68" cy="110" rx="2.2" ry={2.2 * (1 - deerEyeBlink * 0.85)} fill="#1E293B" />
                    {deerEyeBlink < 0.5 && <circle cx="67.2" cy={109 - deerEyebrowLift * 0.3} r="0.8" fill="#FFFFFF" />}
                  </g>
                  {/* Right Eye with blink */}
                  <g style={{ transformOrigin: '82px 110px' }}>
                    <ellipse cx="82" cy="110" rx="2.2" ry={2.2 * (1 - deerEyeBlink * 0.85)} fill="#1E293B" />
                    {deerEyeBlink < 0.5 && <circle cx="81.2" cy={109 - deerEyebrowLift * 0.3} r="0.8" fill="#FFFFFF" />}
                  </g>
                  {/* Eyelash lines when blinking */}
                  {deerEyeBlink > 0.5 && (
                    <>
                      <line x1="65.5" y1="110" x2="70.5" y2="110" stroke="#1E293B" strokeWidth="1.5" strokeLinecap="round" />
                      <line x1="79.5" y1="110" x2="84.5" y2="110" stroke="#1E293B" strokeWidth="1.5" strokeLinecap="round" />
                    </>
                  )}
                  {/* Animated Smile */}
                  <path d={`M ${75 - 4 * deerSmileWidth},118 Q 75,${120 + deerSmileWidth * 1.5} ${75 + 4 * deerSmileWidth},118`} fill="none" stroke="#1E293B" strokeWidth="1.2" strokeLinecap="round" />
                  {/* Tongue poke (rare cute detail) */}
                  {deerTonguePoke > 0.1 && (
                    <ellipse cx="75" cy={119 + deerTonguePoke * 3} rx={1.8 * deerTonguePoke} ry={1.2 * deerTonguePoke} fill="#F87171" opacity={deerTonguePoke * 0.8} />
                  )}
                  {/* Nose wiggle */}
                  <circle cx="75" cy={115 + deerNoseWiggle * 0.3} r="1.2" fill="#F59E0B" opacity="0.6" />
                  {/* Blush */}
                  <ellipse cx="64" cy="116" rx="3" ry="1.5" fill="#F59E0B" opacity={0.5 + deerEyeBlink * 0.2} />
                  <ellipse cx="86" cy="116" rx="3" ry="1.5" fill="#F59E0B" opacity={0.5 + deerEyeBlink * 0.2} />
                </g>
                </g>

                {/* 5.2 Right Spirit: 鲸鱼精灵 (Little Whale Spirit: Pure White Line-Art Whale with Fountain Spout & Tail, Translucent Milk White Body) */}
                                <g clipPath="url(#whaleSpiritClip)">
                <g
                  className="cursor-pointer transition-transform duration-200"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    spawnParticles(rect.width / 2, rect.height / 2, '#FFFFFF', 18);
                    if (soundEnabled) playCreaturePop(0.8, 1.8);
                    setRightBounce(true);
                    setTimeout(() => setRightBounce(false), 420);
                    if (onCreatureClick) onCreatureClick('鲸鱼精灵');
                  }}
                  onMouseEnter={() => setHoveredTarget('right')}
                  onMouseLeave={() => setHoveredTarget(null)}
                  style={{
                    transformOrigin: '315px 125px',
                    transform: `translate(${whaleEntrance.bodyUndulate}px, ${(1 - whaleEntrance.ease) * 80 + rightFloatY + whaleEntrance.whaleAntDip + (rightBounce ? -18 : 0)}px) scale(${whaleEntrance.ease * rightScaleBreathe * whaleEntrance.squashX * (hoveredTarget === 'right' ? 1.18 : 1)}, ${whaleEntrance.ease * rightScaleBreathe * whaleEntrance.squashY * (hoveredTarget === 'right' ? 1.18 : 1)}) rotate(${rightSwayRotate + whaleEntrance.bodyUndulate * 0.5 + whaleBodyRoll + (hoveredTarget === 'right' ? 3 : 0)}deg)`,
                    opacity: whaleEntrance.ease * (hoveredTarget && hoveredTarget !== 'right' ? 0.65 : 1),
                  }}
                >
                  {/* Ground Aura Light & Shadow */}
                  <ellipse cx="315" cy="132" rx="22" ry="7" fill="#FEF08A" opacity={0.35 * rightGlowPulse} filter="blur(4px)" />
                  <ellipse cx="315" cy="132" rx="17" ry="5.5" fill="rgba(0,0,0,0.22)" />

                  {/* Fountain Spray with pulse and entrance burst animation */}
                  <g style={{ transformOrigin: '308px 92px', transform: `scale(${rightFountainPulse * (1 + whaleEntrance.spoutBurst + whaleSpoutExtra)})`, opacity: 0.6 + rightFountainPulse * 0.4 + whaleEntrance.spoutBurst * 0.3 }}>
                    <path d="M 308,92 Q 302,82 296,76 M 308,92 Q 308,80 308,72 M 308,92 Q 314,82 320,76" fill="none" stroke="#FFFFFF" strokeWidth="2.0" strokeLinecap="round" filter="url(#spiritSoulGlow)" />
                    <circle cx="295" cy="74" r="2.2" fill="#FFFFFF" />
                    <circle cx="308" cy="70" r="2.5" fill="#FFFFFF" />
                    <circle cx="321" cy="74" r="2.2" fill="#FFFFFF" />
                  </g>

                  {/* Whale Tail Flukes with wag and entrance whip animation */}
                  <g style={{ transformOrigin: '338px 114px', transform: `rotate(${rightTailWag + whaleEntrance.tailWhip + whaleBodyRoll}deg)` }}>
                    <path
                      d="M 338,114 C 348,106 356,108 350,118 C 358,124 352,132 342,122 Z"
                      fill="url(#milkWhiteSpiritBody)"
                      stroke="#FFFFFF"
                      strokeWidth="2.0"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      filter="url(#spiritSoulGlow)"
                    />
                  </g>

                  {/* Main Whale Spirit Body (鲸鱼圆滚滚身体) */}
                  <path
                    d="M 288,112 C 286,94 312,92 330,102 C 342,108 346,116 338,122 C 322,128 292,128 288,112 Z"
                    fill="url(#milkWhiteSpiritBody)"
                    stroke="#FFFFFF"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#spiritSoulGlow)"
                  />

                  {/* Side Flipper with flap and entrance wave animation */}
                  <g style={{ transformOrigin: '302px 118px', transform: `rotate(${rightFlipperFlap + whaleEntrance.flipperWave + whaleFinWave}deg)` }}>
                    <path d="M 302,118 C 298,126 308,128 312,120 Z" fill="url(#milkWhiteSpiritBody)" stroke="#FFFFFF" strokeWidth="1.8" />
                  </g>

                  {/* Inner Core Glow */}
                  <ellipse cx="310" cy="112" rx="14" ry="10" fill="url(#spiritCoreGlow)" />

                  {/* Cute Blinking Eye & Animated Smile (whale-specific independent cycle) */}
                  <g style={{ transformOrigin: '298px 108px' }}>
                    <ellipse cx="298" cy="108" rx="2.2" ry={2.2 * (1 - whaleEyeBlink * 0.85)} fill="#1E293B" />
                    {whaleEyeBlink < 0.5 && <circle cx="297.2" cy={107 - whaleEyebrowLift * 0.3} r="0.8" fill="#FFFFFF" />}
                  </g>
                  {/* Eyelash line when blinking */}
                  {whaleEyeBlink > 0.5 && (
                    <line x1="295.5" y1="108" x2="300.5" y2="108" stroke="#1E293B" strokeWidth="1.5" strokeLinecap="round" />
                  )}
                  {/* Animated Smile - widens and narrows */}
                  <path d={`M 292,114 Q 296,${117 + whaleSmileWidth} 300,114`} fill="none" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
                  {/* Jaw movement */}
                  <path d={`M 290,${116 + whaleJawOpen} Q 296,${119 + whaleJawOpen} 302,${116 + whaleJawOpen}`} fill="none" stroke="#FFFFFF" strokeWidth="0.8" strokeLinecap="round" opacity={whaleJawOpen > 0.5 ? 0.6 : 0} />
                  {/* Blush */}
                  <ellipse cx="304" cy="114" rx="2.5" ry="1.3" fill="#F59E0B" opacity={0.5 + whaleEyeBlink * 0.2} />
                </g>
                </g>

                {/* 5.3 Front Spirit: 小团精灵 (Little Blob Spirit: Round Ghost Dumpling Spirit, Pure White Line-Art & Translucent Milk White Body) */}
                                <g clipPath="url(#blobSpiritClip)">
                <g
                  className="cursor-pointer transition-transform duration-200"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    spawnParticles(rect.width / 2, rect.height / 2, '#FFFFFF', 18);
                    if (soundEnabled) playCreaturePop(0.8, 1.6);
                    setFrontBounce(true);
                    setTimeout(() => setFrontBounce(false), 420);
                    if (onCreatureClick) onCreatureClick('小团精灵');
                  }}
                  onMouseEnter={() => setHoveredTarget('front')}
                  onMouseLeave={() => setHoveredTarget(null)}
                  style={{
                    transformOrigin: '200px 225px',
                    transform: `translate(${blobWobble}px, ${(1 - blobEntrance.ease) * 70 + frontFloatY + blobEntrance.bodyBounce - blobHop + blobEntrance.blobAntDip + (frontBounce ? -18 : 0)}px) scale(${blobEntrance.ease * frontScaleBreathe * blobEntrance.squashX * (1 + blobEntrance.squishPulse) * (hoveredTarget === 'front' ? 1.18 : 1) * blobMorphX}, ${blobEntrance.ease * frontScaleBreathe * blobEntrance.squashY * (1 - blobEntrance.squishPulse) * (hoveredTarget === 'front' ? 1.18 : 1) * frontSquashY}) rotate(${frontSwayRotate + (hoveredTarget === 'front' ? 2 : 0)}deg)`,
                    opacity: blobEntrance.ease * (hoveredTarget && hoveredTarget !== 'front' ? 0.65 : 1),
                  }}
                >
                  {/* Ground Aura Light & Shadow */}
                  <ellipse cx="200" cy="235" rx="18" ry="6" fill="#FEF08A" opacity={0.38 * frontGlowPulse} filter="blur(4px)" />
                  <ellipse cx="200" cy="235" rx="14" ry="5" fill="rgba(0,0,0,0.25)" />

                  {/* Floating Spirit Halo Ring with rotation and entrance spin */}
                  <g style={{ transformOrigin: '200px 195px', transform: `rotate(${frontHaloRotate + blobEntrance.haloSpin}deg)` }}>
                    <ellipse cx="200" cy="195" rx="11" ry="3.8" fill="none" stroke="#FFFFFF" strokeWidth="1.6" strokeDasharray="3,2" opacity="0.95" filter="url(#spiritSoulGlow)" />
                  </g>

                  {/* Cute Little Spirit Ears / Tufts with wiggle and entrance flap */}
                  <g style={{ transformOrigin: '192px 206px', transform: `rotate(${frontTuftWiggle + blobEntrance.tuftFlap + blobWobble}deg)` }}>
                    <path d="M 188,206 C 182,194 192,192 196,202 Z" fill="url(#milkWhiteSpiritBody)" stroke="#FFFFFF" strokeWidth="1.8" />
                  </g>
                  <g style={{ transformOrigin: '208px 206px', transform: `rotate(${-frontTuftWiggle - blobEntrance.tuftFlap - blobWobble}deg)` }}>
                    <path d="M 212,206 C 218,194 208,192 204,202 Z" fill="url(#milkWhiteSpiritBody)" stroke="#FFFFFF" strokeWidth="1.8" />
                  </g>

                  {/* Main Round Blob Spirit Body (小团子纯白线稿 + 半透明奶白) */}
                  <circle cx="200" cy="220" r="16.5" fill="url(#milkWhiteSpiritBody)" stroke="#FFFFFF" strokeWidth="2.2" filter="url(#spiritSoulGlow)" />

                  {/* Inner Core Glow */}
                  <circle cx="200" cy="220" r="10" fill="url(#spiritCoreGlow)" />

                  {/* Cute Blinking Eyes & Animated Smile (blob-specific independent cycle) */}
                  {/* Left Eye - round with blink */}
                  <g style={{ transformOrigin: '196px 217px' }}>
                    <ellipse cx="196" cy="217" rx="2.0" ry={2.0 * (1 - blobEyeBlink * 0.9)} fill="#1E293B" />
                    {blobEyeBlink < 0.5 && <circle cx="195.3" cy="216.2" r="0.7" fill="#FFFFFF" />}
                  </g>
                  {/* Right Eye - round with blink */}
                  <g style={{ transformOrigin: '204px 217px' }}>
                    <ellipse cx="204" cy="217" rx="2.0" ry={2.0 * (1 - blobEyeBlink * 0.9)} fill="#1E293B" />
                    {blobEyeBlink < 0.5 && <circle cx="203.3" cy="216.2" r="0.7" fill="#FFFFFF" />}
                  </g>
                  {/* Eyelash lines when blinking */}
                  {blobEyeBlink > 0.5 && (
                    <>
                      <line x1="193.5" y1="217" x2="198.5" y2="217" stroke="#1E293B" strokeWidth="1.5" strokeLinecap="round" />
                      <line x1="201.5" y1="217" x2="206.5" y2="217" stroke="#1E293B" strokeWidth="1.5" strokeLinecap="round" />
                    </>
                  )}
                  {/* Animated Smile */}
                  <path d={`M ${200 - 3 * blobSmileWidth},${221} Q 200,${224 + blobSmileWidth} ${200 + 3 * blobSmileWidth},${221}`} fill="none" stroke="#1E293B" strokeWidth="1.4" strokeLinecap="round" />
                  {/* Pulsing Blush */}
                  <ellipse cx="192" cy="222" rx={2.2 * blobCheekPuff} ry="1.2" fill="#F59E0B" opacity={blobBlushPulse} />
                  <ellipse cx="208" cy="222" rx={2.2 * blobCheekPuff} ry="1.2" fill="#F59E0B" opacity={blobBlushPulse} />
                  <ellipse cx="208" cy="222" rx="2.2" ry="1.2" fill="#F59E0B" opacity="0.65" />
                </g>
                </g>

                {/* 5.4 Interactive Tooltip Popovers */}
                {hoveredTarget === 'left' && (
                  <g transform={`translate(75, ${52 + leftFloatY})`} className="pointer-events-none">
                    <rect x="-34" y="-12" width="68" height="20" rx="6" fill="#0F172A" stroke="#FFFFFF" strokeWidth="1.2" />
                    <text x="0" y="2" fill="#FEF08A" fontSize="10" fontWeight="bold" textAnchor="middle">
                      小鹿精灵
                    </text>
                  </g>
                )}

                {hoveredTarget === 'right' && (
                  <g transform={`translate(315, ${60 + rightFloatY})`} className="pointer-events-none">
                    <rect x="-34" y="-12" width="68" height="20" rx="6" fill="#0F172A" stroke="#FFFFFF" strokeWidth="1.2" />
                    <text x="0" y="2" fill="#FEF08A" fontSize="10" fontWeight="bold" textAnchor="middle">
                      鲸鱼精灵
                    </text>
                  </g>
                )}

                {hoveredTarget === 'front' && (
                  <g transform={`translate(200, ${186 + frontFloatY})`} className="pointer-events-none">
                    <rect x="-34" y="-12" width="68" height="20" rx="6" fill="#0F172A" stroke="#FFFFFF" strokeWidth="1.2" />
                    <text x="0" y="2" fill="#FEF08A" fontSize="10" fontWeight="bold" textAnchor="middle">
                      小团精灵
                    </text>
                  </g>
                )}

                {/* VIRTUAL RULER & DYNAMIC MEASUREMENT OVERLAY */}
                {showRuler && (
                  <g className="font-mono select-none">
                    {/* Top Ruler Axes & Ticks */}
                    <g className="pointer-events-none">
                      <line x1="20" y1="12" x2="380" y2="12" stroke="#F59E0B" strokeWidth="1.2" opacity="0.8" />
                      {[20, 60, 100, 140, 180, 220, 260, 300, 340, 380].map((x) => (
                        <g key={`x-tick-${x}`}>
                          <line x1={x} y1="8" x2={x} y2="16" stroke="#F59E0B" strokeWidth="1.2" opacity="0.9" />
                          <text x={x} y="6" fill="#F59E0B" fontSize="8" textAnchor="middle" opacity="0.9">
                            {x}
                          </text>
                        </g>
                      ))}

                      {/* Left Ruler Axes & Ticks */}
                      <line x1="12" y1="20" x2="12" y2="300" stroke="#F59E0B" strokeWidth="1.2" opacity="0.8" />
                      {[20, 60, 100, 140, 180, 220, 260, 300].map((y) => (
                        <g key={`y-tick-${y}`}>
                          <line x1="8" y1={y} x2="16" y2={y} stroke="#F59E0B" strokeWidth="1.2" opacity="0.9" />
                          <text x="6" y={y + 3} fill="#F59E0B" fontSize="8" textAnchor="end" opacity="0.9">
                            {y}
                          </text>
                        </g>
                      ))}
                    </g>

                    {/* DYNAMIC ANIMATED BOUNDARY CALIPERS (Tracks animation progress in real-time) */}
                    {outwardEmerge > 0.001 && (
                      <g className="pointer-events-none">
                        {/* Dynamic Platform Bounding Crosshair */}
                        <polygon
                          points={`${200},${pTopY} ${pRightX},${pRightY} ${200},${pBottomY} ${pLeftX},${pLeftY}`}
                          fill="none"
                          stroke="#F59E0B"
                          strokeWidth="1.2"
                          strokeDasharray="4,3"
                          opacity="0.85"
                        />

                        {/* Real-time Dynamic Width Caliper Line (W = 2 * dx px) */}
                        <line x1={pLeftX} y1={pBottomY + 16} x2={pRightX} y2={pBottomY + 16} stroke="#38BDF8" strokeWidth="1.5" />
                        <line x1={pLeftX} y1={pBottomY + 10} x2={pLeftX} y2={pBottomY + 22} stroke="#38BDF8" strokeWidth="1.5" />
                        <line x1={pRightX} y1={pBottomY + 10} x2={pRightX} y2={pBottomY + 22} stroke="#38BDF8" strokeWidth="1.5" />
                        <rect x="150" y={pBottomY + 7} width="100" height="18" rx="4" fill="#0F172A" stroke="#38BDF8" strokeWidth="1" />
                        <text x="200" y={pBottomY + 20} fill="#38BDF8" fontSize="10" fontWeight="bold" textAnchor="middle">
                          W = {Math.round(dx * 2)} px
                        </text>

                        {/* Real-time Dynamic Depth Caliper Line (D = pBottomY - pTopY px) */}
                        <line x1={pRightX + 16} y1={pTopY} x2={pRightX + 16} y2={pBottomY} stroke="#38BDF8" strokeWidth="1.5" />
                        <line x1={pRightX + 10} y1={pTopY} x2={pRightX + 22} y2={pTopY} stroke="#38BDF8" strokeWidth="1.5" />
                        <line x1={pRightX + 10} y1={pBottomY} x2={pRightX + 22} y2={pBottomY} stroke="#38BDF8" strokeWidth="1.5" />
                        <rect x={pRightX + 22} y={(pTopY + pBottomY) / 2 - 9} width="72" height="18" rx="4" fill="#0F172A" stroke="#38BDF8" strokeWidth="1" />
                        <text x={pRightX + 58} y={(pTopY + pBottomY) / 2 + 4} fill="#38BDF8" fontSize="10" fontWeight="bold" textAnchor="middle">
                          D = {Math.round(pBottomY - pTopY)} px
                        </text>

                        {/* Real-time Dynamic Sphere Diameter Callout */}
                        {sphereScale > 0.01 && (
                          <>
                            <circle cx="200" cy="115" r={52 * sphereScale} fill="none" stroke="#F59E0B" strokeWidth="1" strokeDasharray="3,3" />
                            <line x1={200 - 52 * sphereScale} y1="115" x2={200 + 52 * sphereScale} y2="115" stroke="#F59E0B" strokeWidth="1.2" />
                            <circle cx="200" cy="115" r="3" fill="#F59E0B" />
                            <rect x="155" y="100" width="90" height="15" rx="3" fill="#0F172A" stroke="#F59E0B" strokeWidth="0.8" />
                            <text x="200" y="111" fill="#F59E0B" fontSize="9" fontWeight="bold" textAnchor="middle">
                              ⌀ {Math.round(104 * sphereScale)} px
                            </text>
                          </>
                        )}
                      </g>
                    )}

                    {/* INTERACTIVE DRAGGABLE TAPE MEASURE LINE & PINS A / B */}
                    <g className="pointer-events-auto">
                      {/* Connecting Measuring Tape Line */}
                      <line
                        x1={rulerPinA.x}
                        y1={rulerPinA.y}
                        x2={rulerPinB.x}
                        y2={rulerPinB.y}
                        stroke="#F59E0B"
                        strokeWidth="2"
                        strokeDasharray="5,3"
                        className="animate-pulse"
                      />

                      {/* Distance Badge Label at Midpoint */}
                      {(() => {
                        const midX = (rulerPinA.x + rulerPinB.x) / 2;
                        const midY = (rulerPinA.y + rulerPinB.y) / 2;
                        const dist = Math.round(Math.hypot(rulerPinB.x - rulerPinA.x, rulerPinB.y - rulerPinA.y));
                        return (
                          <g transform={`translate(${midX}, ${midY})`}>
                            <rect x="-38" y="-10" width="76" height="20" rx="6" fill="#0F172A" stroke="#F59E0B" strokeWidth="1.2" />
                            <text x="0" y="3" fill="#F59E0B" fontSize="10" fontWeight="bold" textAnchor="middle">
                              L = {dist} px
                            </text>
                          </g>
                        );
                      })()}

                      {/* Interactive Pin A Handle (Blue 🔵) */}
                      <g
                        transform={`translate(${rulerPinA.x}, ${rulerPinA.y})`}
                        className="cursor-grab active:cursor-grabbing"
                        onPointerDown={(e) => handlePinPointerDown('A', e)}
                      >
                        <circle r="14" fill="rgba(59, 130, 246, 0.35)" />
                        <circle r="9" fill="#3B82F6" stroke="#FFFFFF" strokeWidth="2" />
                        <text x="0" y="3.5" fill="#FFFFFF" fontSize="9" fontWeight="bold" textAnchor="middle" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                          A
                        </text>
                      </g>

                      {/* Interactive Pin B Handle (Red 🔴) */}
                      <g
                        transform={`translate(${rulerPinB.x}, ${rulerPinB.y})`}
                        className="cursor-grab active:cursor-grabbing"
                        onPointerDown={(e) => handlePinPointerDown('B', e)}
                      >
                        <circle r="14" fill="rgba(239, 68, 68, 0.35)" />
                        <circle r="9" fill="#EF4444" stroke="#FFFFFF" strokeWidth="2" />
                        <text x="0" y="3.5" fill="#FFFFFF" fontSize="9" fontWeight="bold" textAnchor="middle" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                          B
                        </text>
                      </g>
                    </g>
                  </g>
                )}
              </>
            )}
          </svg>
        </div>

        {/* ================= STAGE C: 3D ISOMETRIC GATE TYPOGRAPHY UNFOLDING BENEATH ================= */}
        <motion.div
          style={{
            scaleY: gateUnfold,
            opacity: gateUnfold > 0.02 ? 1 : 0,
            transformOrigin: 'top center',
          }}
          className="relative z-40 w-full max-w-[340px] sm:max-w-[380px] -mt-16 sm:-mt-20 flex flex-col items-center justify-center pointer-events-none"
        >
          {/* Front 3D Block Typography "众生之门" without outer/inner frame boxes */}
          <BlockTypography
            progress={gateUnfold}
            colorScheme={{
              blockFace: themeStyles.accentText,
              blockTop: '#FFFFFF',
              blockSide: '#3C572D',
              textColor: themeStyles.accentText,
            }}
          />
        </motion.div>
      </motion.div>
    </div>
  );
};
