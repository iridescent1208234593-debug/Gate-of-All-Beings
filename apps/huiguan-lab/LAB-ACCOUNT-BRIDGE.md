# Isolated Westwood Hall account bridge (LAB)

Nothing is enabled by default. Do not configure a live issuer or deploy this
candidate as part of local verification.

- LAB: set account_issuer to one approved Westwood Hall HTTPS origin in the
  isolated lab.config.json. Carry the existing repository registry
  packages/site-domains/domains.json when distributing an enabled gateway.
  The browser accepts only the exact issuer reported by its own gateway. Use a distinct service token in the existing
  restricted LAB_SECRETS directory as account-broker.key (32–200 base64url
  characters); inject corresponding issuer-side configuration independently.
- A test fixture can explicitly set LAB_ACCOUNT_TEST_LOOPBACK=1 and use
  http://127.0.0.1:<port>. No arbitrary hostname, redirect, TLS bypass, or
  transfer of the main-site password or cookie to LAB.
- In the browser, sign in via the account option, type the displayed six matching digits at
  the website, approve, then return to the game. Existing codes still work
  for unlinked holders while this feature is enabled.
- Migration is off unless account-migration.json in LAB_SECRETS expressly
  lists exact legacy c_* internal IDs (not the human-entered codes). Only
  after verifying ownership and confirming the old code is dedicated, never
  a shared/demo or an elevated role, put that ID in the allowlist. The authenticated Web path /account-link
  requires both an active eligible code session and explicit Westwood
  Hall approval. Preserve the exact old participant ID, OC, location and
  ACL; no auto-matching or account merge. Ambiguous/dual existing records
  fail closed.
- After link, only account auth can use that old identity while enabled;
  already-issued standalone old sessions are invalidated. Feature disabling
  allows a fresh legacy login again by policy without deleting the original
  code, credentials or world/identity link. A revoked legacy code is never
  reopened by the account path.
- LAB holds opaque grants only in process memory. At restart website login
  is required anew; unlinking/account migration is not repeated. Session
  leases are 45 seconds, refreshed through issuer introspection every ~15
  seconds; issuer failure does not extend them; no immediate cross-host
  revocation or uptime guarantee is implied. Subsequent local sockets are
  closed through the same session resolver.
- This repository baseline supports browser account login. Desktop and mobile
  clients keep their pre-existing behavior; native account UI, export presets
  and package delivery are a separate change. For existing browser players,
  open the authenticated path /account-link after logging in with the legacy code.
- Verification: server/tests/test_account_broker.py uses temporary SQLite and
  fake issuer responses; production not exercised. Site credentials are never
  typed in the game.
