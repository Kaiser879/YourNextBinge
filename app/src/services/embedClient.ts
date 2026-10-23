/**
 * Client for the laptop-local sentence-embedding server.
 *
 * The server is optional: every caller must handle `EmbedError` and fall back
 * to keyword / local search. Never let it hang the screen.
 */
import {config} from '../config';

const DEFAULT_TIMEOUT_MS = 8000;
const HEALTH_TIMEOUT_MS = 2500;
const MAX_TEXTS = 32;
const MAX_TEXT_LENGTH = 1000;

export class EmbedError extends Error {
  readonly kind: 'network' | 'http' | 'parse' | 'validation' | 'config';

  constructor(
    kind: EmbedError['kind'],
    message: string,
  ) {
    super(message);
    this.name = 'EmbedError';
    this.kind = kind;
  }
}

interface EmbedResponse {
  vectors?: unknown;
  model?: unknown;
  dim?: unknown;
}

function isFiniteNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === 'number' && Number.isFinite(item))
  );
}

export interface EmbedOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

export async function embedTexts(
  texts: string[],
  opts: EmbedOptions = {},
): Promise<Float32Array[]> {
  if (texts.length === 0 || texts.length > MAX_TEXTS) {
    throw new EmbedError(
      'validation',
      `Expected 1-${MAX_TEXTS} texts, received ${texts.length}`,
    );
  }
  if (
    texts.some(
      (text) => text.trim().length === 0 || text.length > MAX_TEXT_LENGTH,
    )
  ) {
    throw new EmbedError(
      'validation',
      `Each text must be 1-${MAX_TEXT_LENGTH} characters`,
    );
  }

  const baseUrl = (opts.baseUrl ?? config.embedBaseUrl).replace(/\/+$/, '');
  if (!baseUrl) {
    throw new EmbedError('config', 'Embedding server URL is not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  const fetchImpl = opts.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(`${baseUrl}/embed`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({texts}),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new EmbedError(
        'http',
        `Embedding server returned ${response.status}`,
      );
    }
    const payload = (await response.json()) as EmbedResponse;
    const vectors = payload.vectors;
    if (!Array.isArray(vectors) || vectors.length !== texts.length) {
      throw new EmbedError(
        'validation',
        'Embedding server returned the wrong number of vectors',
      );
    }
    const parsed: Float32Array[] = [];
    let dim: number | null = null;
    for (const vector of vectors) {
      if (!isFiniteNumberArray(vector)) {
        throw new EmbedError('validation', 'Embedding vector is not numeric');
      }
      if (dim == null) {
        dim = vector.length;
      } else if (vector.length !== dim) {
        throw new EmbedError(
          'validation',
          'Embedding vectors have inconsistent dimensions',
        );
      }
      parsed.push(Float32Array.from(vector));
    }
    return parsed;
  } catch (error) {
    if (error instanceof EmbedError) {
      throw error;
    }
    throw new EmbedError(
      'network',
      `Embedding request failed: ${String(error)}`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export interface EmbedHealth {
  ok: boolean;
  model?: string;
  dim?: number;
}

export async function checkEmbedServer(
  opts: EmbedOptions = {},
): Promise<EmbedHealth> {
  const baseUrl = (opts.baseUrl ?? config.embedBaseUrl).replace(/\/+$/, '');
  if (!baseUrl) {
    return {ok: false};
  }
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? HEALTH_TIMEOUT_MS,
  );
  try {
    const response = await (opts.fetchImpl ?? fetch)(`${baseUrl}/health`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      return {ok: false};
    }
    const payload = (await response.json()) as {
      status?: unknown;
      model?: unknown;
      dim?: unknown;
    };
    return {
      ok: payload.status === 'ok',
      model: typeof payload.model === 'string' ? payload.model : undefined,
      dim: typeof payload.dim === 'number' ? payload.dim : undefined,
    };
  } catch {
    return {ok: false};
  } finally {
    clearTimeout(timeout);
  }
}
