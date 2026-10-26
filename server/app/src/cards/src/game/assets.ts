import siteDomains from '../../../../../../packages/site-domains/index.mjs';
// Original portraits stay in the shared asset library; no bitmap copies in this game.
export const ASSET_BASE=siteDomains.url('huiguan', '');
export const portrait=(name:string)=>`${ASSET_BASE}/api/assets/avatar?name=${encodeURIComponent(name)}&t=1`;
