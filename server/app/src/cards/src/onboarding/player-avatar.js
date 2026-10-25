import siteDomains from '../../../../../../shared/site-domains.mjs';
/** One SVG window/overlay geometry for the setup preview and world HUD. */
import frameArt from './media/appearance-choices/custom-frame.svg?raw';
import mirrorArt from './media/appearance-choices/mirror-frame.svg?raw';
const AVATARS = import.meta.glob('./media/race-avatars/*.png', { eager: true, import: 'default', query: '?url' });
let viewId = 0;
export function resolvePlayerAvatar(profile) {
  return profile.avatar_mode === 'default'
    ? AVATARS[`./media/race-avatars/${profile.avatar_frame_id}.png`] || ''
    : profile.avatar_asset_id?.startsWith('/assets/uploads/') ? `${siteDomains.url('huiguan')}${profile.avatar_asset_id}` : profile.avatar_asset_id || '';
}
export function createPlayerAvatar(host, { mirror = false } = {}) {
  const suffix = `-view-${++viewId}`;
  host.innerHTML = (mirror ? mirrorArt : frameArt)
    .replace(/id="([^"]+)"/g, (_, id) => `id="${id}${suffix}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${id}${suffix})`);
  const svg = host.querySelector('svg');
  const placeholder = svg.querySelector('.frame-placeholder');
  const referenceClip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
  referenceClip.id = `avatar-reference${suffix}`;
  const cornerMask = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  for (const [name, value] of Object.entries({ x: 21, y: 28, width: 188, height: 188, rx: 24 })) {
    cornerMask.setAttribute(name, String(value));
  }
  referenceClip.append(cornerMask);
  svg.querySelector('defs').append(referenceClip);
  const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
  // SVG's actual opening is x=21, y=26, width=188, height=192 (viewBox 230×232).
  // Keep a centered 188×188 image inside that opening, under its decorations.
  for (const [name, value] of Object.entries({ x: 21, y: 28, width: 188, height: 188,
    preserveAspectRatio: 'xMidYMid meet', 'clip-path': `url(#${mirror ? 'mirror' : 'custom'}-frame-window${suffix})` })) {
    image.setAttribute(name, String(value));
  }
  image.classList.add('player-avatar-image');
  placeholder.after(image);
  return {
    render(src, { reference = false } = {}) {
      // Video-derived avatar tiles have an opaque black matte outside their rounded corners.
      // Mask only that matte, rather than cropping/scaling the character to hide it.
      image.setAttribute('clip-path', `url(#${reference ? 'avatar-reference' : `${mirror ? 'mirror' : 'custom'}-frame-window`}${suffix})`);
      if (src) image.setAttribute('href', src);
      else image.removeAttribute('href');
      image.style.display = src ? '' : 'none';
      placeholder.style.visibility = src ? 'hidden' : '';
    },
  };
}
