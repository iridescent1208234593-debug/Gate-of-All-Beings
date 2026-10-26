import type { GateIdentity } from '../game/PlayerProfile';

export function resolvePlayerAvatar(profile: Partial<GateIdentity>): string;
export function createPlayerAvatar(host: HTMLElement, options?: { mirror?: boolean }): {
  render(src?: string | null, options?: { reference?: boolean }): void;
};
