import { useEffect, useRef } from 'react';
import type { GateIdentity } from '../game/PlayerProfile';
import screens from './screens.html?raw';
import { createLoginScreen } from './login-screen';
import { createRaceTree } from './race-tree';
import { createRaceList } from './race-list';
import { createSpeciesConfirmation } from './species-confirmation';
import { createAppearanceChoice } from './appearance-choice';
import { createPlayerProfile } from './player-profile';
import { getRace } from './races';
import './onboarding.css';

export interface PlayerOnboardingProps {
  initialIdentity: GateIdentity;
  onComplete: (identity: GateIdentity, avatarBlob?: Blob | null) => Promise<unknown> | void;
  onCancel: () => void;
}

/** Accepted prototype flow after the existing EntryGate; no second intro or global state. */
export function PlayerOnboarding({ initialIdentity, onComplete, onCancel }: PlayerOnboardingProps) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onComplete, onCancel });
  callbacks.current = { onComplete, onCancel };
  const initial = useRef(initialIdentity);

  useEffect(() => {
    const root = host.current!;
    root.innerHTML = screens;
    const profile = createPlayerProfile(initial.current);
    const events = new AbortController();
    const timers = new Set<number>();
    const later = (callback: () => void) => {
      const timer = window.setTimeout(() => { timers.delete(timer); callback(); }, 600);
      timers.add(timer);
    };
    const loginRoot = root.querySelector<HTMLElement>('#login')!;
    const treeRoot = root.querySelector<HTMLElement>('#race-tree')!;
    const listRoot = root.querySelector<HTMLElement>('#race-list')!;
    const appearanceRoot = root.querySelector<HTMLElement>('#appearance-choice')!;
    const sections = [loginRoot, treeRoot, listRoot, appearanceRoot];
    const setAccessibleScreen = (current: HTMLElement) => {
      for (const section of sections) section.inert = section !== current;
    };
    const showLogin = () => {
      login.reset();
      loginRoot.classList.add('is-active');
      loginRoot.setAttribute('aria-hidden', 'false');
      setAccessibleScreen(loginRoot);
      later(() => login.focus());
    };
    const hideLogin = () => {
      loginRoot.classList.remove('is-active');
      loginRoot.setAttribute('aria-hidden', 'true');
    };
    const login = createLoginScreen({ root: loginRoot, onSubmit(name: string) {
      profile.updatePlayerProfile({ display_name: name });
      hideLogin();
      later(() => { tree.show(); setAccessibleScreen(treeRoot); });
    } });
    const tree = createRaceTree({ root: treeRoot, initialSelected: initial.current.avatar_frame_id, onSelect(frameId: string) {
      tree.hide();
      later(() => {
        list.reset(); list.setSelected(frameId); list.setCategory(getRace(frameId)?.category ?? null);
        list.show(); setAccessibleScreen(listRoot);
      });
    }, onBack() { tree.hide(); later(showLogin); } });
    const list = createRaceList({ root: listRoot, initialSelected: initial.current.avatar_frame_id,
      onConfirm(frameId: string) { species.open(frameId); },
      onBack() { list.hide(); later(() => { tree.show(); setAccessibleScreen(treeRoot); }); },
    });
    const species = createSpeciesConfirmation({ root, profile, onConfirm() {
      list.hide();
      later(() => { appearance.show(); setAccessibleScreen(appearanceRoot); });
    } });
    const appearance = createAppearanceChoice({ root: appearanceRoot, profile,
      getAvatarFrame: () => list.selected,
      onChoose: (identity: GateIdentity, blob: Blob | null) => callbacks.current.onComplete(identity, blob),
      onBack() { appearance.hide(); later(() => { list.show(); setAccessibleScreen(listRoot); }); },
    });
    root.querySelector<HTMLButtonElement>('#login-back')!.addEventListener('click', () => callbacks.current.onCancel(), { signal: events.signal });
    const username = root.querySelector<HTMLInputElement>('#username')!;
    username.value = initial.current.display_name || '';

    // Use the accepted 1920×1080 coordinate system without altering the document root.
    const resize = () => {
      const bounds = root.getBoundingClientRect();
      root.style.setProperty('--onboarding-unit', `${Math.min(bounds.width / 1920, bounds.height / 1080)}px`);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(root);
    resize(); showLogin();

    return () => {
      events.abort(); observer.disconnect();
      for (const timer of timers) window.clearTimeout(timer);
      tree.dispose(); list.dispose(); login.dispose(); appearance.dispose(); species.dispose(); profile.dispose();
      root.replaceChildren();
    };
  }, []);

  return <div ref={host} className="gate-onboarding" role="region" aria-label="众生之门玩家初始化" />;
}

export default PlayerOnboarding;
