/* ============================================================================
   AchievementBanner.tsx — 成就解锁条（R3）
   ----------------------------------------------------------------------------
   与胜利结算错峰播放（默认 3000ms，呼应 settlement.achievement.show_after_ms），
   避免「登场动画」与「成就弹窗」打架。
   ============================================================================ */

import { useEffect, useState } from 'react';
import type { SixSysAchievement } from './sixsys-types';

export interface AchievementBannerProps {
  achievements: SixSysAchievement[];
  /** 延迟出现，默认 3000ms（结算演出结束后） */
  delayMs?: number;
  /** 单条展示时长，默认 4200ms */
  durationMs?: number;
  className?: string;
}

export function AchievementBanner(props: AchievementBannerProps) {
  const { achievements, delayMs = 3000, durationMs = 4200, className } = props;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!achievements.length) {
      setVisible(false);
      return;
    }
    setVisible(false);
    const show = window.setTimeout(() => setVisible(true), delayMs);
    const hide = window.setTimeout(() => setVisible(false), delayMs + durationMs);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [achievements, delayMs, durationMs]);

  if (!achievements.length) return null;

  return (
    <div
      className={['sixsys-banner', visible ? 'is-visible' : '', className || ''].filter(Boolean).join(' ')}
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
    >
      <span className="sixsys-banner-eyebrow">成就解锁</span>
      <ul className="sixsys-banner-list">
        {achievements.map((a) => (
          <li key={a.id} className={`sixsys-banner-item sixsys-banner-${a.category}`}>
            <strong>{a.name}</strong>
            <span>{a.desc}</span>
            <small>
              {a.id} · {a.progress.metric} {a.progress.target}
            </small>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default AchievementBanner;
