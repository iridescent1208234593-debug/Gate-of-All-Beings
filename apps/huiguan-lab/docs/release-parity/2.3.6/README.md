# LAB 2.3.6 runtime parity

The public 2.3.6 build (build 7) was cut from the newer LAB runtime, not the legacy LAB source currently tracked on master. Do not ship a public build from master until the baseline is reconciled. No live configuration, save data, credentials or binaries are needed for source reconciliation.

This PR backports the compatible snapshot protocol and interpolation to the tracked client and gateway. The optional timestamp leaves the old position row and local-player authority unchanged; the client still accepts older packets without a timestamp.

The two source patches in this directory are **release-parity inputs, not patches to apply blindly to master**:

- bridge-fix.patch: authoritative east bridge geometry, preserving old clients and keeping water impassable. It needs the newer hall geometry and matching client take for 2D, 3D and the east_bank hello capability. The legacy hall currently has different coordinates.
- native-feedback-and-snapshot.patch: immediate action or skill confirmation, distinct effect download feedback, and native snapshot interpolation. It needs the newer action and skill client, including skills.gd and its server contract. Master does not currently have those skill modules.

Reconcile the newer baseline separately. Reapply the related behavior only where absent, verify the exact geometry of the package and gateway, then test bridge crossing both ways, old-client reconnect, off-bridge water, two-player snapshot fallback, action/skill acceptance, rejection, timeout and effect loading before a public build. Do not wholesale overwrite master with the runtime folder.

Run the tests added by this PR:

- Gateway: pytest on server/tests/test_snapshot_stamp.py.
- Client: Godot headless with the client project path and --script res://tests/player_snapshot_smoke.gd.
