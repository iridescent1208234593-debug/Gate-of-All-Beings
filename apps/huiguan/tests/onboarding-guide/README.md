# 新人引导 · browser scenarios

Exercises the guide (`packages/shared-ui/guide.js`, `apps/huiguan/onboarding.js`) through the real
portal and ingress, against disposable `test` storage only. Production hosts are routed to the
local portal inside Playwright (`localnet.cjs`); every other external request is blocked.

```sh
STORE=$(mktemp -d)/storage
# 1. portal on test storage (any free port; localnet.cjs reads PORTAL_PORT, default 18099)
IRIDESCENTLY_STORAGE_ROOT=$STORE IRIDESCENTLY_ENVIRONMENT=test HX_SSO_SECRET=local-test PORT=18099 PYTHONUTF8=1 \
  python -B -c "import sys;sys.path.insert(0,'services/platform');from storage_paths import initialize_storage;initialize_storage();import runpy;runpy.run_path('services/platform/portal_server.py',run_name='__main__')" &
# 2. three fixture accounts (new / pre-guide veteran / merge) → sessions.json
python -B apps/huiguan/tests/onboarding-guide/fixture.py . $STORE > /tmp/guide-sessions.json
# 3. scenarios (Playwright from the repo root node_modules, Chrome channel)
GUIDE_SESSIONS=/tmp/guide-sessions.json node apps/huiguan/tests/onboarding-guide/scenarios.cjs /tmp/guide-evidence
```

Covers: no guide during the opening and no on-load login dialog; pause/resume and Esc; skip and
review from 「更多 · 新手引导」; returning browsers and pre-guide accounts are not walked through;
reduced motion; the contextual 建立身份 notes (form → feedback → account → real login dialog);
account sync across devices; guest progress merged forward on sign-in; the gallery note once,
on a phone, without horizontal overflow.
