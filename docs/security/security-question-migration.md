# Security Question Recovery Migration

## Current evidence

Read-only count from the local `portal/huiguan/users.db` snapshot on 2026-10-16:

| Measure | Count |
| --- | ---: |
| Local accounts | 207 |
| Accounts with a configured security question | 1 |
| Accounts with a verified email | 1 |
| Accounts with both | 0 |

No question answers were read, displayed, or copied. This is a local database snapshot, not proof of current production account totals.

## Migration approach

1. Keep the existing security-question recovery route available for legacy accounts in this stage. Do not delete or rewrite existing recovery data.
2. Prefer verified-email recovery for accounts that have a verified email. Continue using generic responses so the endpoint does not reveal whether an account exists.
3. During a later user-facing migration, prompt legacy accounts without a verified email to add and verify one. Do not silently treat an unverified address as recovery proof.
4. Once an account has a verified email, require the verified-email flow for password reset instead of accepting a security question as the sole credential. Preserve the legacy route only for accounts that have no verified email until they migrate.
5. Measure adoption without recording or logging question answers. Announce any eventual retirement period before removing the final legacy path.

## Stage 1 decision

No recovery route is removed in this stage. The local snapshot shows one question-only account and no overlap with verified-email accounts, so disabling question recovery now would remove that account's configured recovery option. Re-evaluate using a current production-safe aggregate after verified-email migration is available.
