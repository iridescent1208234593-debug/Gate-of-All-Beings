/* ============================================================================
   SettlementStage.tsx — 胜负结算舞台（R3）
   ----------------------------------------------------------------------------
   情绪双轨（docs/04）：
     胜 → 罗小黑 + 比丢登场（约 3.0s）→ 正向反馈文案 → 成就错峰解锁
     负 → 小黑安慰表情图 → 安慰文案 → 一键「再来一次」
   失败不惩罚：不扣资源、不掉进度、不判定成就（由 settlement.js 的 penalty=false 保证）。

   数据驱动：全部时序来自 window.SixSystemSettlement.resolve(ctx) 的 timeline；
   引擎缺失时使用本地兜底时间轴（与 docs/04 逐字同源）。
   素材红线：所有图像经 sixsys-assets.ts 映射到 /sixsys/official/，外链一律不采用。
   ============================================================================ */

import { useEffect, useMemo, useRef, useState } from 'react';
import { toSiteUrl, fallbackIconFor, SETTLEMENT_ASSETS, assetUrl } from './sixsys-assets';
import type { SettlementContext, SettlementResult, SettlementTimelineItem, SixSystemKey } from './sixsys-types';

export interface SettlementStageProps {
  result: 'win' | 'lose' | 'draw';
  mode?: SettlementContext['mode'];
  opponentType?: 'official' | 'mirror';
  opponentId?: number;
  opponentName?: string;
  firstTimeDefeat?: boolean;
  winStreak?: number;
  winnerElement?: SixSystemKey | null;
  seed?: number;
  lastLine?: string;
  /** 结算演出结束后是否展示「再来一次」 */
  showRetry?: boolean;
  onRetry?: () => void;
  onFinished?: () => void;
  className?: string;
}

const WIN_FALLBACK_LINES = [
  '小黑比了个大拇指，比丢已经开心地转圈了。',
  '赢啦！小黑尾巴翘得老高，比丢的果子都忘了吃。',
  '这一场稳了。小黑把战绩记在了小本子的第一页。',
];

const LOSE_FALLBACK_LINES = [
  '小黑拍拍你的头：我们再想个办法。',
  '比丢把好不容易藏起来的果子分了你一个。',
  '输了也没关系，妖灵会馆从不记这一笔。',
  '小黑把爪子搭在你肩上：下把我陪你一起上。',
];

