# Vector index builder

Builds the document vectors that ship inside the app for on-device semantic
search. The app never embeds documents at runtime; only the query is encoded,
by `tools/server/embed_server.py`.

## Prerequisites

- A TMDB v3 API key **or** a v4 read access token (JWT). The builder sends the
  token as a Bearer header and the key as a query parameter.
- The server venv (it already has torch, numpy, sentence-transformers, and
  requests):

```bash
uv python install 3.12
uv venv --python 3.12 tools/server/.venv
uv pip install --python tools/server/.venv/bin/python -r tools/server/requirements.txt
```

## Build

```bash
TMDB_ACCESS_TOKEN=... tools/server/.venv/bin/python tools/embed/build_index.py
# or
TMDB_API_KEY=... tools/server/.venv/bin/python tools/embed/build_index.py
```

Optional flags:

```bash
--region IN          # default
--pages 60           # 60 × 20 = 1,200 candidates
--limit 1200
--workers 8          # detail-fetch concurrency
--batch-size 32
--output app/src/data/embedding-index.json
```

What it does:

1. `/discover/movie` with `watch_region=IN` and all monetization types
   (`flatrate|free|ads|rent|buy`), sorted by popularity.
2. `/movie/{id}?append_to_response=keywords,watch/providers` for each title,
   with a `.cache/` of raw responses (gitignored) so reruns resume cheaply.
3. Corpus text = `title + overview + genres + keywords`.
4. Embeds with `sentence-transformers/all-MiniLM-L6-v2`, L2-normalizes, and
   writes float32 **little-endian** (explicit `<f4`) as base64.
5. Chooses one provider per title, preferring stream → free/ads → rent → buy,
   sorted by TMDB `display_priority`.

## Output shape

```json
{
  "schema": 1,
  "model": "sentence-transformers/all-MiniLM-L6-v2",
  "modelRevision": "main",
  "dim": 384,
  "count": 1200,
  "normalized": true,
  "builtAt": "2026-10-23T…",
  "region": "IN",
  "vectors": "<base64 float32 little-endian, row-major>",
  "docs": [{"id": 123, "title": "…", "year": 2024, "provider": "Prime Video"}]
}
```

The committed index was built on 2026-10-23 with **1,198 titles** (2.43 MB
base64 payload). Rerun the builder to refresh it; the loader validates schema,
dimension, byte length, and normalization, and treats an empty/malformed index
as absent so search falls back cleanly.

## Size

1,200 × 384 float32 = 1.84 MB raw, ~2.4 MB as base64. The plan's fallbacks if
the build/bundle budget objects:

- int8 scalar quantization + per-vector scale (~0.62 MB), or
- a 900-title corpus (~1.84 MB base64).

Re-run the five gate queries after either change:
"cosy sci-fi", "heist, funny", "sad but hopeful space movie", "comfort 90s",
"underdog sports drama".

## Legal

The index carries only TMDB ids, titles, years, provider names, and numbers —
no synopses, overviews, or artwork. Overviews are used transiently to compute
vectors and are cached under `.cache/`, which is gitignored.
