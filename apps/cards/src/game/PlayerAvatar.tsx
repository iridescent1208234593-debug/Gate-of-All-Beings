import { useEffect, useRef } from 'react';
import { createPlayerAvatar, resolvePlayerAvatar } from '../onboarding/player-avatar.js';
import { identityAssetUrl, type GateIdentity } from './PlayerProfile';

export function PlayerAvatar({ identity, className = '' }: { identity: GateIdentity; className?: string }) {
  const host = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const view = createPlayerAvatar(element);
    const src = identity.avatar_mode === 'default' ? resolvePlayerAvatar(identity) : identityAssetUrl(identity.avatar_asset_id);
    view.render(src, { reference: identity.avatar_mode === 'default' });
    return () => element.replaceChildren();
  }, [identity.avatar_mode, identity.avatar_frame_id, identity.avatar_asset_id]);
  return <span ref={host} className={`gate-player-avatar ${className}`} role="img" aria-label={`${identity.display_name || '玩家'}的形象头像`} />;
}