function hash(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** 引擎缺失时的兜底结算（与 ui/settlement.js 的时序/时长保持一致） */
function fallbackResolve(ctx: SettlementContext): SettlementResult {
  const seed = String(ctx.seed ?? 1);
  const win = ctx.result === 'win';
  const line = win
    ? WIN_FALLBACK_LINES[hash(seed + ':common') % WIN_FALLBACK_LINES.length]
    : LOSE_FALLBACK_LINES[hash(seed + ':lose') % LOSE_FALLBACK_LINES.length];
  const timeline: SettlementTimelineItem[] = win
    ? [
        { at_ms: 0, key: 'freeze', desc: '战斗定格 + 六系图标高亮', asset: null },
        { at_ms: 500, key: 'bidiu_enter', desc: '比丢跑入', asset: assetUrl(SETTLEMENT_ASSETS.win.companion) },
        { at_ms: 1500, key: 'luoxiaohei_enter', desc: '罗小黑跃入中央', asset: assetUrl(SETTLEMENT_ASSETS.win.hero) },
        { at_ms: 2000, key: 'feedback', desc: '正向反馈文案', asset: null },
        { at_ms: 2400, key: 'codex_intake', desc: '新收集品入账', asset: null },
      ]
    : [
        { at_ms: 0, key: 'freeze_soft', desc: '画面转柔和', asset: null },
        { at_ms: 400, key: 'comfort_sticker', desc: '小黑安慰表情图', asset: assetUrl(settlementSticker(ctx.seed)) },
        { at_ms: 1200, key: 'comfort_text', desc: '安慰文案 + 再来一次', asset: null },
      ];
  return {
    version: 'fallback',
    result: win ? 'win' : 'lose',
    duration_ms: win ? 3000 : 1800,
    timeline,
    line: { text: line, category: win ? 'common' : 'comfort' },
    feedback: { positive: win, cast: win ? ['罗小黑', '比丢'] : ['罗小黑'], winner_element: ctx.winner_element ?? null },
    assets: {},
    achievement: { show_after_ms: win ? 3000 : null, unlocked: ctx.newly_unlocked || [], play_order: 'cast_first_then_achievement' },
    retry: { enabled: true, label: '再来一次', action: 'retry_battle' },
    penalty: false,
  };
}

function settlementSticker(seed?: number): 'luoxiaohei_face_01' | 'luoxiaohei_face_02' {
  const pool = SETTLEMENT_ASSETS.lose.comfort;
  return pool[hash('sticker:' + String(seed ?? 1)) % pool.length];
}

export function SettlementStage(props: SettlementStageProps) {
  const {
    result,
    mode = 'story',
    opponentType = 'official',
    opponentId,
    opponentName,
    firstTimeDefeat,
    winStreak,
    winnerElement,
    seed = 1,
    lastLine,
    showRetry = true,
    onRetry,
    onFinished,
    className,
  } = props;

  const resolved = useMemo<SettlementResult>(() => {
    const ctx: SettlementContext = {
      result,
      mode,
      opponent_type: opponentType,
      opponent_id: opponentId,
      opponent_name: opponentName,
      first_time_defeat: firstTimeDefeat,
      win_streak: winStreak,
      winner_element: winnerElement ?? null,
      seed,
      newly_unlocked: [],
      last_line: lastLine,
    };
    const api = window.SixSystemSettlement;
    if (api) {
      try {
        return api.resolve(ctx);
      } catch {
        /* 回落 */
      }
    }
    return fallbackResolve(ctx);
  }, [result, mode, opponentType, opponentId, opponentName, firstTimeDefeat, winStreak, winnerElement, seed, lastLine]);

  const [cursor, setCursor] = useState(0);
  const [media, setMedia] = useState('');
  const [showLine, setShowLine] = useState(false);
  const finished = useRef(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    finished.current = false;
    setCursor(0);
    setMedia('');
    setShowLine(false);
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];

    const items = resolved.timeline.slice().sort((a, b) => a.at_ms - b.at_ms);
    items.forEach((item, i) => {
      timers.current.push(
        window.setTimeout(() => {
          setCursor(i + 1);
          const url = toSiteUrl(item.asset);
          if (url) setMedia(url);
          if (/feedback$/.test(item.key) || /comfort_text$/.test(item.key)) setShowLine(true);
        }, item.at_ms),
      );
    });

    timers.current.push(
      window.setTimeout(() => {
        setShowLine(true);
        if (!finished.current) {
          finished.current = true;
          onFinished?.();
        }
      }, resolved.duration_ms),
    );

    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
  }, [resolved, onFinished]);

  const win = resolved.result === 'win';
  const className2 = ['sixsys-settlement', win ? 'sixsys-win' : 'sixsys-lose', className || '']
    .filter(Boolean)
    .join(' ');

  // 素材缺失时用六系图标占位，保证不白屏（不使用任何非官方图像）
  const iconSvg = !media ? fallbackIconFor(winnerElement ?? null) : '';

  return (
    <section className={className2} role="status" aria-live="polite" data-cursor={cursor}>
      <div className="sixsys-stage">
        {media ? (
          <img className="sixsys-media" src={media} alt={win ? '罗小黑与比丢' : '罗小黑'} />
        ) : (
          <span
            className="sixsys-icon-fallback"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: iconSvg || '' }}
          />
        )}
        {winnerElement && win && (
          <span className="sixsys-element-chip">
            {window.SixSystemIcons ? window.SixSystemIcons.label(winnerElement) : winnerElement}
          </span>
        )}
      </div>

      <p className="sixsys-line" hidden={!showLine}>
        {resolved.line.text}
      </p>

      {win && (
        <p className="sixsys-cast" hidden={!showLine}>
          登场：罗小黑 · 比丢
        </p>
      )}

      {!win && (
        <p className="sixsys-comfort-note" hidden={!showLine}>
          失败不扣资源、不掉进度，也不判定成就。歇一歇，再来一次。
        </p>
      )}

      {showRetry && (
        <div className="sixsys-actions" hidden={!showLine}>
          <button type="button" className="sixsys-primary" onClick={onRetry}>
            {resolved.retry.label || '再来一次'}
          </button>
        </div>
      )}
    </section>
  );
}

export default SettlementStage;
