import {useCallback, useEffect, useMemo, useState} from 'react';
import {TmdbClient, TmdbError} from '../services/tmdb';
import {MovieSummary} from '../types.live';

export type FeedStatus = 'loading' | 'ready' | 'error';

export interface RowState {
  status: FeedStatus;
  items: MovieSummary[];
  error: string | null;
}

const LOADING: RowState = {status: 'loading', items: [], error: null};

const EMPTY: RowState = {status: 'ready', items: [], error: null};

function messageFor(error: unknown): string {
  if (error instanceof TmdbError) {
    if (error.kind === 'config') {
      return 'TMDB is not configured. Add a key in config.local.ts.';
    }
    if (error.kind === 'network') {
      return 'No network — showing what we already saved.';
    }
    if (error.kind === 'http') {
      return `TMDB returned ${error.status ?? 'an error'}.`;
    }
  }
  return 'Could not load this row.';
}

export interface HomeFeed {
  trending: RowState;
  onServices: RowState;
  refresh: () => void;
  refreshing: boolean;
}

/**
 * Loads the two live rows independently. One failure never blanks the other,
 * and cached rows are returned by the TMDB client even when the network is
 * down (hence calling the client in offline mode too).
 */
export function useHomeFeed(
  client: TmdbClient,
  region: string,
  providerIds: number[],
  enabled: boolean,
): HomeFeed {
  const [generation, setGeneration] = useState(0);
  const [trending, setTrending] = useState<RowState>(
    enabled ? LOADING : EMPTY,
  );
  const [onServices, setOnServices] = useState<RowState>(
    enabled && providerIds.length > 0 ? LOADING : EMPTY,
  );
  const [refreshing, setRefreshing] = useState(false);

  const providerKey = useMemo(
    () => [...providerIds].sort((a, b) => a - b).join(','),
    [providerIds],
  );

  useEffect(() => {
    if (!enabled) {
      setTrending(EMPTY);
      setOnServices(EMPTY);
      return;
    }

    let cancelled = false;
    setTrending((current) =>
      current.items.length > 0 ? current : LOADING,
    );
    setOnServices((current) => {
      if (providerIds.length === 0) {
        return EMPTY;
      }
      return current.items.length > 0 ? current : LOADING;
    });
    setRefreshing(true);

    void client
      .getTrending(region)
      .then((items) => {
        if (!cancelled) {
          setTrending({status: 'ready', items, error: null});
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setTrending((current) =>
            current.items.length > 0
              ? current
              : {status: 'error', items: [], error: messageFor(error)},
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRefreshing(false);
        }
      });

    if (providerIds.length === 0) {
      setOnServices(EMPTY);
    } else {
      void client
        .getOnServices(region, providerIds)
        .then((items) => {
          if (!cancelled) {
            setOnServices({status: 'ready', items, error: null});
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setOnServices((current) =>
              current.items.length > 0
                ? current
                : {status: 'error', items: [], error: messageFor(error)},
            );
          }
        });
    }

    return () => {
      cancelled = true;
    };
    // providerKey intentionally represents the sorted provider list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, enabled, generation, providerKey, region]);

  const refresh = useCallback(() => {
    setGeneration((value) => value + 1);
  }, []);

  return {trending, onServices, refresh, refreshing};
}
