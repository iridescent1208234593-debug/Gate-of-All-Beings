# Access Control Matrix

**Basis:** Static source and API documentation review on 2026-10-16. This is a role/route baseline, not a dynamic IDOR certification. “Conditional” means the source path contains an identity, owner, editor, or admin check; endpoint coverage still needs isolated tests using owned accounts.

| Resource / action | Anonymous | Signed-in user | Owner | Editor / scribe | Admin | Evidence / notes |
|---|---|---|---|---|---|---|
| Public site pages, module bundles, public Gallery/character records | Read public portions | Read | Read | Read | Read | `docs/api.md`; `portal/huiguan/server_huiguan.py` public list/detail routes |
| SSO status (`/api/sso-user`) | Gets logged-out status | Own identity/profile summary | Same | Same | Same plus admin flag | Shared SSO cookie verification in `server/hx_sso.py` |
| Register / local login | Register subject to limits; login attempt allowed | N/A | N/A | N/A | N/A | Password hash in `server_huiguan.py`; 6-char minimum; per-IP registration and account+IP login limits |
| Account theme / rename / email / security settings | Denied or 401 | Own account | Own account | Own account | Own account | Identity resolved from session; email/recovery/security handlers in `server/account_email.py`, `server/account_recovery.py`, `server/account_security.py` |
| Change password | Denied | Own local account after current password | Own local account | Own local account | Own local account | Password change deletes local sessions; USSO password is external |
| Email verification / password recovery | May request generic recovery response; token required to reset | Verify only for current identity; reset via verified email token | Own account | Own account | Own account | 30-minute hashed token, one-use deletion, local session invalidation |
| Own profile/character saves and private game saves | Denied | Own namespace | Own namespace | Own namespace | Admin status alone does not imply cross-user ownership unless handler explicitly grants it | `server_huiguan.py` derives `_data_key(ident)` and owner query; game save/load require identity |
| Public poster read | Public posters | Public posters | Own private/public posters | Same | Same | `/api/poster/get` checks `is_public` or matching owner |
| Private poster listing/edit/delete | Denied | Own only | Own | Own | Admin endpoints separately guarded | `_api_posters_my`, poster owner checks; confirm every mutation route in Stage 2 |
| Official character/image read | Public | Public | Public | Public | Public | Public research/archive content |
| Official character/image write | Denied | Some submissions/stickers after sign-in | Own uploads where handler binds owner | `scribe` or `admin` for official image edit | Allowed | `_require_edit()` checks `scribe`/`admin`; sticker upload requires identity |
| Fan submissions/reactions | Read public; submit endpoint may require sign-in | Own submissions/reactions | Own resources | No special privilege | Admin review actions | `docs/api.md`; full per-route guards not dynamically verified |
| Admin users, permissions, moderation, delete | Denied | Denied | Denied | Denied unless explicitly editor-specific | Admin guard | `_require_admin()` checks identity and `is_admin` |
| Member management | Denied | Role-dependent | Own account only unless assigned role | Role-dependent | Admin | Verify exact role transitions and target checks in Stage 2 |
| Softie room WebSocket | Public room interaction | Public room interaction | Own profile persistence | N/A | N/A | Public room is intended; account save goes through Huiguan API |
| Cards OAuth/session API | OAuth start/callback; user status should be non-sensitive when logged out | Own OAuth profile/session | Own identity | N/A | No admin role in Cards JSON contract | Port 5174 path is proxied; wildcard CORS and wildcard bind are findings |
| Juling state/start/action | Source role checks not fully established | Unknown by exact action | N/A | N/A | N/A | Needs focused endpoint/auth review; upstream 5177 |
| Card-balance/admin configuration | Denied by expected auth policy; source route-level coverage not fully established | Unknown | N/A | N/A | Expected admin | Route to port 5178; exact authorization matrix UNKNOWN |
| Spirit settings read/write | Public read may be intended | Admin authorization status UNKNOWN | N/A | N/A | Expected admin | `docs/api.md` says server validation; exact role enforcement needs source-focused Stage 2 review |

## IDOR Review Status

Static review found account-owned keying for personal saves, owner matching on private posters, and explicit editor/admin checks on official image edits. No production ID manipulation was attempted and no other user's records were accessed. The following remain **UNKNOWN / require owned test fixtures**:

- Full role-by-role behavior for every API in `docs/api.md`.
- Cards, card-balance, Juling, Softie settings and module-specific admin actions.
- Whether every update/delete endpoint binds the supplied resource ID to the authenticated owner.
- Session fixation and multi-device invalidation behavior for USSO sessions.
- CORS/CSRF behavior across all public write endpoints.

## Safe Stage 2 Verification Plan

Use two self-owned staging accounts and resources created by each. For each read/update/delete route, try anonymous, account A, account B, owner, editor and admin cases; expect deny responses for cross-owner access. Do not substitute production user IDs or retrieve real private records. Record route, role, resource owner, expected result, actual status and request ID without storing tokens or cookies.
