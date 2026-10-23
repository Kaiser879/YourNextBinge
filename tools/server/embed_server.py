#!/usr/bin/env python3
"""Laptop-local sentence-embedding server for Your Next Binge.

One endpoint does the work:

    POST /embed  {"texts": ["cosy sci-fi", ...]}
      -> {"vectors": [[...384 floats...]], "model": "...", "dim": 384}

Vectors are returned RAW; the app L2-normalizes them. This keeps the server
replaceable with any model that speaks the same shape.

Run:
    tools/server/.venv/bin/python tools/server/embed_server.py
    # or
    uv run --python tools/server/.venv/bin/python tools/server/embed_server.py

The Vega Virtual Device reaches the host at 10.0.2.2:8000.
"""
from __future__ import annotations

import argparse
import logging
import os
import time
from typing import List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

MODEL_NAME = os.environ.get(
    "EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
)
MAX_TEXTS = 32
MAX_TEXT_LENGTH = 1000
BATCH_SIZE = 32

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s"
)
log = logging.getLogger("ynb-embed")

app = FastAPI(title="Your Next Binge embeddings", version="1.0.0")
_model = None
_model_dim = None
_loaded_at = None


class EmbedRequest(BaseModel):
    texts: List[str] = Field(..., min_length=1, max_length=MAX_TEXTS)


class EmbedResponse(BaseModel):
    vectors: List[List[float]]
    model: str
    dim: int


def load_model():
    global _model, _model_dim, _loaded_at
    if _model is not None:
        return _model
    from sentence_transformers import SentenceTransformer

    started = time.time()
    log.info("loading %s ...", MODEL_NAME)
    _model = SentenceTransformer(MODEL_NAME)
    _model_dim = int(_model.get_sentence_embedding_dimension())
    _loaded_at = time.time()
    log.info(
        "model ready model=%s dim=%d load_ms=%d",
        MODEL_NAME,
        _model_dim,
        (_loaded_at - started) * 1000,
    )
    return _model


@app.on_event("startup")
def warm_model() -> None:
    load_model()


@app.get("/health")
def health():
    return {
        "status": "ok" if _model is not None else "loading",
        "model": MODEL_NAME,
        "dim": _model_dim,
        "loaded_at": _loaded_at,
    }


@app.post("/embed", response_model=EmbedResponse)
def embed(request: EmbedRequest):
    texts = [text.strip() for text in request.texts]
    if any(len(text) == 0 for text in texts):
        raise HTTPException(status_code=400, detail="texts must not be empty")
    if any(len(text) > MAX_TEXT_LENGTH for text in texts):
        raise HTTPException(
            status_code=400,
            detail=f"each text must be <= {MAX_TEXT_LENGTH} characters",
        )

    model = load_model()
    started = time.time()
    vectors = model.encode(
        texts,
        batch_size=BATCH_SIZE,
        convert_to_numpy=True,
        normalize_embeddings=False,
        show_progress_bar=False,
    )
    elapsed_ms = (time.time() - started) * 1000
    log.info("embed n=%d ms=%.1f", len(texts), elapsed_ms)
    return EmbedResponse(
        vectors=vectors.astype("float32").tolist(),
        model=MODEL_NAME,
        dim=int(vectors.shape[1]),
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default=os.environ.get("EMBED_HOST", "0.0.0.0"))
    parser.add_argument(
        "--port", type=int, default=int(os.environ.get("EMBED_PORT", "8000"))
    )
    args = parser.parse_args()

    import uvicorn

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
