#!/usr/bin/env python3
"""Build the bundled document-vector index for semantic search.

What it does:
  1. Fetches up to N India-available movies from TMDB /discover.
  2. Fetches overview + genres + keywords for each (cached under .cache/).
  3. Embeds `title + overview + genres + keywords` with the same model the
     query server uses, L2-normalizes, and writes float32 little-endian.
  4. Writes app/src/data/embedding-index.json (ids, titles, years, provider
     names, numbers only — no synopses are redistributed).

Run with the server venv (it already has torch + sentence-transformers):

    TMDB_API_KEY=... tools/server/.venv/bin/python tools/embed/build_index.py

Optional:
    --region IN --pages 60 --limit 1200 --output app/src/data/embedding-index.json
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import numpy as np
import requests

API_BASE = "https://api.themoviedb.org/3"
MONETIZATION_TYPES = "flatrate|free|ads|rent|buy"
MODEL_NAME = os.environ.get(
    "EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
)
MODEL_REVISION = os.environ.get("EMBED_MODEL_REVISION", "main")
REPO_ROOT = Path(__file__).resolve().parents[2]
CACHE_DIR = Path(__file__).resolve().parent / ".cache"
DEFAULT_OUTPUT = REPO_ROOT / "app" / "src" / "data" / "embedding-index.json"

MONETIZATION_ORDER = ["flatrate", "free", "ads", "rent", "buy"]

API_KEY = os.environ.get("TMDB_API_KEY", "").strip()
ACCESS_TOKEN = os.environ.get("TMDB_ACCESS_TOKEN", "").strip()


def session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"Accept": "application/json"})
    if ACCESS_TOKEN:
        s.headers.update({"Authorization": f"Bearer {ACCESS_TOKEN}"})
    return s


def get_json(
    s: requests.Session,
    path: str,
    params: Dict[str, Any],
    attempts: int = 4,
) -> Dict[str, Any]:
    url = f"{API_BASE}{path}"
    if not ACCESS_TOKEN:
        params = {**params, "api_key": API_KEY}
    for attempt in range(attempts):
        response = s.get(url, params=params, timeout=20)
        if response.status_code == 429:
            wait = 2 ** attempt
            print(f"  429 on {path}; retrying in {wait}s", file=sys.stderr)
            time.sleep(wait)
            continue
        if response.status_code >= 500:
            wait = 2 ** attempt
            print(
                f"  {response.status_code} on {path}; retrying in {wait}s",
                file=sys.stderr,
            )
            time.sleep(wait)
            continue
        response.raise_for_status()
        return response.json()
    raise RuntimeError(f"TMDB request failed after {attempts} attempts: {path}")


def discover_page(
    s: requests.Session, region: str, page: int
) -> List[Dict[str, Any]]:
    payload = get_json(
        s,
        "/discover/movie",
        {
            "watch_region": region,
            "with_watch_monetization_types": MONETIZATION_TYPES,
            "sort_by": "popularity.desc",
            "vote_count.gte": 20,
            "include_adult": "false",
            "language": "en-US",
            "page": page,
        },
    )
    return payload.get("results", [])


def detail_path(movie_id: int) -> Path:
    return CACHE_DIR / f"movie-{movie_id}.json"


def fetch_detail(s: requests.Session, movie_id: int) -> Dict[str, Any]:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cached = detail_path(movie_id)
    if cached.exists():
        try:
            return json.loads(cached.read_text())
        except json.JSONDecodeError:
            pass
    payload = get_json(
        s,
        f"/movie/{movie_id}",
        {
            "append_to_response": "keywords,watch/providers",
            "language": "en-US",
        },
    )
    cached.write_text(json.dumps(payload))
    return payload


def top_provider(detail: Dict[str, Any], region: str) -> Optional[str]:
    block = (
        detail.get("watch/providers", {}).get("results", {}).get(region) or {}
    )
    for kind in MONETIZATION_ORDER:
        entries = block.get(kind) or []
        if entries:
            entries = sorted(
                entries,
                key=lambda entry: (
                    entry.get("display_priority", 9999),
                    entry.get("provider_name", ""),
                ),
            )
            name = entries[0].get("provider_name")
            if name:
                return str(name)
    return None


def corpus_text(detail: Dict[str, Any]) -> str:
    title = detail.get("title") or detail.get("original_title") or ""
    overview = detail.get("overview") or ""
    genres = ", ".join(
        genre.get("name", "") for genre in detail.get("genres", [])
    )
    keywords = ", ".join(
        keyword.get("name", "")
        for keyword in detail.get("keywords", {}).get("keywords", [])
    )
    return (
        f"{title}. {overview} "
        f"Genres: {genres}. Keywords: {keywords}."
    ).strip()


def write_output(
    output: Path,
    vectors: np.ndarray,
    docs: List[Dict[str, Any]],
    region: str,
    model_name: str,
    revision: str,
) -> None:
    count, dim = vectors.shape
    # Explicit little-endian float32; the app reads it with Float32Array.
    payload = vectors.astype("<f4").tobytes(order="C")
    encoded = base64.b64encode(payload).decode("ascii")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(
            {
                "schema": 1,
                "model": model_name,
                "modelRevision": revision,
                "dim": int(dim),
                "count": int(count),
                "normalized": True,
                "builtAt": datetime.now(timezone.utc).isoformat(),
                "region": region,
                "vectors": encoded,
                "docs": docs,
            },
            separators=(",", ":"),
        )
    )

    norms = np.linalg.norm(vectors, axis=1)
    worst = float(np.max(np.abs(norms - 1.0))) if count else 0.0
    size_mb = output.stat().st_size / (1024 * 1024)
    print(
        f"wrote {output} count={count} dim={dim} size={size_mb:.2f} MB "
        f"max_norm_error={worst:.6f}"
    )
    if worst > 1e-3:
        raise SystemExit("vector normalization failed")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--region", default=os.environ.get("TMDB_REGION", "IN"))
    parser.add_argument("--pages", type=int, default=60)
    parser.add_argument("--limit", type=int, default=1200)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--batch-size", type=int, default=32)
    args = parser.parse_args()

    if not API_KEY and not ACCESS_TOKEN:
        raise SystemExit(
            "Set TMDB_API_KEY (v3) or TMDB_ACCESS_TOKEN (v4 JWT) first."
        )

    s = session()

    print(f"Discovering up to {args.limit} movies in {args.region} ...")
    discovered: Dict[int, Dict[str, Any]] = {}
    for page in range(1, args.pages + 1):
        results = discover_page(s, args.region, page)
        for movie in results:
            movie_id = movie.get("id")
            if isinstance(movie_id, int) and movie_id not in discovered:
                discovered[movie_id] = movie
        print(f"  page {page}: {len(discovered)} unique")
        if len(discovered) >= args.limit or not results:
            break

    selected = list(discovered.values())[: args.limit]
    print(f"Fetching details for {len(selected)} movies ...")
    details: Dict[int, Dict[str, Any]] = {}
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {
            pool.submit(fetch_detail, s, movie["id"]): movie["id"]
            for movie in selected
        }
        for index, future in enumerate(as_completed(futures), start=1):
            movie_id = futures[future]
            try:
                details[movie_id] = future.result()
            except Exception as error:  # keep the build going
                print(f"  skip {movie_id}: {error}", file=sys.stderr)
            if index % 100 == 0:
                print(f"  detail {index}/{len(selected)}")

    rows: List[Dict[str, Any]] = []
    texts: List[str] = []
    for movie in selected:
        detail = details.get(movie["id"])
        if not detail:
            continue
        text = corpus_text(detail)
        if len(text) < 30:
            continue
        # Keep the corpus strictly availability-scoped: discover can return a
        # title whose provider block later disappears.
        provider = top_provider(detail, args.region)
        if provider is None:
            continue
        rows.append(
            {
                "id": int(movie["id"]),
                "title": detail.get("title")
                or movie.get("title")
                or "Untitled",
                "year": int((detail.get("release_date") or "0")[:4] or 0)
                or None,
                "provider": provider,
            }
        )
        texts.append(text)

    if not rows:
        raise SystemExit("No usable titles; check the TMDB key and region.")

    print(f"Embedding {len(texts)} documents with {MODEL_NAME} ...")
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer(MODEL_NAME, revision=MODEL_REVISION)
    vectors = model.encode(
        texts,
        batch_size=args.batch_size,
        convert_to_numpy=True,
        normalize_embeddings=False,
        show_progress_bar=True,
    ).astype("float32")

    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    vectors = vectors / norms

    write_output(
        args.output,
        vectors,
        rows,
        args.region,
        MODEL_NAME,
        MODEL_REVISION,
    )


if __name__ == "__main__":
    main()
