# LAB native account pilot

This is the formal-branch native account sign-in and migration only, with no
local terrain/minigame/animation prototype or server-runtime changes.

- Use the current official LAB at https://pc-lab.iridescently.cn; the Web
  client stays same-origin. Desktop CLI connection overrides are preserved.
- Account approval opens the system browser at an approved Westwood Hall
  origin; type the displayed six matching digits at the site, not your
  website password in the game. Account sign-in remains unavailable until
  the isolated/authorized gateway enables its issuer.
- Windows: Godot 4.7.2 import, then use Windows Desktop x86_64 with an
  embedded PCK. The debug template is used for the loopback pilot.
- Android Preview uses cn.iridescently.huiguan.lab.preview, versionCode 9,
  arm64-v8a/x86_64. Use the existing preview signer to upgrade earlier
  preview installs. Expected preview signer SHA-256:
  45135dae5f99130cbd39d4d49815797c2d02217516e7bf24ed7dd729f9d05b97.
  Signing inputs are operator-local. The separate distribution app
  cn.iridescently.huiguan.lab cannot be upgraded without its exact authorized
  signing key. Never sign a distribution update with the preview key.
- For temporary loopback QA only, use explicit debug client endpoint
  overrides and the gateway fixture LAB_ACCOUNT_TEST_LOOPBACK.
