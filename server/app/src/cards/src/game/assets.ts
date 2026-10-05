// Original portraits stay in the shared asset library; no bitmap copies in this game.
export const ASSET_BASE='https://huiguan.iridescently.xyz';
export const portrait=(name:string)=>`${ASSET_BASE}/api/assets/avatar?name=${encodeURIComponent(name)}&t=1`;
