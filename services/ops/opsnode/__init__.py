"""Read-only three-node operations: node agents (A Hong Kong, B ops server, C Windows) and the hub on B.

Phase 1 is read-only by construction: agents expose GET endpoints only, never run commands that change
state, and never return secrets. Control operations (restart, publish, rollback, restore) are a later,
separately authorised phase and are deliberately absent here.

Standard library only, so the agent runs on Hong Kong's system Python without installing packages.
psutil is used when present (the LAB venv has it) and replaced by /proc or Win32 calls otherwise.
"""

VERSION = "ops-0.1.0"
