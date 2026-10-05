export interface Session {
  logged_in: boolean;
  name?: string;
  uid?: unknown;
  kind?: string;
  admin?: boolean;
}
export function fetchSession(): Promise<Session>;
export function getSession(): Session | null;
export function refreshSession(): Promise<Session>;
