/**
 * 手牌的三种出牌方式：点击（打向当前选中的敌人）、鼠标拖拽、触屏拖拽。
 * 拖拽用 Pointer Events 一套实现；交互只取决于当前 RunState，不依赖任何发牌动画或回合内的重新绑定。
 */
import { useRef, useState } from 'react';
import { CardTile } from '../game/CardTile';
import type { CardInstance } from '../game/core/types';

export type DropTarget = { kind: 'enemy'; id: string } | { kind: 'stage' };

/** 松手位置下的出牌目标：敌人（data-drop-enemy）或战场（data-drop-stage）。 */
export function dropTargetAt(x: number, y: number): DropTarget | null {
  const el = document.elementFromPoint(x, y);
  const enemy = el?.closest<HTMLElement>('[data-drop-enemy]');
  if (enemy?.dataset.dropEnemy) return { kind: 'enemy', id: enemy.dataset.dropEnemy };
  return el?.closest('[data-drop-stage]') ? { kind: 'stage' } : null;
}

const DRAG_START = 10;

export function HandCard({ card, disabled, onClick, onDrop, onHover }: {
  card: CardInstance; disabled: boolean;
  onClick: () => void; onDrop: (target: DropTarget | null) => void; onHover: (target: DropTarget | null) => void;
}) {
  // 手牌区横向滚动会裁掉越界内容，拖动中的牌改为固定定位，并留一个占位保持手牌排布。
  const [drag, setDrag] = useState<{ left: number; top: number; width: number; tilt: number } | null>(null);
  const suppressClick = useRef(false);

  function pointerDown(e: React.PointerEvent) {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const id = e.pointerId, sx = e.clientX, sy = e.clientY, rect = e.currentTarget.getBoundingClientRect();
    let dragging = false;
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      const x = ev.clientX - sx, y = ev.clientY - sy;
      if (!dragging && Math.hypot(x, y) < DRAG_START) return;
      dragging = true;
      ev.preventDefault();
      setDrag({ left: rect.left + x, top: rect.top + y, width: rect.width, tilt: Math.max(-8, Math.min(8, x / 24)) });
      onHover(dropTargetAt(ev.clientX, ev.clientY));
    };
    const finish = (ev: PointerEvent, drop: boolean) => {
      if (ev.pointerId !== id) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      if (!dragging) return;
      // 拖拽结束后浏览器还会补发一次 click，忽略它，避免同一张牌被打出两次。
      suppressClick.current = true;
      setTimeout(() => { suppressClick.current = false; }, 0);
      setDrag(null);
      onHover(null);
      if (drop) onDrop(dropTargetAt(ev.clientX, ev.clientY));
    };
    const up = (ev: PointerEvent) => finish(ev, true);
    const cancel = (ev: PointerEvent) => finish(ev, false);
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  }

  return <>
    {drag && <div className="hand-card-placeholder" style={{ width: drag.width }} aria-hidden="true" />}
    <div className={`hand-card ${drag ? 'is-dragging' : ''}`} onPointerDown={pointerDown}
      onClickCapture={e => { if (suppressClick.current) { e.stopPropagation(); e.preventDefault(); } }}
      style={drag ? { position: 'fixed', left: drag.left, top: drag.top, width: drag.width, transform: `rotate(${drag.tilt}deg)` } : undefined}>
      <CardTile card={card} disabled={disabled} onClick={onClick} />
    </div>
  </>;
}
