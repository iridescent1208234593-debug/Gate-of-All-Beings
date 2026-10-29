import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import '@lxh/shared-ui/site-nav.js';
import { EntryGate } from './EntryGate';
import { OpeningMusicProvider, useOpeningMusic } from './OpeningMusic';
import { DoorScene } from './DoorScene';
import { AccountLinkReminder } from './AccountLinkReminder';
import { OrientationGuard, useOrientationGuard } from './OrientationGuard';
import { needsAccountAfterOnboarding } from './accountReminder';
import { startPreload } from './preload';
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
// Per tab: phones often discard the page while the photo picker is open; that reload must not replay the intro.
const TAB_ENTERED_KEY = 'zszm.enteredThisTab';
type OpeningPhase = 'intro' | 'intro-exit' | 'routing' | 'onboarding' | 'door' | 'destination';
function introRecentlySeen() {
  try { if (sessionStorage.getItem(TAB_ENTERED_KEY)) return true; } catch { /* fall back to the time window */ }
  try { return Date.now() - Number(localStorage.getItem(INTRO_SEEN_KEY) || 0) < INTRO_SKIP_MS; } catch { return false; }
}
function rememberIntro() {
  try { sessionStorage.setItem(TAB_ENTERED_KEY, '1'); } catch { /* private mode: this page only */ }
  try { localStorage.setItem(INTRO_SEEN_KEY, String(Date.now())); } catch { /* private mode: replay next time */ }
}

