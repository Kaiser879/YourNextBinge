# HANDOFF — Your Next Binge (Vega OS)

> Written for a fresh AI agent or developer picking this up cold.
> Date: 2026-10-22. Working directory: `/home/kaiser/Projects/Amazon-devpost/your-next-binge`
> (the folder was renamed from `Your Next Binge` — the space broke the build; see §9).

---

## 1. TL;DR

A React Native for Vega (Fire TV) app is scaffolded, implemented, unit-tested, built, installed, and verified running on the Vega Virtual Device. The full remote flow works end to end. Remaining work: a release build + Release install check, and the 60-second demo recording. README, git init, and code cleanup are done.

- App: `app/` (RN 0.83, TypeScript)
- Package id: `com.yournextbinge.app`, component id `com.yournextbinge.app.main`
- SDK: Vega SDK **0.24.12112**, CLI **1.4.7**
- Tests: **19 passing** (12 recommender, 5 app-flow, 2 template leftovers)
- TypeScript: `tsc --noEmit` clean
- Debug build + install + launch on VVD: **verified**
- Remote flow on VVD: **verified via app logs** (see §8)

## 2. Read these first

1. `your-next-binge-vega-spec.md` — the product spec (Go API was cut; §8 is now "Data access (no API)")
2. `AGENTS.md` — Amazon Devices Builder Tools steering doc (mandatory session setup, CLI confirmation rules)
3. `/home/kaiser/.opencode/plan/your-next-binge-1-day.md` — the day plan this work follows
4. `HANDOFF.md` (this file)

## 3. Environment state

| Item | State |
|---|---|
| OS | CachyOS (Arch-based), x86_64, Wayland/niri |
| Node | v26.11.1 (RN 0.83 requires ≥22.14 — satisfied) |
| npm | 12.2.1 |
| Vega CLI | `/home/kaiser/vega/bin/vega` (on PATH via `~/vega/env`) |
| SDK | `/home/kaiser/vega-components/vega-sdk/main/0.24.12112` (6.1 GB) |
| SDK health | `vega sdk config doctor` → 1 validated, 0 corrupted |
| VVD | installed, **currently stopped**; restart with `vega virtual-device start` |
| Go | go1.27.1 installed but **unused** (backend was cut) |
| Git | repo **is** a git repository (initialized 2026-10-22, root `.gitignore`) |

### Environment fixes already applied (do not redo)

1. **Broken SDK path.** `~/vega/config.json` had `"sdkPath": "/home/kaiser/\\"`, which created a literal directory named `\`. Fixed with `vega sdk config setup --component-path /home/kaiser/vega-components --non-interactive`; the stray `\` directory was deleted. SDK now lives at `~/vega-components/vega-sdk/main/0.24.12112`.
2. **Missing `~/vega/env`.** Created it (adds `~/vega/bin` to PATH). Sourced from `~/.bashrc`, `~/.bash_profile`, and `~/.config/fish/config.fish` (`fish_add_path --global $HOME/vega/bin`).
3. **Broken VVD launcher symlink.** `.../vvd/bin/virtualdevice` pointed at `/`. Replaced with an absolute symlink to `.../workspace/env/KeplerCLIKVDI-2.0/runtime/bin/virtualdevice`.
4. **Folder rename.** "Your Next Binge" → `your-next-binge` because the Vega manifest builder shells out with an unquoted path.

## 4. What was built

```
your-next-binge/
├── AGENTS.md
├── your-next-binge-vega-spec.md
├── HANDOFF.md
└── app/
    ├── manifest.toml            # title "Your Next Binge", icon, [os.version] 1.2
    ├── app.json                 # name com.yournextbinge.app.main, displayName
    ├── package.json             # RN 0.83 stack
    ├── jest.config.json         # kepler preset; tests under test/
    ├── assets/image/app_icon.png# 512x512 generated icon
    ├── src/
    │   ├── App.tsx              # custom 4-screen stack + Back handling + state
    │   ├── theme.ts             # colors/spacing/type tokens (no magic numbers in screens)
    │   ├── types.ts             # MoodId, GenreId, Title, filters, results
    │   ├── data/catalog.ts      # 83 curated titles (genres, synopses, collections)
    │   ├── services/recommender.ts  # filter/score/rank/explain + relaxation
    │   ├── services/focus.ts    # guarded FindNodeHandle/FocusManager wrappers
    │   ├── hooks/useInitialFocus.ts # explicit initial focus per screen
    │   ├── components/
    │   │   ├── FocusTile.tsx    # THE focusable primitive (focus != selected)
    │   │   └── RankCard.tsx     # top card + compact result rows
    │   └── screens/
    │       ├── HomeScreen.tsx   # 7 mood tiles + Continue/Reset, explicit D-pad map
    │       ├── RefineScreen.tsx # runtime / genre / intensity chips + submit
    │       ├── ResultsScreen.tsx# relaxed banner, top match, ranked rows
    │       └── DetailScreen.tsx # synopsis, tags, reason, Back
    └── test/
        ├── App.spec.tsx         # 5 UI-flow tests
        ├── recommender.spec.ts  # 10 logic tests
        └── Tile.spec.tsx        # 2 leftover template tests (see §11)
