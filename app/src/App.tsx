import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {useKeplerBackHandler} from '@amazon-devices/react-native-kepler';
import {isTmdbConfigured} from './config';
import {HomeScreen} from './screens/HomeScreen';
import {RefineScreen} from './screens/RefineScreen';
import {ResultsScreen} from './screens/ResultsScreen';
import {DetailScreen} from './screens/DetailScreen';
import {LiveHomeScreen} from './screens/LiveHomeScreen';
import {MovieDetailScreen} from './screens/MovieDetailScreen';
import {SearchScreen} from './screens/SearchScreen';
import {SettingsScreen} from './screens/SettingsScreen';
import {recommend} from './services/recommender';
import {GENRE_LABELS, TITLE_BY_ID} from './data/catalog';
import {checkEmbedServer, embedTexts} from './services/embedClient';
import {getEmbeddingIndex} from './services/embeddings';
import {runSearch} from './services/search';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  pickDefaultProviderIds,
  saveSettings,
  toggleProvider,
} from './services/settings';
import {TmdbClient, tmdb} from './services/tmdb';
import {loadWatchlist, saveWatchlist, toggleWatchlist} from './services/watchlist';
import {useBootMode} from './hooks/useBootMode';
import {useHomeFeed} from './hooks/useHomeFeed';
import {useProviders} from './hooks/useProviders';
import {colors} from './theme';
import {initialRoute, popRoute, pushRoute, Route} from './navigation/routes';
import {
  CuratedCollection,
  ERA_LABELS,
  EraId,
  GenreId,
  Intensity,
  MoodId,
  RecommendationFilters,
  RecommendationResult,
} from './types';
import {
  MovieSummary,
  SearchState,
  Settings,
  WatchlistEntry,
} from './types.live';

export interface AppServices {
  tmdb: TmdbClient;
  embed: typeof embedTexts;
  checkEmbed: typeof checkEmbedServer;
  configured?: boolean;
}

const defaultServices: AppServices = {
  tmdb,
  embed: embedTexts,
  checkEmbed: checkEmbedServer,
  configured: isTmdbConfigured,
};

interface AppProps {
  services?: AppServices;
}