function GateFlow() {
  const music = useOpeningMusic();
  const [skipIntro] = useState(introRecentlySeen);
  const [entered, setEntered] = useState(skipIntro);
  const [phase, setPhase] = useState<OpeningPhase>(skipIntro ? 'destination' : 'intro');
  const [doorRevealed, setDoorRevealed] = useState(false);
  const [appReady, setAppReady] = useState(false);
  const [appCurtain, setAppCurtain] = useState(false);
  const [awaitingApp, setAwaitingApp] = useState(false);
  // A new identity made through the opening: gate → onboarding → door → hall.
  const [creatingNew, setCreatingNew] = useState(false);
  const [accountReminder, setAccountReminder] = useState(false);
  const timer = useRef<number | null>(null);
  const profile = usePlayerProfile();
  useEffect(() => { if (skipIntro) music.setInside(true); }, [music.setInside, skipIntro]);
  useEffect(() => { if (profile.account.logged_in) setAccountReminder(false); }, [profile.account.logged_in]);
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);
  // Fetch the app while the intro plays, so entering never stops on a loading page.
  useEffect(() => {
    startPreload();
    const load = () => { void import('../game/GameApp'); void import('../game/ModeHall'); };
    const idle = (window as Window & { requestIdleCallback?: (callback: () => void) => number }).requestIdleCallback;
    if (idle) idle(load); else window.setTimeout(load, 1200);
  }, []);
  const onboarding = entered && !profile.loading && profile.resolved && (creatingNew || !identityComplete(profile.identity));
  // The shared site bar belongs to the app and its loading state, not to the intro or onboarding screens.
  const gateVisible = phase === 'intro' || phase === 'intro-exit';
  const doorVisible = phase === 'door';
  const leaving = phase === 'intro-exit';
  const appActive = entered && phase === 'destination';
  const destinationVisible = entered && (phase === 'intro-exit' || phase === 'routing' || phase === 'onboarding' || appActive || (doorVisible && doorRevealed));
  const showBar = appActive && !onboarding;
  useEffect(() => {
    const ready = showBar && profile.resolved && !profile.loading && profile.account.logged_in;
    document.documentElement.dataset.gateInstallReady = String(ready);
    window.dispatchEvent(new Event('gate:install-ready'));
    return () => {
      document.documentElement.dataset.gateInstallReady = 'false';
      window.dispatchEvent(new Event('gate:install-ready'));
    };
  }, [showBar, profile.resolved, profile.loading, profile.account.logged_in]);
  // Phones: landscape is forced only while the intro, door or onboarding is on screen; elsewhere
  // (including the profile loading after a reload) the player's portrait choice stands.
  const inGame = appActive && !creatingNew && profile.resolved && identityComplete(profile.identity);
  const orientation = useOrientationGuard(gateVisible || doorVisible || onboarding ? 'opening' : 'game');
  // Playing keeps the intro window fresh, so a later reload in this tab or soon after lands in the hall.
  useEffect(() => { if (inGame) rememberIntro(); }, [inGame]);
  useEffect(() => { if (!showBar) return; siteNav()?.mount(); return () => siteNav()?.unmount(); }, [showBar]);
  // Resolve identity before choosing whether the player needs onboarding or can pass through the door.
  useEffect(() => {
    if (phase !== 'routing' || profile.loading || !profile.resolved) return;
    setPhase(creatingNew || !identityComplete(profile.identity) ? 'onboarding' : 'door');
  }, [phase, profile.loading, profile.resolved, profile.identity, creatingNew]);
  function enter() {
    if (phase !== 'intro') return;
    setPhase('intro-exit');
    setEntered(true);
    rememberIntro();
    timer.current = window.setTimeout(() => setPhase('routing'), EXIT_MS);
  }
  const revealAppWhenReady = useCallback(() => {
    setAppReady(true);
    setAwaitingApp(false);
    window.setTimeout(() => setAppCurtain(false), 450);
  }, []);
  const beginAppTransition = useCallback(() => {
    setAppReady(false);
    setAwaitingApp(true);
    setAppCurtain(true);
  }, []);
  function returnToGate() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    window.scrollTo({ top: 0 });
    music.setInside(false);
    setPhase('intro'); setDoorRevealed(false);
  }
  function createWithOpening() {
    setCreatingNew(true);
    returnToGate();
  }
  async function finishIdentity(identity: GateIdentity, image?: Blob | null) {
    await profile.saveIdentity(identity, image);
    // Completing a guest profile alone does not create a Huiguan account.
    setAccountReminder(await needsAccountAfterOnboarding(profile.account.logged_in));
    setPhase('door');
  }
  async function finishNew(identity: GateIdentity, image?: Blob | null) {
    await finishIdentity({ ...identity, id: '' }, image);
    setCreatingNew(false);
  }
  return <>
    {entered && <div className={`gate-destination${appActive ? ' is-active' : ''}`} aria-hidden={!destinationVisible} inert={!destinationVisible}>
      <LoadBoundary page><Suspense fallback={<div className="gate-transition-black" aria-hidden="true" />}>
      {profile.loading || (!profile.resolved && profile.error) ? <div className="qc-loading qc-loading--page" role={profile.error ? 'alert' : 'status'}>
        {profile.error || '正在读取玩家资料…'}
        {profile.error && <button type="button" onClick={() => void profile.refresh()}>重新读取</button>}
      </div> : creatingNew ? phase !== 'onboarding' ? null : <PlayerOnboarding key={`new:${accountScope(profile.account)}`} initialIdentity={{ ...EMPTY_IDENTITY }}
          onComplete={finishNew} onCancel={() => { setCreatingNew(false); returnToGate(); }} />
      : identityComplete(profile.identity) && appActive ? <GameApp onReturnGate={returnToGate} onCreateIdentity={createWithOpening} onReady={revealAppWhenReady} /> :
        (phase === 'onboarding' || phase === 'destination') ? <PlayerOnboarding key={accountScope(profile.account)} initialIdentity={profile.identity}
          onComplete={finishIdentity} onCancel={returnToGate} /> : null}
      </Suspense></LoadBoundary>
      {accountReminder && !profile.account.logged_in && <AccountLinkReminder onContinue={() => setAccountReminder(false)} />}
      {entered && profile.resolved && profile.error && <div className="gate-profile-status" role="status">{profile.error}<button type="button" onClick={() => void profile.refresh()}>重试</button></div>}
    </div>}
    {gateVisible && <EntryGate leaving={leaving} paused={orientation.blocked} onEnter={enter} onSkip={enter} />}
    {doorVisible && <DoorScene onFlashStart={() => music.setInside(true)} onReveal={() => { setDoorRevealed(true); beginAppTransition(); }} onFinish={() => { beginAppTransition(); setPhase('destination'); setDoorRevealed(false); }} />}
    {(appCurtain || (awaitingApp && !appReady)) && <div className={`gate-app-curtain${appReady ? ' is-opening' : ''}`} aria-hidden="true" />}
    <OrientationGuard {...orientation} />
  </>;
}
export default function GameShell() {
  return <PlayerProfileProvider><OpeningMusicProvider><GateFlow /></OpeningMusicProvider></PlayerProfileProvider>;
}
