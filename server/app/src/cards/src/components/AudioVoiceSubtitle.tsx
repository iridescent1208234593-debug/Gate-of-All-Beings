import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, Sparkles, Heart } from 'lucide-react';

interface AudioVoiceSubtitleProps {
  isVisible: boolean;
  text?: string;
  subtext?: string;
  onSpeak?: () => void;
  clickedCreature?: string | null;
}

export const AudioVoiceSubtitle: React.FC<AudioVoiceSubtitleProps> = ({
  isVisible,
  text = '你好，欢迎来到众生之门',
  subtext = 'Hello, Welcome to Gate of Living All Creatures',
  onSpeak,
  clickedCreature,
}) => {
  const [displayText, setDisplayText] = useState('');

  // Typewriter effect when visible
  useEffect(() => {
    if (!isVisible) {
      setDisplayText('');
      return;
    }

    let idx = 0;
    const timer = setInterval(() => {
      if (idx <= text.length) {
        setDisplayText(text.slice(0, idx));
        idx++;
      } else {
        clearInterval(timer);
      }
    }, 100);

    return () => clearInterval(timer);
  }, [isVisible, text]);

  return (
    <div className="w-full flex flex-col items-center justify-center my-2 min-h-[64px]">
      <AnimatePresence mode="wait">
        {clickedCreature ? (
          <motion.div
            key="creature-dialog"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-sm font-medium shadow-lg backdrop-blur-md"
          >
            <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" />
            <span>互动灵体: <strong className="text-white">{clickedCreature}</strong></span>
            <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
          </motion.div>
        ) : isVisible ? (
          <motion.div
            key="greeting-dialog"
            initial={{ opacity: 0, y: 12, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 200, damping: 18 }}
            onClick={onSpeak}
            className="group cursor-pointer flex flex-col items-center justify-center px-6 py-2.5 rounded-2xl bg-gradient-to-r from-slate-900/90 via-emerald-950/80 to-slate-900/90 border border-emerald-500/30 text-amber-100 shadow-2xl backdrop-blur-md hover:border-emerald-400/60 transition-all hover:scale-[1.02]"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg md:text-xl font-bold tracking-wider font-sans text-amber-100">
                {displayText}
              </span>
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Volume2 className="w-4 h-4 text-amber-300 opacity-80 group-hover:opacity-100" />
              </motion.div>
            </div>
            {subtext && (
              <span className="text-[11px] text-emerald-400/80 tracking-widest font-mono mt-0.5 uppercase">
                {subtext}
              </span>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
