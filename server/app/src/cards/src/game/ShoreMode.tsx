import { useEffect, useRef } from 'react';
import { accountScope, identityAssetUrl, usePlayerProfile } from './PlayerProfile';
import { createWorldScreen } from './shore/world-screen.js';
import background from './shore/shore-background.png';
import './shore/shore.css';

export function ShoreMode({ onReturn }: { onReturn: () => void }) {
  const { identity, account } = usePlayerProfile();
  const host = useRef<HTMLElement>(null);
  const scene = useRef<ReturnType<typeof createWorldScreen> | null>(null);
  const latest = useRef({ identity, onReturn }); latest.current = { identity, onReturn };
  const scope = accountScope(account);
  useEffect(() => {
    if (!host.current) return;
    const instance = createWorldScreen({ world: host.current, getProfile: () => ({ ...latest.current.identity, avatar_asset_id: identityAssetUrl(latest.current.identity.avatar_asset_id) }), storageKey: `zszm.shore.v1:${scope}`, onReturn: () => latest.current.onReturn() });
    scene.current = instance; instance.show();
    return () => { instance.dispose(); scene.current = null; };
  }, [scope]);
  useEffect(() => { scene.current?.syncPlayer(); }, [identity]);
  return <section ref={host} className="shore-mode" aria-label="雾隐浅滩探索" style={{ backgroundImage: `url("${background}")` }} />;
}

export default ShoreMode;
