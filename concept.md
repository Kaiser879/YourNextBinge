# Your Next Binge — Product Concept

> **Status:** v2 concept (the pivot). Supersedes the original "mood picker" pitch.
> **One-day target:** see Build Plan. **Region:** India (IN). **Date:** Oct 22, 2026.

---

## 1. The thesis

**Describe what you want. We only show you things you can actually press play on — tonight, in India — and you can save them.**

The app answers the *real* question behind "what should I watch": not "what exists" (Netflix solved that with a bigger catalog), but **"what is watchable by me, right now, given the services I pay for."** Everything in v2 is built on top of that answer.

Three pillars:

1. **Availability is the filter, not an afterthought.** Every row, search result, and detail screen is scoped to streaming services configured for India. If a search result isn't legally streamable, it doesn't appear.
2. **The catalog is live, the index is local.** TMDB supplies titles, metadata, availability, and trailers. A bundled ~1 MB static embedding index makes *semantic search* work with no server and no neural runtime.
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

### 4.5 Semantic search (the "embedded model")

**Constraint:** Vega RN has no on-device neural runtime (no ONNX/TFLite without a
hand-written native module). A true MiniLM-at-runtime is out of scope. The design
below is a *real embedded model*, distilled rather than neural:

- **Offline build step** (Python, `tools/embed/`, committed and reproducible):
  1. Fetch ~1,200 India-available titles from `/discover` (≤60 pages,
     with `overview`, genres, `keywords`), plus overview+keywords text.
  2. Load **GloVe 6B 50d** (downloaded once onto the host, not shipped whole),
     prune to ~15k most-frequent English words + movie-domain vocabulary
     (TMDB keyword tokens), **int8-quantize** → ~0.75 MB vocabulary table.
  3. Compute each doc's vector as the **IDF-weighted mean of token vectors**,
     stored as float32 (1,200 × 50 ≈ 240 KB).
  4. Ship: `doc_ids + titles + doc_vectors + vocab_table + idf` (~1 MB total).
- **On-device runtime** (pure JS, one matrix pass): tokenize query → mean token
  vector (same IDF weighting) → L2 normalize → cosine vs 1,200 docs → top-k.
  ~60k multiply-adds. Sub-10 ms on Hermes.
- **Why GloVe-mean instead of LSA:** one consistent space for queries and docs,
  no training, robust at tiny corpus sizes, and the host has numpy only.
- **What it powers:** the search screen ("cosy sci-fi", "sad but hopeful space
  movie"), **More like this** (doc↔doc cosine, replacing v1's mood/genre overlap
  heuristic), and a small re-rank boost on the live rows.
- **Because the corpus is availability-scoped, search results are inherently
  watchable in India.** That is the demo's money shot.
- **Known limitation (stated in demo + README):** 50-d static vectors are
  latent-semantic quality, not transformer quality. A remote embedding endpoint
  would raise quality but adds a server and defeats "embedded" — documented, not built.
- **Fallback:** TMDB `/search/movie` keyword search, clearly labeled.

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
| Watchlist persistence | AsyncStorage via kepler | Verify the 0.83 import path exists (spike) |
| Offline fallback | v1 bundled catalog + relaxation ladder | Already built and tested |

---

## 8. Build plan (one day)

**Go/no-go gate at hour 5:** semantic search must produce sane rankings for ~5
test queries ("cosy sci-fi", "heist, funny", "sad but hopeful space", "Tamil
thriller", "comfort 90s"). Otherwise keyword search ships and §4.5 is labeled
"next".

| Time | Work |
|---|---|
| 0:00–0:30 | Spikes in parallel: VVD→TMDB HTTPS, poster image load, keyboard, YouTube WebView, AsyncStorage on 0.83. *If VVD has no internet → stop, tell user.* |
| 0:30–2:30 | tmdb.ts + manifest services + Home rows (trending, my services, my list, search, vibe, shortcuts) |
| 2:30–3:15 | Detail + availability chips |
| 3:15–3:45 | Settings (service picker) + persistence |
| 3:45–4:30 | Watchlist + My List row |
| 4:30–5:00 | Trailer modal or cut; first full-flow device run buffer |
| 5:00–8:00 | Semantic search (index build → runtime → screen) |
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
| GloVe download fails / index quality poor | LSA fallback (numpy-only SVD) or keyword search; §4.5 has an explicit hour-5 kill switch |
| AsyncStorage path changed in RN 0.83 | Spike with a one-line write/read test; alternative = Vega File System |
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

*Concept v2 — availability-driven discovery with a distilled local embedding index.*
