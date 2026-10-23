import {useCallback, useEffect, useState} from 'react';
import {TmdbClient} from '../services/tmdb';
import {Movie} from '../types.live';

export type DetailStatus = 'loading' | 'ready' | 'error';

export interface MovieDetailState {
  movie: Movie | null;
  status: DetailStatus;
  error: string | null;
  retry: () => void;
}

export function useMovieDetail(
  client: TmdbClient,
  movieId: number,
  region: string,
): MovieDetailState {
  const [movie, setMovie] = useState<Movie | null>(null);
  const [status, setStatus] = useState<DetailStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);

    void client
      .getMovie(movieId, region)
      .then((result) => {
        if (!cancelled) {
          setMovie(result);
          setStatus('ready');
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : 'Could not load details.',
          );
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client, generation, movieId, region]);

  const retry = useCallback(() => {
    setGeneration((value) => value + 1);
  }, []);

  return {movie, status, error, retry};
}