```

### Behaviour implemented

- **Home:** 7 mood tiles (Cozy, Funny, Mind-bending, Thrilling, Comfort Watch, Romantic, Thought-provoking), Continue disabled until a mood is chosen, Reset clears everything. Explicit `FocusManager.setNextFocus` map (indices 0–6 moods, 7 Continue, 8 Reset) because geometric focus drifted at row edges.
- **Refine:** runtime presets (Any/90/120/180), genre chips (Any + 8 genres), intensity (Any/Gentle/Some edge/Intense), submit + Back. All optional.
- **Results:** ranked 1–6 results, top match visually emphasised, "why this fits" line per result, relaxed banner with "Broaden request" chip, Back.
- **Detail:** title/year/runtime/genres, mood tags, intensity, reason, original synopsis, disclaimer that streaming availability is not shown, Back restores the same results and focus index.
- **Back:** `useKeplerBackHandler()` from `@amazon-devices/react-native-kepler` — detail→results→refine→home, exit from home.

### Recommendation logic (`app/src/services/recommender.ts`)

Weights are centralised in `WEIGHTS`:

```ts
{ moodTag: 30, genre: 20, intensity: 10, ratingMultiplier: 2, unknownRuntimePenalty: 5 }
```

- Filters: runtime (known runtimes only), genre (strict), intensity cap, era/decade (strict).
- **Unknown-runtime rule ("permissive-unknown"):** `runtime === null` is kept when a runtime filter is active, penalised by 5, and ranks below known runtimes. Documented in code; must also go in the README.
- Sort: score desc → rating (known before null) → year desc → id asc. Fully deterministic.
- Relaxation ladder when strict filters return nothing: intensity → genre → era → runtime → (last resort) mood. Returns `wasRelaxed` + `relaxedConstraints` so the UI can explain. Never returns an empty list.
- Limit default 5, hard cap 6.

### Catalog

83 titles, all with factual metadata and **original synopses written for this project**, `rating: null` everywhere (no third-party ratings), no posters/artwork. Mood coverage: every one of the 7 moods has at least one title (asserted by a test). Genre coverage includes **documentary**, so no genre forces the relaxed path. Era coverage: every decade bucket (2020s → pre-1990) is populated (asserted by a test). Four `CURATED_COLLECTIONS` presets are asserted to return exact-match (never relaxed) results.

### Curation + verbosity layer (Oct 22, 2026)

- **Era filter** on Refine (Any / 2020s / 2010s / 2000s / 1990s / 1980s & older), strict with its own relax step (before runtime). Era match adds `WEIGHTS.era: 8` and appears in the why-this-fits line.
- **Curator's shortcuts** on Home: 4 collection presets that override all filter state and jump straight to ranked results. Home D-pad map extended end-to-end (actions row flows down into shortcuts).
- **Verbose copy:** richer why-this-fits line (mood • genre • intensity label • era • runtime-not-logged), full-sentence relaxation banner, Detail screen sections (GOOD TO KNOW, YOU MAY ALSO LIKE with 3 related titles ranked by mood/genre overlap; selecting one re-anchors the shortlist on that title's first mood).

## 5. Build / run / test commands

Always load the SDK env first (fish does it automatically after the PATH fix):

```bash
source ~/vega/env          # bash/zsh; fish gets it from config.fish
cd /home/kaiser/Projects/Amazon-devpost/your-next-binge/app
```

```bash
npm install                     # already done
npx tsc --noEmit                # typecheck
npx jest --colors=false         # all tests (17)
npm run build:debug             # Debug build, all arches
npm run build:release           # Release build
```

Device loop:

```bash
vega virtual-device start                       # start VVD (see §9 — detach it)
vega device list
vega device install-app --directory . --buildType Debug
vega device terminate-app --directory .
vega device launch-app --directory .
vega device is-app-running --appName com.yournextbinge.app.main
```

Remote input:

```bash
vega exec vda devices                     # → emulator-5554
vega exec vda -s emulator-5554 shell "inputd-cli button_press KEY_ENTER"
# keys: KEY_UP KEY_DOWN KEY_LEFT KEY_RIGHT KEY_ENTER KEY_BACK KEY_HOME
```

Logs (filter app logs):

```bash
vega device start-log-stream | grep -E '\[YNB'
```

## 6. Key decisions (and why)

| Decision | Choice | Why |
|---|---|---|
| RN line | **0.83** (`helloWorld` template) | Node 26 satisfies RN 0.83's ≥22.14; RN 0.72's Metro targets Node 16–20 |
| Navigation | **Custom 4-screen stack** in `App.tsx` | No extra version-pinned nav packages; trivial Back; state preserved |
| Data | **Bundled catalog**, no API | Spec cut the Go API; app is fully offline |
| Focus | Explicit `setNextFocus` on Home; `useInitialFocus` elsewhere; focus restored after every tile press | Platform focus was unreliable after state updates |
| Icons/art | Generated gradient icon only | No unlicensed artwork |

## 7. Spec changes already made

`your-next-binge-vega-spec.md` was edited to remove the Go API:

- §6 Backend → "No backend server in the MVP"; architecture diagram loses the REST branch
- §6 Local-first → app is fully offline
- §8 → "Data access (no API)" with local accessor contract (`getMoods`, `getRecommendations`, `getTitle`)
- §10 Scope → API removed from in-scope, "A backend or REST API of any kind" added to out-of-scope
- §11 Hour 6 → repurposed to catalog depth + scoring polish
- §13 → "API unreachable" risk removed
- §14 → offline criteria replace network-failure criteria
- §15 → Go API step removed; list renumbered; priority updated

## 8. Verification evidence

### Automated

```
TypeScript: tsc --noEmit → clean
Jest: 2 suites, 24 tests passed (after template Tile removal)
  recommender.spec.ts (19): determinism, runtime filter, unknown runtime,
    genre filter, relaxation, tie-break, reason text, limit cap, weights,
    all-moods coverage, catalog size/uniqueness (83), genre coverage,
    era coverage/strict/relax-order/reason, collections (uniqueness,
    exact-match presets, mood carriers)
  App.spec.tsx (5): opens on mood screen, mood→refine, refine→results,
    detail→back→same results, relaxed-filters path (incl. era chip)
