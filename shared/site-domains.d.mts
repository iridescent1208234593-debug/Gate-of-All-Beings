/** Types for the generated approved-root map in site-domains.js (see shared/site-domains.json). */
export interface SiteDomainConfig {
  defaultRoot: string;
  roots: string[];
  services: Record<string, string>;
  legacy: Record<string, string>;
  oauth: Record<string, { path: string; callbackRoots: string[] }>;
  previewHosts: string[];
  assetHost: string;
  localPorts: number[];
}

export interface SiteRequestContext {
  host: string;
  origin: string;
  root: string | null;
  local: boolean;
}

export interface SiteDomains {
  config: SiteDomainConfig;
  rootFor(host: string): string | null;
  /** Absolute URL of a service on the same approved root as `host` (default: the current page). */
  url(service: string, path?: string, host?: string): string;
  /** The URL when it is an approved HTTPS target on the caller's own root, otherwise ''. */
  safeReturn(raw: unknown, host?: string): string;
  requestContext(request: unknown): SiteRequestContext | null;
  sameOrigin(request: unknown): boolean;
  allowedHosts: string[];
  service(host: string): string | undefined;
}

declare const domains: SiteDomains;
export default domains;
