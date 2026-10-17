# Incident Response Quick Guide

**Scope:** Iridescently website, account services, Cloudflare Tunnel, local Windows origin, runtime databases and uploaded media. This is an initial operator guide based on the documented architecture; fill unknown contacts and recovery locations before relying on it during an incident.

## First 15 Minutes

1. Record the time (Asia/Singapore), affected hostnames/routes, observed symptom, request IDs and screenshots/headers. Do not copy passwords, cookies, JWTs or reset links into the incident log.
2. Determine whether the symptom is edge/DNS, Tunnel, dispatcher, one API upstream, database/storage or browser-only. Use the existing Website Manager health view and low-frequency public checks.
3. Preserve relevant service logs and configuration snapshots. Record file hashes and timestamps before changing anything. Do not delete logs or user data.
4. If active account abuse is plausible, identify affected account IDs from trusted server logs; do not inspect unrelated users' private content.

## Containment

- **Credential/session compromise:** disable or rotate the affected credential through its authoritative provider; invalidate affected application sessions; for `HX_SSO_SECRET`, plan coordinated rotation across all relying services because it invalidates shared SSO tokens. Never paste secret values into chat or logs.
- **Exposed origin port:** restrict the exact host firewall rule or listener after confirming the public path and impact; keep the Cloudflare Tunnel ingress path available if safe. Preserve before/after rule evidence.
- **Unauthorized write/upload:** stop further writes to the affected route if required; preserve database and uploaded-file copies; identify owner and timestamps; do not delete evidence before backup.
- **Malicious/unsafe release:** use the existing release workflow to restore a known-good snapshot only after verifying release identity, database compatibility and user-data preservation.
- Avoid broad shutdowns, production database edits, DNS changes or secret rotation across unrelated systems without an incident-specific scope and rollback record.

## Recovery

1. Confirm root cause and affected assets; document confirmed facts separately from hypotheses.
2. Restore from a known-good source/config/data backup. Verify database and media integrity before reopening write paths.
3. Recheck HTTPS redirect, cookie flags, public page/API health, SSO, account-owned reads/writes, and WebSocket behavior with owned test accounts.
4. Monitor auth failures, 401/403 rates, admin changes, upload volume, tunnel health and error rates.
5. Record recovery time, data-loss window, secrets rotated, sessions revoked, user notification decision and follow-up owners.

## Evidence and Communications

- Preserve source/config revisions, Cloudflare event records, Website Manager and application logs, relevant Windows Firewall rules, DNS responses and timestamps.
- Restrict evidence access to incident responders; redact email addresses, IPs, tokens and private user content in shared notes.
- If user data may have been exposed, assess the affected data and applicable notification obligations with appropriate counsel/authorities. Do not speculate publicly.

## Unknowns to Complete

- Incident owner and backup contact.
- Cloudflare account recovery and emergency access path.
- Location and restore credentials for database/media backups; last successful restore drill.
- Log retention, access controls and export location.
- Exact firewall/NAT rule owner and emergency rollback method.
- External identity provider escalation path (`sso.umrc.cn`).
- Legal/privacy notification decision owner.
