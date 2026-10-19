import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import '@lxh/shared-ui/site-nav.js';
import { EntryGate } from './EntryGate';
import { AccountLinkReminder } from './AccountLinkReminder';
import { needsAccountAfterOnboarding } from './accountReminder';
import { LoadBoundary } from '../components/LoadBoundary';
import { EMPTY_IDENTITY, PlayerProfileProvider, accountScope, identityComplete, usePlayerProfile, type GateIdentity } from '../game/PlayerProfile';
const GameApp = lazy(() => import('../game/GameApp'));
const PlayerOnboarding = lazy(() => import('../onboarding/PlayerOnboarding').then(module => ({ default: module.PlayerOnboarding })));
const EXIT_MS = 760;
type SiteNav = { mount: () => void; unmount: () => void };
const siteNav = () => (window as Window & { IridescentlyNav?: SiteNav }).IridescentlyNav;
// Coming back from a module (or reloading) within this window goes straight to the hall.
const INTRO_SEEN_KEY = 'zszm.introSeenAt';
const INTRO_SKIP_MS = 6 * 60 * 60 * 1000;
function introRecentlySeen() {
  try { return Date.now() - Number(localStorage.getItem(INTRO_SEEN_KEY) || 0) < INTRO_SKIP_MS; } catch { return false; }
}
function rememberIntro() {
  try { localStorage.setItem(INTRO_SEEN_KEY, String(Date.now())); } catch { /* private mode: replay next time */ }
}

function GateFlow() {
  const [skipIntro] = useState(introRecentlySeen);
  const [entered, setEntered] = useState(skipIntro);
  const [gateVisible, setGateVisible] = useState(!skipIntro);
  const [leaving, setLeaving] = useState(false);
  // An extra identity made through the full opening: gate → onboarding, then back to the hall.
  const [creatingNew, setCreatingNew] = useState(false);
  const [accountReminder, setAccountReminder] = useState(false);
  const timer = useRef<number | null>(null);
  const profile = usePlayerProfile();
  useEffect(() => { if (profile.account.logged_in) setAccountReminder(false); }, [profile.account.logged_in]);
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);
  // Fetch the app while the intro plays, so entering never stops on a loading page.
  useEffect(() => {
    const load = () => { void import('../game/GameApp'); void import('../game/ModeHall'); };
    const idle = (window as Window & { requestIdleCallback?: (callback: () => void) => number }).requestIdleCallback;
    if (idle) idle(load); else window.setTimeout(load, 1200);
  }, []);
  const onboarding = entered && !profile.loading && profile.resolved && (creatingNew || !identityComplete(profile.identity));
  // The shared site bar belongs to the app and its loading state, not to the intro or onboarding screens.
  const showBar = entered && !gateVisible && !onboarding;
  useEffect(() => { if (!showBar) return; siteNav()?.mount(); return () => siteNav()?.unmount(); }, [showBar]);
  function enter() {
    if (leaving) return;
    setLeaving(true);
    setEntered(true);
    rememberIntro();
    timer.current = window.setTimeout(() => setGateVisible(false), EXIT_MS);
  }
  function returnToGate() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    window.scrollTo({ top: 0 });
    setLeaving(false); setGateVisible(true);
  }
  function createWithOpening() {
    setCreatingNew(true);
    returnToGate();
  }
  async function finishIdentity(identity: GateIdentity, image?: Blob | null) {
    await profile.saveIdentity(identity, image);
    // Completing a guest profile alone does not create a Huiguan account.
    setAccountReminder(await needsAccountAfterOnboarding(profile.account.logged_in));
  }
  async function finishNew(identity: GateIdentity, image?: Blob | null) {
    await finishIdentity({ ...identity, id: '' }, image);
    setCreatingNew(false);
  }
  return <>
    {entered && <LoadBoundary page><Suspense fallback={<div className="qc-loading qc-loading--page" role="status">正在打开众生之门…</div>}>
      {profile.loading || (!profile.resolved && profile.error) ? <div className="qc-loading qc-loading--page" role={profile.error ? 'alert' : 'status'}>
        {profile.error || '正在读取玩家资料…'}
        {profile.error && <button type="button" onClick={() => void profile.refresh()}>重新读取</button>}
      </div> : creatingNew ? gateVisible && !leaving ? null : <PlayerOnboarding key={`new:${accountScope(profile.account)}`} initialIdentity={{ ...EMPTY_IDENTITY }}
          onComplete={finishNew} onCancel={() => setCreatingNew(false)} />
      : identityComplete(profile.identity) ? <GameApp onReturnGate={returnToGate} onCreateIdentity={createWithOpening} /> :
        <PlayerOnboarding key={accountScope(profile.account)} initialIdentity={profile.identity}
          onComplete={finishIdentity} onCancel={returnToGate} />}
    </Suspense></LoadBoundary>}
    {accountReminder && !profile.account.logged_in && <AccountLinkReminder onContinue={() => setAccountReminder(false)} />}
    {entered && profile.resolved && profile.error && <div className="gate-profile-status" role="status">{profile.error}<button type="button" onClick={() => void profile.refresh()}>重试</button></div>}
    {gateVisible && <EntryGate leaving={leaving} onEnter={enter} onSkip={enter} />}
  </>;
}
export default function GameShell() {
  return <PlayerProfileProvider><GateFlow /></PlayerProfileProvider>;
}
