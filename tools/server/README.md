# Embedding server

A single-endpoint FastAPI service that encodes free-form search queries with the
same sentence model used to build the bundled document index
(`sentence-transformers/all-MiniLM-L6-v2`, 384 dimensions).

The server is **optional**: the app falls back to TMDB keyword search, then local
title matching. It holds no state beyond the loaded model.

## Install

From the repo root:

```bash
uv python install 3.12
uv venv --python 3.12 tools/server/.venv
uv pip install --python tools/server/.venv/bin/python -r tools/server/requirements.txt
```

`uv` is only needed on the host, not inside the app.

If `torch` has no wheel for the host Python line, use `fastembed` +
`onnxruntime` with the same MiniLM weights, or run the server on Python 3.12
(the venv command above does this).

## Run

```bash
tools/server/.venv/bin/python tools/server/embed_server.py
# host 0.0.0.0:8000 by default; override with EMBED_HOST / EMBED_PORT
```

The first start downloads the model (~90 MB). Keep it bound to `0.0.0.0` so
the Vega Virtual Device can reach it at `10.0.2.2:8000`.

## API

```bash
curl -s localhost:8000/health | jq
# {"status":"ok","model":"sentence-transformers/all-MiniLM-L6-v2","dim":384,...}

curl -s localhost:8000/embed \
  -H 'content-type: application/json' \
  -d '{"texts":["cosy sci-fi","funny heist"]}' | jq '.dim, (.vectors[0] | length)'
# 384
# 384
```

- `POST /embed` body `{"texts": ["…"]}`; 1–32 texts, ≤1,000 characters each.
- Vectors are returned **raw**; the app L2-normalizes them.
- `GET /health` reports model, dimension, and load time.

## Configuration knobs

| Variable | Default | Purpose |
|---|---|---|
| `EMBED_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | Model name; must match the index metadata |
| `EMBED_MODEL_REVISION` | `main` | Model revision used by the index builder |
| `EMBED_HOST` / `EMBED_PORT` | `0.0.0.0` / `8000` | Bind address |

## Notes

- `POST /embed` is a sync `def` handler, so FastAPI runs it in its threadpool;
  a 10–30 ms CPU encode does not block health checks.
- No CORS is needed: the client is native `fetch`, not a browser.
- The server image is portable to Render/fly.io/HF endpoints if you want a
  public URL; only `EMBED_BASE_URL` in `app/src/config.local.ts` changes.
- Development HTTP needs the manifest cleartext allowlist for `10.0.2.2`.