```

Build + install:

```
npm run build:debug → build-vega completed
vega device install-app → Installing/Updating ...success
vega device launch-app → Sending: pkg://com.yournextbinge.app.main
vega device is-app-running → com.yournextbinge.app.main is running
```

### On-device remote sequence (log-verified)

Keys sent: `ENTER, DOWN, DOWN, ENTER, ENTER, ENTER, BACK, BACK, BACK`

Observed `[YNB]` logs:

```
screen=home mood=cozy
focus: Cozy → Comfort Watch → Continue
screen=refine mood=cozy
focus: Find my next binge
screen=results mood=cozy results=5 relaxed=false
screen=detail mood=cozy results=5
focus: Back to results
screen=results mood=cozy results=5
screen=refine mood=cozy results=5
```

This proves: initial focus, mood selection with focus retained, explicit D-pad map, Continue, submit, ranked results, detail, and Back navigation preserving results. The third BACK (refine→home) was not captured before the log stream ended but the handler is symmetric and covered by unit tests.

## 9. Sharp edges / gotchas (read before debugging)

1. **No spaces in the project path.** The Kepler manifest builder runs an unquoted shell command (`/bin/sh: line 1: /home/kaiser/Projects/Amazon-devpost/Your: No such file or directory`). Renaming the folder was the fix. Do not move it back.
2. **VVD dies when its parent shell exits.** Start it detached:
   ```bash
   setsid nohup vega virtual-device start > /tmp/opencode/vvd.log 2>&1 < /dev/null &
   ```
   `vega virtual-device status` returns JSON with `running: true/false`.
3. **Screenshots do not work on virtual devices.** `gwsi-tool-screenshooter` is physical-device only (`product: vvrp-tv-x64`). Visual checks are the developer's eyes on the VVD window, or app logs.
4. **`hasTVPreferredFocus` alone is unreliable** — a screen can mount focused on the wrong/last element. Use `useInitialFocus` (`FocusManager.focus`) after mount.
5. **State updates drop focus.** Selecting a mood/chip re-renders and the platform can lose the focused node. `FocusTile` re-focuses itself 80 ms after `onPress`; keep that behaviour when adding new interactive components.
6. **`FocusManager.setNextFocus` signature is `(fromTag, toTag, direction)`** — not `(source, direction, target)`.
7. **`Pressable` typings in RN 0.83 do not include `nextFocus*` props.** Use `FocusManager.setNextFocus` (as HomeScreen does) instead of props.
8. **Jest has no native focus/back modules.** All calls go through `src/services/focus.ts` guards; `KeplerBackHandler.addEventListener` returns `undefined` in tests, so `App.tsx` uses optional chaining on `subscription?.remove?.()`. Do not "clean up" those guards — tests crash without them.
9. **App logs appear twice** in `start-log-stream` (two sinks). Harmless.
10. **`npm audit` reports 60 high vulnerabilities** in the generated dependency tree. Do not run `npm audit fix --force`; it can break the pinned RN/kepler stack.
11. **SDK CLI docs vs installed CLI:** docs describe older versions; verify flags with `--help` before running (e.g. `vega project list-templates`, `vega device install-app --help`).

## 10. Remaining work (in order)

### A. Catalog — done

`app/src/data/catalog.ts` now holds **83** titles, including documentaries and every decade bucket from 1942 to 2023. Coverage: every mood, every genre, every era. Tests assert `CATALOG.length === 83`, unique ids, at least one title per genre, at least one title per decade bucket, and that all 4 curated-collection presets return exact-match results.

If the catalog grows again: keep synopses original, metadata factual, `rating: null`, no artwork, and re-run `npx jest`. Tune `WEIGHTS` only if new titles produce visibly poor rankings; keep it centralised.

### B. Release build + device check

```bash
npm run build:release
vega device install-app --directory . --buildType Release
vega device launch-app --directory .
```
Release packaging can surface issues that Debug does not — do this before the demo, not at the wire.

### C. README — done

`README.md` at repo root (2026-10-22): what the app is, architecture (bundled catalog + deterministic scoring, no backend), the **unknown-runtime decision**, build/run/test commands, and an honest tested-VVD vs not-tested-hardware statement.

### D. 60-second demo

Follow spec §12: mood screen → Cozy + 120 min → results + reason → detail → Back preserving state → closing line. Record from the VVD window. Screenshots via the SDK tool are not available on VVD; screen-record the host window instead.

### E. Cleanup — done (2026-10-22)

- Template leftovers deleted: `Tile.tsx`, `tiles.tsx`, `assets/*.png` (dir removed), `Tile.spec.tsx`.
- All `[YNB]` / `[YNB-focus]` / `[YNB-display]` console logs removed from `App.tsx` and `FocusTile.tsx`.
- `.adbt-config.json` added at repo root (`platform.default: "vega_os"`).
- Repo initialized as a git repository with a root `.gitignore`; see §3.

## 11. Known gaps / honest status

- Real Fire TV hardware: **not tested**. Only the Vega Virtual Device.
- Catalog is 83 titles with full genre and era coverage.
- No release build has been produced/verified yet (Debug only).
- No demo recording yet. README exists (2026-10-22).
- `App.spec.tsx` exercises component logic with mocked native focus; it does not validate real focus geometry — that required the on-device log run in §8.
- The third BACK (refine→home) was not observed in the log capture, though the handler and tests cover it.

## 12. Quick file/line map for the next agent

| Concern | File |
|---|---|
| Screen state machine, Back, filters | `app/src/App.tsx` |
| Focusable tile + focus retention | `app/src/components/FocusTile.tsx` |
| Result card layout | `app/src/components/RankCard.tsx` |
| Home D-pad map + initial focus | `app/src/screens/HomeScreen.tsx` (`buildFocusMap`, `useEffect`) |
| Refine chips | `app/src/screens/RefineScreen.tsx` |
| Results + relaxed banner | `app/src/screens/ResultsScreen.tsx` |
| Detail layout | `app/src/screens/DetailScreen.tsx` |
| Scoring/weights/filters/relaxation | `app/src/services/recommender.ts` |
| Native focus guards | `app/src/services/focus.ts` |
| Catalog content | `app/src/data/catalog.ts` |
| Manifest (id, icon, OS version) | `app/manifest.toml` |
| Design tokens | `app/src/theme.ts` |
| Tests | `app/test/` |