export const App = ({services = defaultServices}: AppProps) => {
  const configured = services.configured ?? isTmdbConfigured;

  const [stack, setStack] = useState<Route[]>(() => [initialRoute(configured)]);
  const stackRef = useRef(stack);
  stackRef.current = stack;

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [search, setSearch] = useState<SearchState>({status: 'idle'});
  const [homeFocus, setHomeFocus] = useState({row: 0, item: 0});

  // v1 (offline) flow state.
  const [mood, setMood] = useState<MoodId | null>(null);
  const [genre, setGenre] = useState<GenreId | null>(null);
  const [maxRuntimeMinutes, setMaxRuntimeMinutes] = useState<number | null>(
    null,
  );
  const [maxIntensity, setMaxIntensity] = useState<Intensity | null>(null);
  const [era, setEra] = useState<EraId | null>(null);
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const backHandler = useKeplerBackHandler();
  const boot = useBootMode(services.tmdb, configured);
  const feed = useHomeFeed(
    services.tmdb,
    settings.region,
    settings.providerIds,
    configured,
  );
  const providerList = useProviders(services.tmdb, settings.region, configured);

  const push = useCallback((route: Route) => {
    setStack((current) => pushRoute(current, route));
  }, []);

  const goBack = useCallback((): boolean => {
    const next = popRoute(stackRef.current);
    if (!next) {
      return false;
    }
    setStack(next);
    return true;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadSettings(), loadWatchlist()]).then(
      ([storedSettings, storedWatchlist]) => {
        if (cancelled) {
          return;
        }
        setSettings(storedSettings);
        setWatchlist(storedWatchlist);
        setHydrated(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * First run: preselect the most prominent India providers so the "On my
   * services" row is useful immediately. Derived from TMDB, not hardcoded.
   */
  useEffect(() => {
    if (
      !hydrated ||
      settings.initialized ||
      providerList.status !== 'ready' ||
      providerList.providers.length === 0
    ) {
      return;
    }
    const next: Settings = {
      ...settings,
      providerIds: pickDefaultProviderIds(providerList.providers),
      initialized: true,
    };
    setSettings(next);
    void saveSettings(next);
  }, [
    hydrated,
    providerList.providers,
    providerList.status,
    settings,
  ]);

  useEffect(() => {
    const subscription = backHandler?.addEventListener?.('backPress', () => {
      if (stackRef.current.length > 1) {
        setStack(stackRef.current.slice(0, -1));
        return true;
      }
      backHandler.exitApp();
      return true;
    });
    return () => subscription?.remove?.();
  }, [backHandler]);

  // --- v1 flow (unchanged behaviour, now driven by the route stack) ----------

  const runRecommendations = useCallback(
    (nextFilters?: Partial<RecommendationFilters>) => {
      if (!mood) {
        return null;
      }
      const filters: RecommendationFilters = {
        mood,
        genre,
        maxRuntimeMinutes,
        maxIntensity,
        era,
        ...nextFilters,
      };
      const next = recommend(filters);
      setResult(next);
      setSelectedIndex(0);
      return next;
    },
    [era, genre, maxIntensity, maxRuntimeMinutes, mood],
  );

  const handleSubmit = useCallback(() => {
    const next = runRecommendations();
    if (next) {
      push({name: 'results'});
    }
  }, [push, runRecommendations]);

  const handleBroaden = useCallback(() => {
    setGenre(null);
    setMaxRuntimeMinutes(null);
    setMaxIntensity(null);
    setEra(null);
    runRecommendations({
      genre: null,
      maxRuntimeMinutes: null,
      maxIntensity: null,
      era: null,
    });
  }, [runRecommendations]);

  const handleSelectResult = useCallback(
    (index: number) => {
      setSelectedIndex(index);
      const entry = result?.results[index];
      if (entry) {
        push({name: 'detail', titleId: entry.title.id});
      }
    },
    [push, result],
  );

  const handleReset = useCallback(() => {
    setMood(null);
    setGenre(null);
    setMaxRuntimeMinutes(null);
    setMaxIntensity(null);
    setEra(null);
    setResult(null);
    setSelectedIndex(0);
  }, []);

  const handleSelectCollection = useCallback(
    (collection: CuratedCollection) => {
      const {filters} = collection;
      setMood(filters.mood);
      setGenre(filters.genre);
      setMaxRuntimeMinutes(filters.maxRuntimeMinutes);
      setMaxIntensity(filters.maxIntensity);
      setEra(filters.era);
      setResult(recommend(filters));
      setSelectedIndex(0);
      push({name: 'results'});
    },
    [push],
  );

  const handleShowRelated = useCallback(
    (titleId: string) => {
      const title = TITLE_BY_ID[titleId];
      if (!title) {
        return;
      }
      const filters: RecommendationFilters = {
        mood: title.moods[0],
        genre: null,
        maxRuntimeMinutes: null,
        maxIntensity: null,
        era: null,
      };
      const next = recommend(filters);
      const index = next.results.findIndex(
        (entry) => entry.title.id === titleId,
      );
      setMood(filters.mood);
      setGenre(null);
      setMaxRuntimeMinutes(null);
      setMaxIntensity(null);
      setEra(null);
      setResult(next);
      setSelectedIndex(index >= 0 ? index : 0);
      push({name: 'detail', titleId});
    },
    [push],
  );

  // --- v2 handlers -----------------------------------------------------------

  const handleToggleWatchlist = useCallback(
    (movie: MovieSummary) => {
      setWatchlist((current) => {
        const next = toggleWatchlist(current, movie);
        void saveWatchlist(next);
        return next;
      });
    },
    [],
  );

  const handleSearchSubmit = useCallback(
    async (query: string) => {
      setSearch({status: 'loading', query});
      try {
        const outcome = await runSearch(query, settings.region, {
          client: services.tmdb,
          index: getEmbeddingIndex(),
          embed: services.embed,
        });
        setSearch({status: 'results', query, ...outcome});
      } catch (cause) {
        setSearch({
          status: 'error',
          query,
          message:
            cause instanceof Error
              ? cause.message
              : 'Search failed. Try a different phrase.',
        });
      }
    },
    [services, settings.region],
  );

  const handleToggleProvider = useCallback((providerId: number) => {
    setSettings((current) => {
      const next = toggleProvider(current, providerId);
      void saveSettings(next);
      return next;
    });
  }, []);

  const handleRetryLive = useCallback(() => {
    void boot.retry();
    feed.refresh();
    providerList.retry();
  }, [boot, feed, providerList]);

  const route = stack[stack.length - 1];

  const v1Detail = useMemo(() => {
    if (route.name !== 'detail' || !result) {
      return null;
    }
    return (
      result.results.find((entry) => entry.title.id === route.titleId) ??
      result.results[selectedIndex] ??
      null
    );
  }, [result, route, selectedIndex]);

  const renderRoute = () => {
    switch (route.name) {
      case 'live-home':
        return (
          <LiveHomeScreen
            mode={boot.mode}
            trending={feed.trending}
            onServices={feed.onServices}
            watchlist={watchlist}
            providerCount={settings.providerIds.length}
            refreshing={feed.refreshing}
            initialFocus={homeFocus}
            onSelectMovie={(movie) =>
              push({name: 'movie', movieId: movie.id, seed: movie})
            }
            onSearch={() => push({name: 'search'})}
            onSettings={() => push({name: 'settings'})}
            onBrowseVibe={() => push({name: 'vibe'})}
            onSelectCollection={handleSelectCollection}
            onRetry={handleRetryLive}
            onFocusItem={setHomeFocus}
          />
        );

      case 'search':
        return (
          <SearchScreen
            state={search}
            onSubmit={handleSearchSubmit}
            onSelect={(movie) =>
              push({name: 'movie', movieId: movie.id, seed: movie})
            }
            onBack={goBack}
          />
        );

      case 'settings':
        return (
          <SettingsScreen
            settings={settings}
            providers={providerList.providers}
            status={providerList.status}
            error={providerList.error}
            onToggleProvider={handleToggleProvider}
            onRetry={providerList.retry}
            onBack={goBack}
          />
        );

      case 'movie':
        return (
          <MovieDetailScreen
            movieId={route.movieId}
            seed={route.seed}
            client={services.tmdb}
            region={settings.region}
            selectedProviderIds={settings.providerIds}
            inWatchlist={watchlist.some((entry) => entry.id === route.movieId)}
            onToggleWatchlist={handleToggleWatchlist}
            onOpenMovie={(movie) =>
              push({name: 'movie', movieId: movie.id, seed: movie})
            }
            onBack={goBack}
          />
        );

      case 'vibe':
        return (
          <HomeScreen
            selectedMood={mood}
            onSelectMood={setMood}
            onSelectCollection={handleSelectCollection}
            onContinue={() => {
              if (mood) {
                push({name: 'refine'});
              }
            }}
            onReset={handleReset}
          />
        );

      case 'refine':
        if (!mood) {
          return null;
        }
        return (
          <RefineScreen
            mood={mood}
            genre={genre}
            maxRuntimeMinutes={maxRuntimeMinutes}
            maxIntensity={maxIntensity}
            era={era}
            onSelectGenre={setGenre}
            onSelectRuntime={setMaxRuntimeMinutes}
            onSelectIntensity={setMaxIntensity}
            onSelectEra={setEra}
            onSubmit={handleSubmit}
            onBack={goBack}
          />
        );

      case 'results':
        if (!result) {
          return null;
        }
        return (
          <ResultsScreen
            result={result}
            genreLabel={genre ? GENRE_LABELS[genre] : null}
            maxRuntimeMinutes={maxRuntimeMinutes}
            maxIntensity={maxIntensity}
            eraLabel={era ? ERA_LABELS[era] : null}
            initialFocusIndex={selectedIndex}
            onSelect={handleSelectResult}
            onBack={goBack}
            onBroaden={handleBroaden}
          />
        );

      case 'detail':
        if (!v1Detail) {
          return null;
        }
        return (
          <DetailScreen
            recommendation={v1Detail}
            onShowRelated={handleShowRelated}
            onBack={goBack}
          />
        );

      default:
        return null;
    }
  };

  return <View style={styles.app}>{renderRoute()}</View>;
};

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
});

export default App;
