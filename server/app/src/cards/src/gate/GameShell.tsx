import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { EntryGate } from './EntryGate';
import { PlayerProfileProvider, accountScope, identityComplete, usePlayerProfile } from '../game/PlayerProfile';
const GameApp = lazy(() => import('../game/GameApp'));
const PlayerOnboarding = lazy(() => import('../onboarding/PlayerOnboarding').then(module => ({ default: module.PlayerOnboarding })));
const EXIT_MS = 760;

function GateFlow() {
  const [entered, setEntered] = useState(false);
  const [gateVisible, setGateVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<number | null>(null);
  const profile = usePlayerProfile();
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);
  function enter() {
    if (leaving) return;
    setLeaving(true);
    setEntered(true);
    timer.current = window.setTimeout(() => setGateVisible(false), EXIT_MS);
  }
  function returnToGate() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    window.scrollTo({ top: 0 });
    setLeaving(false); setGateVisible(true);
  }
  return <>
    {entered && <Suspense fallback={<div className="gate-profile-loading" role="status">正在展开众生之门…</div>}>
      {profile.loading || (!profile.resolved && profile.error) ? <div className="gate-profile-loading" role="status">
        <h1>众生之门</h1><p>{profile.error || '正在读取你的玩家资料…'}</p>
        {profile.error && <button type="button" onClick={() => void profile.refresh()}>重新读取</button>}
      </div> : identityComplete(profile.identity) ? <GameApp onReturnGate={returnToGate} /> :
        <PlayerOnboarding key={accountScope(profile.account)} initialIdentity={profile.identity}
          onComplete={profile.saveIdentity} onCancel={returnToGate} />}
    </Suspense>}
    {entered && profile.resolved && profile.error && <div className="gate-profile-status" role="status">{profile.error}<button type="button" onClick={() => void profile.refresh()}>重试</button></div>}
    {gateVisible && <EntryGate leaving={leaving} onEnter={enter} onSkip={enter} />}
  </>;
}
export default function GameShell() {
  return <PlayerProfileProvider><GateFlow /></PlayerProfileProvider>;
}
