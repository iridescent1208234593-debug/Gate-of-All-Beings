# Cards gate startup measurement (#92)

Scope: exact tracked tree at `a6452702d713f6824109bcbcc5643cc578af0004`. These are source asset measurements, not a production network trace, a before/after result, or a claim that every source byte ships or transfers at startup.

| Source group | Tracked files | Uncompressed tracked bytes |
| --- | ---: | ---: |
| `src/gate/door-assets` | 9 | 2,328,611 |
| `src/gate/audio` | 2 | 1,738,458 |
| `src/onboarding/media` | 56 | 15,379,637 |
| Fonts alone, within onboarding media | 3 | 14,979,916 |

Reproduce the first three rows from the monorepo root without reading user/runtime files:

```sh
for group in src/gate/door-assets src/gate/audio src/onboarding/media; do
  git ls-tree -rl a6452702d713f6824109bcbcc5643cc578af0004 -- "apps/cards/$group" |
    awk -v group="$group" '$2 == "blob" { n++; bytes += $4 } END {print group, n, bytes}'
done
```

Source behavior: the manifest builder traverses imports of critical entries (gate and initial game/hall/onboarding paths), classifies gate audio and door assets as critical, and excludes fonts from critical. On Save-Data/2G/3G, `src/gate/preload.ts` removes extras larger than 512 KiB from the service worker message. This does not prevent demand fetches later. Neither the emitted asset manifest nor browser transfer sizes are equivalent to the source totals above.

## Pinned build and browser baseline (not an optimisation)

Exact authenticated checkout `a6452702d713f6824109bcbcc5643cc578af0004` built successfully on Windows with Node 24.18.0/Vite 6.4.5, four committed lockfiles installed using `npm ci`, and disposable test storage. No publish step was run.

| Asset manifest | Critical | Extra |
| --- | ---: | ---: |
| Standalone `7413bb38f21ccbc0` | 83 / 5,970,788 B | 12 / 17,214,758 B |
| Module-base `faef650f8f46dbc2` | 83 / 5,972,138 B | 12 / 17,214,776 B |

Standalone critical items include the two MP3s (1,738,458 B), far.png (918,755 B), and gateEmbed (585,006 B). The three extra fonts total 14,979,916 B; shore background is 1,549,694 B. These are emitted bytes, not transfers. Retained release artifacts were compared only to identify unrelated module build drift; the baseline build must not replace the live module wholesale.

Real headless Edge on Windows used loopback HTTP and a synthetic guest, not production. Three new-profile runs and their three cached repeats measured:

| Signal, from navigation start | Cold median (range) | Warm median (range) |
| --- | ---: | ---: |
| Gate usable and service worker ready | 327 ms (317–502) | 215 ms (202–220) |
| Skip → name input visible | 1,754 ms (1,725–1,932) | 1,594 ms (1,582–1,595) |
| Page Resource Timing transfer at name input | 999,572 B (999,572–1,353,169) | 5,818 B (three repeats) |

Page timing excludes worker background fetches; loopback is not WAN or device profiling. The fixture did not serve `/assets/site-language.js`; no uncaught page errors were observed. The baseline did not verify 6-hour return, mobile or visual parity and makes no claim of measured speedup. Do not change animation or preload timing on this evidence alone.

## Next measured comparison

Use a complete authenticated checkout, pinned separately for baseline and candidate, a supported Node.js version, and nonproduction local storage only. Install the committed dependencies in all three apps before the Cards production **build** (do not publish):

```sh
npm ci --prefix apps/ecology
npm ci --prefix apps/management
npm ci --prefix apps/cards
npm run build --prefix apps/cards
node -e 'const m=require("./apps/cards/dist/preload-manifest.json"); for(const k of ["critical","extra"]){const a=m[k]; console.log(m.version,k,a.length,a.reduce((s,x)=>s+x.size,0))}'
```

Serve each build locally with the repository's test configuration so the root service worker can control the local page. Capture browser network/Performance traces and HAR against local-only fixtures. Use identical browser/version, desktop or mobile viewport, and profiles for each comparison. Run at least three cold runs (new profile, no worker/cache), three warm runs (worker active) and repeat under a throttled connection with observed effectiveType/Save-Data recorded. Do not disable all browser caching for the warm series.

Record median and run range for entry control usable, door switch finished, onboarding name focus, hall usable; record request counts and transferred bytes by initiator before first interaction and before hall usable, including worker fetches and demand requests. Test first gesture audio, skip, replay, new and completed identities, and return-to-hall. Only defer a group when traces show it competes for the startup path and the same verification shows no regression in later usability. Keep #92 open until there is a valid before/after trace.
