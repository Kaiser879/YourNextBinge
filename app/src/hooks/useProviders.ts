import {useCallback, useEffect, useState} from 'react';
import {Provider} from '../types.live';
import {TmdbClient} from '../services/tmdb';

export interface ProviderListState {
  providers: Provider[];
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  retry: () => void;
}

/** Loads the India provider list once; the client caches it for 7 days. */
export function useProviders(
  client: TmdbClient,
  region: string,
  enabled: boolean,
): ProviderListState {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    enabled ? 'loading' : 'ready',
  );
  const [error, setError] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setStatus('ready');
      return;
    }
    let cancelled = false;
    setStatus((current) => (providers.length > 0 ? current : 'loading'));

    void client
      .getProviders(region)
      .then((result) => {
        if (!cancelled) {
          setProviders(result);
          setStatus('ready');
          setError(null);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Could not load providers.',
          );
          setStatus((current) => (providers.length > 0 ? current : 'error'));
        }
      });

    return () => {
      cancelled = true;
    };
    // providers.length is intentionally omitted: it is only used to preserve
    // an existing list across retries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, enabled, generation, region]);

  const retry = useCallback(() => {
    setGeneration((value) => value + 1);
  }, []);

  return {providers, status, error, retry};
}
