import type { GateIdentity } from '../PlayerProfile';
type ShoreScene = { show: () => void; syncPlayer: () => void; explore: (id?: string) => boolean; getState: () => { active: boolean; discovered: string[]; energy: number; journalOpen: boolean }; dispose: () => void };
export function createWorldScreen(options: { world: HTMLElement; getProfile: () => GateIdentity; storageKey: string; onReturn: () => void }): ShoreScene;
