# Your Next Binge

**Describe what you want. We only show you things you can actually press play on — tonight, in India — and you can save them.**

A React Native for Vega (Fire TV) discovery app. The v2 pivot scopes every row, search result, and detail screen to titles with an India streaming, rent, or buy option, backed by TMDB and a bundled semantic-search index.

---

## Status (2026-10-23)

| Area | State |
|---|---|
| Live TMDB data layer | implemented; verified on the VVD with a local v3 key |
| Live Home (trending / on my services / My List) | verified: 14 trending + 14 on-services titles |
| Movie detail + availability chips | verified: live title with 3 India offers |
| Watchlist persistence | verified across a process restart (survives relaunch) |
| India service picker (Settings) | verified: 5 first-run providers persisted |
| Semantic search | verified on the VVD: 12 results, **31–33 ms** for all five gate queries |
| Vector index | built: **1,198 titles, 2.43 MB** (`app/src/data/embedding-index.json`) |
| Embedding server | `tools/server/embed_server.py` (FastAPI + MiniLM), 17–23 ms/query on host |
| Trailer | **cut** — the Vega Virtual Device image does not ship the WebView module, so the dependency blocked installation. Detail uses the backdrop instead. |
| Build | Debug **and** Release install and launch on the VVD |
| Tests | 76 Jest tests, `tsc --noEmit` clean, ESLint 0 errors |

The v1 mood picker is retained as **Browse by vibe** and as the offline fallback.

---

## How it works

```
Live Home
  ├─ Trending in India      (TMDB discover, watch_region=IN)
  ├─ On my services         (same, filtered to your provider ids)
  ├─ My List                (device-persisted snapshots)
  ├─ Search                 (server-encoded query + bundled vectors)
  ├─ Browse by vibe         (v1 mood → refine → results flow)
  └─ Curator's shortcuts    (v1 preset collections)

Search ──► embed server (query) ──► on-device cosine over ~1,200 IN titles
      └── fallbacks: TMDB keyword search, then local title matching

Movie detail
  ├─ Stream / Rent / Buy chips per provider
  ├─ + My List toggle
  └─ More like this (bundled vectors, IN-scoped)
```

### Availability is the filter

- Region is fixed to **IN** in the demo UI; every service call still takes a `region` parameter.
- TMDB `with_watch_monetization_types` includes `flatrate`, `free`, `ads`, `rent`, and `buy`. The UI groups them as **Stream** (flatrate/free/ads), **Rent**, and **Buy**, so ad-supported titles are not silently dropped.
- `concept.md` suggested `/trending/movie/day?watch_region=IN`; TMDB's trending endpoint ignores `watch_region`. The "Trending in India" row is therefore `/discover/movie` sorted by popularity with `watch_region=IN`.

### Search

- The query is encoded by a small FastAPI server running `sentence-transformers/all-MiniLM-L6-v2`.
- The document vectors ship in the app (`app/src/data/embedding-index.json`), so similarity runs on-device against an India-scoped corpus.
- If the server is down, search falls back to TMDB keyword search intersected with the index ids; if the network is also down, it falls back to local title matching. The screen always says which mode produced the results.
- The VVD reaches the host at `http://10.0.2.2:8000`; the manifest includes a cleartext allowlist for that host during development.

---

## Setup

### 1. TMDB credential

```bash
cd app
npm run setup:config       # copies config.example.ts -> config.local.ts
$EDITOR src/config.local.ts
```

Fill in **either** `TMDB_API_KEY` (v3, 32 characters) **or**
`TMDB_ACCESS_TOKEN` (v4 read access token, a JWT starting with `eyJ`). The
client sends the v3 key as `?api_key=` and the v4 token as
`Authorization: Bearer …`; no code change is needed to switch.

`config.local.ts` is gitignored. The credential ships inside the bundle —
acceptable for a demo build, not for a production submission.

If TMDB answers `Invalid API key`, the credential is revoked, not just missing:
check it in the TMDB dashboard before rebuilding.

### 2. Embedding server (optional, for smart search)

```bash
# from the repo root
uv python install 3.12
uv venv --python 3.12 tools/server/.venv
uv pip install --python tools/server/.venv/bin/python -r tools/server/requirements.txt
tools/server/.venv/bin/python tools/server/embed_server.py
curl -s localhost:8000/health
```

The model downloads on first start (~90 MB). Keep the server bound to `0.0.0.0:8000` so the VVD can reach `10.0.2.2:8000`.

### 3. Build the vector index (needs a TMDB key)

```bash
TMDB_ACCESS_TOKEN=... tools/server/.venv/bin/python tools/embed/build_index.py
# or: TMDB_API_KEY=... tools/server/.venv/bin/python tools/embed/build_index.py
```

