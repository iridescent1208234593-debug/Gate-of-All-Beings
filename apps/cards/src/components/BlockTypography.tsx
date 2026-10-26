import React from 'react';
import { motion } from 'motion/react';

interface BlockTypographyProps {
  progress: number; // 0 to 1 for unfold animation
  colorScheme?: {
    blockFace: string;
    blockTop: string;
    blockSide: string;
    textColor: string;
  };
}

export const BlockTypography: React.FC<BlockTypographyProps> = ({
  progress,
  colorScheme = {
    blockFace: '#FAF5DC',
    blockTop: '#FFFFFF',
    blockSide: '#243719',
    textColor: '#FAF5DC',
  },
}) => {
  const isVisible = progress > 0.1;
  const letterRevealDelay = (idx: number) => 0.1 + idx * 0.08;

  return (
    <div className="relative w-full flex flex-col items-center justify-center pointer-events-none select-none my-1">
      {/* Background Isometric Box / Envelope Base (Matching video frame 00:03) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: -10 }}
        animate={isVisible ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.8, y: -10 }}
        transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
        className="absolute -inset-x-2 -inset-y-3 z-0 flex items-center justify-center"
      >
        <svg viewBox="0 0 360 120" className="w-full h-full overflow-visible drop-shadow-lg">
          <defs>
            <linearGradient id="titleBoxTop" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#75A056" />
              <stop offset="100%" stopColor="#537B3D" />
            </linearGradient>
            <linearGradient id="titleBoxLeft" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3A542A" />
              <stop offset="100%" stopColor="#2D4222" />
            </linearGradient>
            <linearGradient id="titleBoxRight" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#243719" />
              <stop offset="100%" stopColor="#1E2F18" />
            </linearGradient>
          </defs>

          {/* Unfolded Box Top V-Flap */}
          <polygon points="180,8 335,42 180,68 25,42" fill="url(#titleBoxTop)" opacity="0.4" />

          {/* Unfolded Front Left Box Wall */}
          <polygon points="25,42 180,68 180,108 25,80" fill="url(#titleBoxLeft)" opacity="0.85" />

          {/* Unfolded Front Right Box Wall */}
          <polygon points="180,68 335,42 335,80 180,108" fill="url(#titleBoxRight)" opacity="0.85" />

          {/* Gold / Lime Accent Edge Line */}
          <polyline points="25,42 180,68 335,42" fill="none" stroke="#FAF5DC" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
          <polyline points="180,68 180,108" fill="none" stroke="#A3D182" strokeWidth="2.0" strokeLinecap="round" opacity="0.7" />
        </svg>
      </motion.div>

      {/* Foreground 3D Isometric Chinese Characters: "众" "生" "之" "门" */}
      <div className="relative z-10 flex items-center justify-center gap-1.5 sm:gap-2.5 md:gap-3.5 my-1 group cursor-pointer">
        {/* Left Decorative 3D Isometric Cube */}
        <motion.div
          initial={{ opacity: 0, scale: 0, rotate: -45 }}
          animate={isVisible ? { opacity: 1, scale: 1, rotate: 0 } : { opacity: 0, scale: 0, rotate: -45 }}
          transition={{ duration: 0.5, delay: 0.12, ease: [0.34, 1.56, 0.64, 1] }}
          className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 drop-shadow-md mr-0.5"
        >
          <svg viewBox="0 0 40 40" className="w-full h-full">
            {/* Top Face */}
            <polygon points="20,4 36,12 20,20 4,12" fill="#A3D182" />
            {/* Left Face */}
            <polygon points="4,12 20,20 20,36 4,28" fill="#537B3D" />
            {/* Right Face */}
            <polygon points="20,20 36,12 36,28 20,36" fill="#243719" />
          </svg>
        </motion.div>

        {/* Character 1: 众 (Zhòng) - Chunky Anime Block Art */}
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.8, rotateX: -20 }}
          animate={isVisible ? { opacity: 1, y: 0, scale: 1, rotateX: 0 } : { opacity: 0, y: 14, scale: 0.8, rotateX: -20 }}
          transition={{ duration: 0.45, delay: letterRevealDelay(0), ease: [0.34, 1.56, 0.64, 1] }}
          className="relative group hover:scale-105 transition-transform"
        >
          <svg className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 drop-shadow-md" viewBox="0 0 100 100">
            {/* 3D Extrusion Side Depth */}
            <g fill={colorScheme.blockSide}>
              {/* Top Person Side */}
              <polygon points="50,14 70,38 60,38 50,26 40,38 30,38" />
              <polygon points="50,14 50,19 70,43 70,38" />
              {/* Bottom Left Person Side */}
              <polygon points="28,42 48,66 38,66 28,54 18,66 8,66" />
              {/* Bottom Right Person Side */}
              <polygon points="72,42 92,66 82,66 72,54 62,66 52,66" />
              {/* Stem Base */}
              <rect x="42" y="60" width="16" height="26" rx="3" />
            </g>

            {/* Front Faces (Cream White / Gold Accent) */}
            <g fill={colorScheme.blockFace}>
              {/* Top Person */}
              <polygon points="50,8 70,32 60,32 50,20 40,32 30,32" />
              {/* Bottom Left Person */}
              <polygon points="28,36 48,60 38,60 28,48 18,60 8,60" />
              {/* Bottom Right Person */}
              <polygon points="72,36 92,60 82,60 72,48 62,60 52,60" />
              {/* Center Stem */}
              <rect x="42" y="54" width="16" height="26" rx="3" />
            </g>

            {/* Highlight Edge Lines */}
            <g stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" opacity="0.6">
              <line x1="50" y1="8" x2="30" y2="32" />
              <line x1="28" y1="36" x2="8" y2="60" />
              <line x1="72" y1="36" x2="52" y2="60" />
            </g>
          </svg>
        </motion.div>

        {/* Character 2: 生 (Shēng) - Chunky Anime Block Art */}
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.8, rotateX: -20 }}
          animate={isVisible ? { opacity: 1, y: 0, scale: 1, rotateX: 0 } : { opacity: 0, y: 14, scale: 0.8, rotateX: -20 }}
          transition={{ duration: 0.45, delay: letterRevealDelay(1), ease: [0.34, 1.56, 0.64, 1] }}
          className="relative group hover:scale-105 transition-transform"
        >
          <svg className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 drop-shadow-md" viewBox="0 0 100 100">
            {/* Extrusion Side Depth */}
            <g fill={colorScheme.blockSide}>
              <rect x="42" y="12" width="16" height="74" rx="3" />
              <rect x="18" y="40" width="64" height="14" rx="3" />
              <rect x="24" y="58" width="52" height="12" rx="3" />
              <rect x="10" y="78" width="80" height="16" rx="3" />
            </g>

            {/* Front Faces */}
            <g fill={colorScheme.blockFace}>
              {/* Main Vertical Stem */}
              <rect x="42" y="6" width="16" height="74" rx="3" />
              {/* Top Slant Stroke */}
              <polygon points="42,18 18,30 18,20 42,8" />
              {/* Top Horizontal Bar */}
              <rect x="18" y="34" width="64" height="14" rx="3" />
              {/* Middle Horizontal Bar */}
              <rect x="24" y="52" width="52" height="12" rx="3" />
              {/* Bottom Base Bar */}
              <rect x="10" y="72" width="80" height="16" rx="3" />
            </g>

            {/* Highlight Edge Lines */}
            <g stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" opacity="0.6">
              <line x1="42" y1="6" x2="58" y2="6" />
              <line x1="18" y1="34" x2="82" y2="34" />
              <line x1="10" y1="72" x2="90" y2="72" />
            </g>
          </svg>
        </motion.div>

        {/* Character 3: 之 (Zhī) - Chunky Anime Block Art */}
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.8, rotateX: -20 }}
          animate={isVisible ? { opacity: 1, y: 0, scale: 1, rotateX: 0 } : { opacity: 0, y: 14, scale: 0.8, rotateX: -20 }}
          transition={{ duration: 0.45, delay: letterRevealDelay(2), ease: [0.34, 1.56, 0.64, 1] }}
          className="relative group hover:scale-105 transition-transform"
        >
          <svg className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 drop-shadow-md" viewBox="0 0 100 100">
            {/* Extrusion Side Depth */}
            <g fill={colorScheme.blockSide}>
              <polygon points="40,18 56,18 56,28 40,28" />
              <polygon points="18,38 82,38 70,52 28,52" />
              <polygon points="28,52 52,70 88,88 12,88" />
            </g>

            {/* Front Faces */}
            <g fill={colorScheme.blockFace}>
              {/* Top Dot */}
              <polygon points="40,10 56,10 50,22 34,22" />
              {/* 横撇 Horizontal Slant */}
              <polygon points="18,30 82,30 68,44 28,44" />
              {/* 捺 Sweeping Base */}
              <path d="M 28,44 Q 42,62 58,70 L 90,82 L 82,90 L 12,90 Q 30,72 28,44 Z" />
            </g>

            {/* Highlight Edge Lines */}
            <g stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" opacity="0.6">
              <line x1="18" y1="30" x2="82" y2="30" />
              <line x1="40" y1="10" x2="56" y2="10" />
            </g>
          </svg>
        </motion.div>

        {/* Character 4: 门 (Mén) - Chunky Anime Block Art */}
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.8, rotateX: -20 }}
          animate={isVisible ? { opacity: 1, y: 0, scale: 1, rotateX: 0 } : { opacity: 0, y: 14, scale: 0.8, rotateX: -20 }}
          transition={{ duration: 0.45, delay: letterRevealDelay(3), ease: [0.34, 1.56, 0.64, 1] }}
          className="relative group hover:scale-105 transition-transform"
        >
          <svg className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 drop-shadow-md" viewBox="0 0 100 100">
            {/* Extrusion Side Depth */}
            <g fill={colorScheme.blockSide}>
              <rect x="18" y="14" width="14" height="20" rx="3" />
              <rect x="18" y="40" width="14" height="46" rx="3" />
              <rect x="18" y="16" width="64" height="14" rx="3" />
              <rect x="68" y="16" width="14" height="72" rx="3" />
            </g>

            {/* Front Faces */}
            <g fill={colorScheme.blockFace}>
              {/* Left Top Dot/Pillar */}
              <rect x="18" y="8" width="14" height="20" rx="3" />
              {/* Left Vertical Pillar */}
              <rect x="18" y="34" width="14" height="46" rx="3" />
              {/* Top Horizontal Bar */}
              <rect x="18" y="10" width="64" height="14" rx="3" />
              {/* Right Vertical Pillar with Bottom Hook */}
              <rect x="68" y="10" width="14" height="72" rx="3" />
              <polygon points="68,82 48,68 48,78 68,90" />
            </g>

            {/* Highlight Edge Lines */}
            <g stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" opacity="0.6">
              <line x1="18" y1="10" x2="82" y2="10" />
              <line x1="18" y1="8" x2="18" y2="80" />
              <line x1="82" y1="10" x2="82" y2="82" />
            </g>
          </svg>
        </motion.div>

        {/* Right Decorative 3D Isometric Cube */}
        <motion.div
          initial={{ opacity: 0, scale: 0, rotate: 45 }}
          animate={isVisible ? { opacity: 1, scale: 1, rotate: 0 } : { opacity: 0, scale: 0, rotate: 45 }}
          transition={{ duration: 0.5, delay: 0.12, ease: [0.34, 1.56, 0.64, 1] }}
          className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 drop-shadow-md ml-0.5"
        >
          <svg viewBox="0 0 40 40" className="w-full h-full">
            {/* Top Face */}
            <polygon points="20,4 36,12 20,20 4,12" fill="#A3D182" />
            {/* Left Face */}
            <polygon points="4,12 20,20 20,36 4,28" fill="#537B3D" />
            {/* Right Face */}
            <polygon points="20,20 36,12 36,28 20,36" fill="#243719" />
          </svg>
        </motion.div>
      </div>

      {/* Subtitle Typography: 3D Blocky "LIVING" & "ALL CREATURES" */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
        transition={{ duration: 0.4, delay: 0.38 }}
        className="relative z-10 flex flex-col items-center justify-center font-black uppercase text-center mt-1 transition-transform duration-300 group-hover:-translate-y-1"
      >
        <div className="flex flex-col items-center leading-none font-extrabold tracking-[0.32em] text-[11px] sm:text-xs md:text-sm gap-1">
          {/* Top Line: LIVING */}
          <span
            className="drop-shadow-[0_2px_0px_#243719] px-2 py-0.5 rounded bg-[#3A542A]/40 border border-[#FAF5DC]/30 text-[#FAF5DC]"
            style={{
              textShadow: '0px 2px 0px #1E2F18, 0px 3px 4px rgba(0,0,0,0.5)',
            }}
          >
            LIVING
          </span>

          {/* Bottom Line: ALL CREATURES */}
          <span
            className="drop-shadow-[0_2px_0px_#243719] px-2.5 py-0.5 rounded bg-[#3A542A]/40 border border-[#FAF5DC]/30 text-[#FAF5DC]"
            style={{
              textShadow: '0px 2px 0px #1E2F18, 0px 3px 4px rgba(0,0,0,0.5)',
            }}
          >
            ALL CREATURES
          </span>
        </div>
      </motion.div>
    </div>
  );
};

