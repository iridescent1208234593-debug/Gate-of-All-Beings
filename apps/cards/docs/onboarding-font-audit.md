# Cards onboarding fonts: inventory and rights check (#93)

Scope: tracked master `a6452702d713f6824109bcbcc5643cc578af0004`. This is an inventory, not a license grant or a browser visual comparison. No font bytes or routing changed.

| Font (under `src/onboarding/media`) | Bytes | Family and mapped Unicode codepoints | OS/2 fsType | CSS use |
| --- | ---: | --- | ---: | --- |
| `font.ttf` | 3,533,524 | 贩梦奶酪体 / FMNLTT (7,254) | 0 | `GateOnboardingHand` in the onboarding screen |
| `fonts/zaozi-puyue.ttf` | 4,948,824 | 造字工房朴月体（非商用） (7,226) | 8 | `GateOnboardingId` on the ID badge |
| `fonts/zihun-wennuan.ttf` | 6,497,568 | 字魂7号-温暖童稚体 (6,969) | 8 | `GateOnboardingInput` for login input and placeholder |

Total tracked font payload: 14,979,916 bytes (14.29 MiB), not a measured page transfer. All three declarations use `font-display: swap` and have fallbacks. The gate preload code treats fonts as extras and skips extras larger than 512 KiB for Save-Data and 2G/3G connections. This does not prevent a later browser request when a rendered element uses the font.

The metadata for 贩梦奶酪体 contains only a year and no licensor or license statement. The [造字工房 朴月体 product page](https://www.makefont.com/font-1682.html) describes noncommercial usage; no permission to modify or redistribute an optimized Web derivative was established. The 字魂 asset identifies 上海字魂网络科技有限公司 and the publisher URL but has no embedded license grant. The original onboarding README describes prototype provenance, not derivative rights. The numeric embedding flag is not a substitute for the rights holder’s terms.

Method: inspect each pinned Git blob, record byte size, and call Python FontTools `TTFont(path).getBestCmap()` for mapped codepoints and `TTFont(path)["OS/2"].fsType` for the flag; inspect the family, copyright, manufacturer and license fields in the name table. Compare against `src/onboarding/onboarding.css` and `src/gate/preload.ts`.

Do not subset, transcode, or redistribute replacements derived from these binaries without documented rights. If explicit rights cannot be obtained, evaluate a separately licensed substitute using the actual onboarding screens, including fixed copy, player-entered names, punctuation, numerals and missing-glyph fallback. Capture desktop and mobile screenshots before and after, and record cold-cache font requests and transferred bytes on the same build and network profile. No desktop/mobile renderer comparison or network reduction was verified in this audit.