Writes `app/src/data/embedding-index.json` (~2.4 MB of float32 vectors) and a `.cache/` of raw responses (gitignored). The committed index has **1,198 titles** (2.43 MB, 384 dimensions, L2-normalized); rerun the builder to refresh the corpus. Each row carries only id, title, year, provider, and the vector — no synopsis.

Reproduction details: `tools/embed/README.md` and `tools/server/README.md`.

---

## Build, run, test

```bash
cd app
npm install
npx tsc --noEmit
npm run lint
npm test
npm run build:debug
npm run build:release

# with the Vega SDK on PATH and a device/VVD connected
vega device install-app --directory . --buildType Debug
vega device launch-app --directory .
```

The VVD must be started detached: `setsid nohup vega virtual-device start ... &`. See `HANDOFF.md` for environment gotchas.

---

## Data, attribution, and legal notes

- Metadata and availability come from TMDB. Availability data is TMDB's JustWatch-sourced watch-provider data.
- Required attribution: **This product uses the TMDB API but is not endorsed or certified by TMDB.**
- The bundled index contains only TMDB ids, titles, years, provider names, and numeric vectors. No synopses, overviews, or artwork are redistributed in the index. Overviews are fetched live and cached on device for at most 24 hours.
- Posters/backdrops are loaded from `image.tmdb.org` at runtime; no artwork is bundled.
- Real TMDB ratings (`vote_average`) are shown. The v1 bundled catalog keeps `rating: null`.

---

## What was tested — and what wasn't

Tested:

- 76 Jest tests: TMDB URL/mapping/retry, cache TTL and persistence, availability grouping, watchlist, settings, base64/index math, search fallbacks, route stack, v1 flow, live Home → detail → watchlist → settings → search.
- TypeScript, ESLint (0 errors), Debug and Release builds with `manifest validation found 0 errors`.
- On the Vega Virtual Device:
  - Boot: `mode=live`; 14 trending titles, 14 on-services titles.
  - Detail: live TMDB title with **3 India availability offers**.
  - Watchlist: add → force-stop → relaunch → entry restored; 5 selected providers also restored.
  - Search: five gate queries all returned 12 semantic results in **31, 32, 31, 32, 32 ms** (server embed + on-device cosine); opening a result and Back preserved the results.
- VVD reachability: `10.0.2.2:8000/health` OK; TMDB HTTPS and `image.tmdb.org` reachable.

Not verified:

- Physical Fire TV hardware (only the VVD).
- Trailer playback: cut because the VVD image lacks `com.amazon.kepler.webview_4@IWebview_4`.
- TMDB image rendering itself is exercised by the UI but not pixel-inspected (the VVD has no working screenshot tool).

---

## Design decisions

| Decision | Why |
|---|---|
| Custom route stack, not react-navigation | No extra version-pinned dependencies; trivial Back handling; testable reducer. |
| Supported `@amazon-devices/react-native-async-storage__async-storage` | The legacy kepler `AsyncStorage` export warns as deprecated and its native backend is unavailable on the VVD, so writes silently failed. The supported package adds a system module and persists across relaunch. |
| Map TMDB responses before caching | Keeps AsyncStorage payloads small and decoupled from API shape changes. |
| Explicit `setNextFocus` grid wiring | Geometric focus drifts at row edges on Vega (proven in v1). |
| Index metadata only | Avoids redistributing synopses while keeping search fully on-device. |
| Cut the trailer | The VVD cannot install any package that depends on the WebView module; availability and watchlist matter more. |
| Boot to v1 vibe flow without a key | Keeps the app usable, testable, and honest when the data source is absent. |

---

## File map

| Concern | File |
|---|---|
| App shell, routes, hydration, v1+v2 state | `app/src/App.tsx` |
| Route union/reducer | `app/src/navigation/routes.ts` |
| TMDB client and mapping | `app/src/services/tmdb.ts` |
| Cache (memory + AsyncStorage, TTL) | `app/src/services/tmdbCache.ts` |
| Persistence wrapper | `app/src/services/storage.ts` |
| Settings / watchlist | `app/src/services/settings.ts`, `watchlist.ts` |
| Availability grouping | `app/src/services/availability.ts` |
| Search orchestration | `app/src/services/search.ts` |
| Embed client / index math | `app/src/services/embedClient.ts`, `embeddings.ts` |
| Live Home / detail / search / settings | `app/src/screens/` |
| Poster row + focus grid | `app/src/components/PosterCard.tsx`, `MediaRow.tsx`, `services/focusMap.ts` |
| v1 flow (unchanged) | `app/src/screens/HomeScreen.tsx`, `RefineScreen.tsx`, `ResultsScreen.tsx`, `DetailScreen.tsx`, `services/recommender.ts`, `data/catalog.ts` |
| Server / index builder | `tools/server/`, `tools/embed/` |
