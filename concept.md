# Your Next Binge — Product Concept

> **Status:** v2 concept (the pivot). Supersedes the original "mood picker" pitch.
> **One-day target:** see Build Plan. **Region:** India (IN). **Date:** Oct 22, 2026.

---

## 1. The thesis

**Describe what you want. We only show you things you can actually press play on — tonight, in India — and you can save them.**

The app answers the *real* question behind "what should I watch": not "what exists" (Netflix solved that with a bigger catalog), but **"what is watchable by me, right now, given the services I pay for."** Everything in v2 is built on top of that answer.

Three pillars:

1. **Availability is the filter, not an afterthought.** Every row, search result, and detail screen is scoped to streaming services configured for India. If a search result isn't legally streamable, it doesn't appear.
2. **The catalog is live; search is hybrid.** TMDB supplies titles, metadata, availability, and trailers. The document vectors ship inside the app (<2 MB), and a small server encodes the free-form query with a real sentence-embedding model (`all-MiniLM-L6-v2`) — so semantic search runs true transformer quality without needing a neural runtime on-device.
3. **It remembers you.** A watchlist persisted on-device survives restarts. The same five results can never happen twice — the feed is live.

---

## 2. Postmortem: why v1 fails as a product (kept so we don't repeat it)

- **It answered the wrong question.** 83 hand-picked titles with "we don't show where to watch" = a demo, not a tool.
- **It couldn't improve with use.** No history, no persistence: the same mood always returned the same five titles.
- **No reason to open it twice.** The TV home screen already shows recommendations from a 1000×-larger catalog with real play buttons.
- **We polished a hollow core** (era filter, verbose banners, related titles) instead of fixing the engine.

v1 is retained as an **offline fallback mode** and a "Browse by vibe" secondary flow — the deterministic recommender, relaxation ladder, and explicit D-pad focus maps all carry over.

---

## 3. Information architecture

```
Home ──────────────────────────────────────────┐
  • Trending in India        (live row)       │ Back exits app (TV convention)
  • On my services           (live row)       │
  • My List                  (persisted row)  │
  • Semantic search          (entry point)    │
  • Browse by vibe           (v1 flow reuse)  │
  • Curator's shortcuts      (v1 presets)     │
        │                                   │
        ├─ Search: voice-free D-pad text entry → ranked LOCAL results
        └─ Browse: mood → refine → results (v1 code path, unchanged)
        │
        └─ Detail ──► Trailer (WebView modal)
              ├─ availability chips (stream/rent/buy per service)
              ├─ + My List toggle
              └─ More like this (embedding cosine)
        │
        └─ Settings ─► country fixed IN; pick your services (multi-select)
```

Navigation stays the **existing custom state machine** (it works, it's tested, no
third-party navigation stack risk on Vega). New screens: `search`, `settings`,
`trailer` (modal), `live-detail`. `App.tsx` gains a persisted `settings` slice
(region, selected providers) and a `watchlist` slice.

---

## 4. Feature specifications

### 4.1 TMDB data layer (`app/src/services/tmdb.ts`)

- **Auth:** TMDB v3 API key, shipped in `app/src/config.local.ts` (gitignored;
  `config.example.ts` documents the shape). Acceptable for TV apps; documented in README.
- **Endpoints used:**
  - `/configuration` — image base URLs
  - `/discover/movie?watch_region=IN&with_watch_monetization_types=flatrate|rent|buy&sort_by=popularity.desc` — availability-scoped pool
  - `/discover/movie?watch_region=IN&with_watch_providers=<id1|id2...>` — per-service rows
  - `/trending/movie/day?watch_region=IN` — trending row
  - `/watch/providers/movie?watch_region=IN` — the service picker
  - `/movie/{id}?append_to_response=watch/providers,videos,keywords` — detail
  - `/search/movie?query=` — keyword fallback
- **Caching:** in-memory LRU + AsyncStorage with ~24 h TTL for discover/detail.
- **Offline:** any network layer failure falls back to the v1 bundled catalog and
  shows an honest "Offline — curated picks" banner. Never a blank screen.
- **Images:** `image.tmdb.org/t/p/w342{poster_path}` for rows, `w780`/backdrop on detail.
- **New type:** `Movie` (TMDB-shaped: id, title, year, runtime, rating, overview,
  poster/backdrop URL, provider entries, trailer key). Lives beside—not merged
  into—the v1 `Title` type to keep the offline flow intact.

### 4.2 Availability (India-first)

- Region is **fixed to IN in v2 demo**, but every call takes a `region` parameter.
- Detail chips show **Stream / Rent / Buy** per provider, sourced from
  `watch/providers` (JustWatch data via TMDB).
