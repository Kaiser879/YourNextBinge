import {useCallback, useEffect, useState} from 'react';
import {TmdbClient, TmdbError} from '../services/tmdb';

export type BootMode = 'checking' | 'live' | 'offline';

const BOOT_TIMEOUT_MS = 4000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Boot check timed out')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Decide whether the app has a usable live data source. A missing key is an
 * immediate offline boot; a network/key failure falls back to the curated
 * catalog instead of blocking on a spinner.
 */
export function useBootMode(client: TmdbClient, configured: boolean) {
  const [mode, setMode] = useState<BootMode>(
    configured ? 'checking' : 'offline',
  );

  const check = useCallback(async () => {
    if (!configured) {
      setMode('offline');
      return;
    }
    setMode('checking');
    try {
      await withTimeout(client.getConfiguration(), BOOT_TIMEOUT_MS);
      setMode('live');
    } catch (error) {
      if (error instanceof TmdbError) {
        console.warn(`[YNB] boot check failed (${error.kind})`);
      }
      setMode('offline');
    }
  }, [client, configured]);

  useEffect(() => {
    void check();
  }, [check]);

  return {mode, retry: check};
}
