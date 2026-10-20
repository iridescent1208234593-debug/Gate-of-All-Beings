export interface Session {
  logged_in: boolean;
  name?: string;
  uid?: unknown;
  kind?: string;
  admin?: boolean;
}
export function loadSsoUser(options?: { fresh?: boolean }): Promise<Session | null>;
export function fetchSession(options?: { fresh?: boolean }): Promise<Session>;
export function getSession(): Session | null;
export function refreshSession(): Promise<Session>;