- "My services" row = `/discover` filtered to the user's selected provider ids.
- If a title has no IN provider at all → it may still appear in trending/search
  only when explicitly marked "Not on your services" (UI choice made during build).

### 4.3 Watchlist

- AsyncStorage (`@amazon-devices/react-native-kepler/Libraries/Storage/AsyncStorage`).
- Stores **movie id + minimal snapshot** (title, poster, year, top provider) so the
  row renders offline.
- Toggle on Detail; dedicated My List row on Home.

### 4.4 Trailer

- TMDB `videos` → official YouTube key → **WebView modal** playing
  `https://www.youtube-nocookie.com/embed/{key}?autoplay=1`.
- Requires `@amazon-devices/webview` + manifest services (see §7).
- **Graceful failure:** if the WebView can't play (spike fails / video missing),
  the button hides and detail falls back to backdrop imagery. Trailer is a
  cut-able feature (see §6 cut order), never a blocker.

### 4.5 Semantic search (embeddings, server-encoded)

**Architecture: hybrid.** Vega RN has no on-device neural runtime (no ONNX/TFLite
without a hand-written native module), so the **query is encoded on a small
server** running a *real* sentence model, while the **search corpus (doc
vectors) ships inside the app**. One round-trip per search; all similarity math
happens on-device against bundled vectors.

- **Server** (`tools/server/embed_server.py`, FastAPI):
  - `POST /embed {"texts": ["…"]} → {"vectors": [[…384 floats…]]}` — the only endpoint.
  - Model: `sentence-transformers/all-MiniLM-L6-v2` (90 MB, ~10–30 ms/query on CPU).
  - Host: **laptop-local FastAPI for the dev/demo cycle** — no cloud, no cold
    start, no rate limits. The *same* code deploys to Render/fly.io/HF endpoint
    when you want a public deployment; nothing in the app changes except the base URL.
- **Offline build step** (`tools/embed/build_index.py`, committed, reproducible):
  1. Fetch ~1,200 India-available titles from `/discover` (≤60 pages) with
     `overview`, genres, `keywords`; corpus text = `title + overview + genres + keywords`.
  2. Embed the corpus with the **same** server/model → L2-normalized doc vectors
     (1,200 × 384 float32 ≈ 1.8 MB — no quantization needed at this size).
  3. Ship in the bundle: `ids + titles + doc_vectors (+ top provider)` → **≈2 MB total**.
- **On-device runtime (pure JS, one matrix pass):** POST query → `/embed` →
  L2-normalize → cosine vs 1,200 × 384 docs (460k float ops, sub-10 ms in
  Hermes) → top-k. End-to-end latency dominated by the single round-trip
  (<200 ms on LAN).
