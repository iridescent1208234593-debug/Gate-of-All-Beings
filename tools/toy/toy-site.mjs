// Which project hosts the Toy may link to, derived from content.json and the one domain map.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const APP = path.join(ROOT, 'apps/bilibili-toy');
const DOMAINS = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/site-domains/domains.json'), 'utf8'));

// Paths on an approved host that a Toy must never point at, even as a link.
export const FORBIDDEN_PATH = /^\/(?:api|admin|uploads|assets\/uploads|cb|login|logout|oauth)(?:\/|$|\?)|\.(?:json|db|env)(?:$|\?)/i;

export function readContent() {
  return JSON.parse(fs.readFileSync(path.join(APP, 'content.json'), 'utf8'));
}

export function serviceHost(root, service) {
  if (!DOMAINS.roots.includes(root)) throw new Error(`site.root ${root} is not an approved root in domains.json`);
  if (!(service in DOMAINS.services)) throw new Error(`unknown service ${service}`);
  const sub = DOMAINS.services[service];
  return sub ? `${sub}.${root}` : root;
}

// The exact hosts this Toy may name: the listed services on the one root the platform approved.
export function approvedHosts(content) {
  const site = content.site;
  if (!site || !site.root) return [];
  return (site.services || []).map((service) => serviceHost(site.root, service));
}

// The one data endpoint the Toy may read; everything else under /api stays off limits.
export const DATA_ENDPOINTS = new Set(['/api/toy/archive']);

export function siteUrl(content, service, pathAndQuery, { dataEndpoint = false } = {}) {
  if (!(content.site?.services || []).includes(service)) throw new Error(`service ${service} is not listed in site.services`);
  const allowedData = dataEndpoint && DATA_ENDPOINTS.has(pathAndQuery);
  if (!pathAndQuery.startsWith('/') || (!allowedData && FORBIDDEN_PATH.test(pathAndQuery))) throw new Error(`path ${pathAndQuery} may not be linked from the Toy`);
  return `https://${serviceHost(content.site.root, service)}${pathAndQuery}`;
}

// True when an absolute URL is one the Toy may carry: https, an approved host, a public page path.
export function isApprovedUrl(value, hosts) {
  let url;
  try { url = new URL(value); } catch { return false; }
  return url.protocol === 'https:' && !url.username && !url.password && !url.port
    && hosts.includes(url.hostname) && !FORBIDDEN_PATH.test(url.pathname);
}

export function projectRoots() {
  return DOMAINS.roots;
}
