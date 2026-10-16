import { useEffect, useRef, useState } from 'react';
import GameApp from '../game/GameApp';
import { EntryGate } from './EntryGate';

/** 与 .gate 的淡出过渡保持一致，保证加载页完全透明后再卸载 */
const EXIT_MS = 760;

/**
 * 站点入口：entered 为 false 时只渲染开场加载页，点击「进入众生之门」后才挂载卡牌主游戏。
 * 刷新页面会重新回到加载页（entered 只存在内存中，不落任何存储）。
 */
export default function GameShell() {
  const [entered, setEntered] = useState(false);
  const [gateVisible, setGateVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);

  function enter() {
    if (leaving) return;
    setLeaving(true);
    setEntered(true); // 主游戏在加载页淡出的同时开始挂载
    timer.current = window.setTimeout(() => setGateVisible(false), EXIT_MS);
  }

  // 从主游戏返回开场加载动画：重新挂载加载页让动画从 0 重播一遍，主游戏保持挂载以保留进度
  function returnToGate() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    window.scrollTo({ top: 0 });
    setLeaving(false);
    setGateVisible(true);
  }

  return (
    <>
      {entered && <GameApp onReturnGate={returnToGate} />}
      {gateVisible && <EntryGate leaving={leaving} onEnter={enter} onSkip={enter} />}
    </>
  );
}