- **What it powers:** the Search screen ("cosy sci-fi", "sad but hopeful space
  movie", "funny heist film"); **More like this** via bundled doc↔doc cosine
  (zero server latency, fully offline once loaded); optional re-rank of live rows.
- **Because the corpus is availability-scoped, search results are inherently
  watchable in India.** That is the demo's money shot.
- **Fallbacks (in order):** ① remote cloud endpoint of the same server image; ②
  TMDB `/search/movie` keyword search, clearly labeled; ③ LSA/numpy-only local
  embeddings — degraded quality, honest labeling.
- **Server-absent behavior:** the Search screen opens, explains its state, and
  never hangs. The rest of the app is unaffected — this server is stateless and
  optional to every other feature.

---

## 5. Non-goals (v2)

- Accounts / profiles / social.
- Learning from watch history (no data source for it on TV anyway).
- Deep-links that open Netflix/Prime apps (Vega cross-launch is out of scope).
- TV-series-first flows (movies only in v2; `discover/tv` is a drop-in later).
- Multiple regions in the demo UI (code is region-parameterized).
- Provider logos (names only unless the spike makes images cheap).

---

## 6. Legal, attribution, and data policy

- Attribution required in-app (footer) and in the README:
  *"This product uses the TMDB API but is not endorsed or certified by TMDB."*
  Provider data is TMDB/JustWatch-adjacent — mention "availability data via TMDB".
- **Nothing distributor-identifying is redistributed:** the bundle carries ids,
  titles, and numbers; synopses/metadata are fetched live and cached ≤24 h.
- API key visibility in the bundle is accepted and documented.
- Real ratings appear in v2 (`vote_average`) — the v1 "ratings are null" policy
  applies only to offline fallback titles.

---

## 7. Vega platform facts this concept depends on (verified in docs)

| Need | Mechanism | Notes |
|---|---|---|
| HTTPS networking | Allowed by default | Only `http://` needs a manifest cleartext allowlist |
| TV keyboard | `[[wants.service]] id = "com.amazon.inputmethod.service"` in `manifest.toml` | `TextInput` + system keyboard, `Keyboard` API |
| Trailer playback | `@amazon-devices/webview` + `webview.renderer_service`, `media.server`, `mediametrics`, `mediabuffer`, `mediatransform`, `audio.stream`, `audio.control`, `gipc.uuid.*` | Spike before commit — YouTube iframe |
| Query embedding | HTTPS POST to the local FastAPI server (QEMU gateway / forwarded port) | Spike: reachability + latency from VVD |
| Watchlist persistence | AsyncStorage via kepler | Verify the 0.83 import path exists (spike) |
| Offline fallback | v1 bundled catalog + relaxation ladder | Already built and tested |

---

## 8. Build plan (one day)

**Go/no-go gate at hour 5:** the embedding server must be up and respond correct
rankings for ~5 free-form queries ("cosy sci-fi", "heist, funny", "sad but
hopeful space movie", "comfort 90s", "underdog sports drama") in <500 ms each
from the VVD. Otherwise keyword search ships and §4.5 is labeled "next".

| Time | Work |
|---|---|
| 0:00–0:30 | Spikes in parallel: VVD→TMDB HTTPS, poster image load, keyboard, YouTube WebView, AsyncStorage on 0.83, **VVD→host server reachability**. In background: server venv + torch install (`uv`, Python 3.12 wheel) + model download. *If VVD has no internet → stop, tell user.* |
| 0:30–2:30 | tmdb.ts + manifest services + Home rows (trending, my services, my list, search, vibe, shortcuts) |
| 2:30–3:15 | Detail + availability chips |
| 3:15–3:45 | Settings (service picker) + persistence |
| 3:45–4:30 | Watchlist + My List row |
| 4:30–5:00 | Trailer modal or cut; first full-flow device run buffer |
| 5:00–5:30 | `build_index.py` run via the live server → bundle the doc-vector module |
| 5:30–8:00 | Search screen: server round-trip, on-device cosine, results with availability badges; wire More-like-this to bundled cosine
| 8:00–9:00 | Tests (mocked fetch), lint, tsc, Release build, VVD run |
| 9:00–9:30 | Commit `feat/live-discovery`, merge to `main`, demo script |

**Cut order if time slips:** ① trailer modal → ② semantic search (keep infra,
drop the claim) → ③ More-like-this row → ④ provider logos.
**Never cut:** India availability, watchlist, offline fallback.

**Done criteria (gates):**
- Words typed on the remote produce watchable results — verified on VVD.
- Toggling "My services" visibly changes the Home row.
- Watchlist survives a full app kill/relaunch.
- Trailer either plays or is gracefully absent — no error toast.
- `lint` 0 errors, `tsc` clean, tests green, **Release** build installed and running.
- Git clean; feature merged only after Release verified on VVD.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| VVD has no outbound internet | Spike #1 is the very first task; fallback = real Fire TV hardware or demo dies loudly, not silently |
| TMDB key activation delay | User signs up first; spikes run while it activates |
| JustWatch/IN provider coverage gaps | Row shows what the data says; demo script avoids claiming exhaustiveness |
| YouTube iframe blocked/heavy on TV Chromium | Spike; fallback = backdrop + trailer button hidden |
| AsyncStorage path changed in RN 0.83 | Spike with a one-line write/read test; alternative = Vega File System |
| torch/server install fails (host Python 3.14 has no torch wheel) | Server runs in its own `uv` venv on Python 3.12; host app build unaffected. Worst case: LSA/numpy-only build from §4.5 fallback |
| Server unreachable from VVD (QEMU gateway) | Spike; try forwarded port. Worst case: keyword search ships; nothing else degrades |
| Server crash/latency mid-demo | Server runs on the laptop — no cloud cold start; health-checked before recording; single stateless endpoint |
| Scope creep | Cut order exists; anyone adding scope must name which cut it displaces |

---

## 10. The 60-second demo script

1. **Home (5 s):** Trending in India + On my services — live rows, real posters.
2. **Search (20 s):** open keyboard, type *cosy movie under two hours* vibe phrase →
   results show only IN-streamable titles, **availability badges visible**.
3. **Detail (15 s):** open top hit — stream/rent/buy chips, real rating, year.
4. **Trailer (10 s):** press Trailer → plays inside the app → Back.
5. **Watchlist (10 s):** + My List → Back to Home → My List row has it.
6. **Offline integrity (5 s, optional show):** relaunch — My List intact; unplug the
   network → "Offline — curated picks" banner, mood flow still works.

Closer: *"The TV already knows what exists. We answer what you can watch tonight."*

---

*Concept v2 — availability-driven discovery with server-encoded embeddings over a bundled vector index.*
