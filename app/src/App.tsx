import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {useKeplerBackHandler} from '@amazon-devices/react-native-kepler';
import {HomeScreen} from './screens/HomeScreen';
import {RefineScreen} from './screens/RefineScreen';
import {ResultsScreen} from './screens/ResultsScreen';
import {DetailScreen} from './screens/DetailScreen';
import {recommend} from './services/recommender';
import {GENRE_LABELS, TITLE_BY_ID} from './data/catalog';
import {colors} from './theme';
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

type ScreenName = 'home' | 'refine' | 'results' | 'detail';

export const App = () => {
  const [screen, setScreen] = useState<ScreenName>('home');
  const [mood, setMood] = useState<MoodId | null>(null);
  const [genre, setGenre] = useState<GenreId | null>(null);
  const [maxRuntimeMinutes, setMaxRuntimeMinutes] = useState<number | null>(null);
  const [maxIntensity, setMaxIntensity] = useState<Intensity | null>(null);
  const [era, setEra] = useState<EraId | null>(null);
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const backHandler = useKeplerBackHandler();

  const goBack = useCallback(() => {
    setScreen((current) => {
      if (current === 'detail') {
        return 'results';
      }
      if (current === 'results') {
        return 'refine';
      }
      return 'home';
    });
  }, []);

  useEffect(() => {
    const subscription = backHandler?.addEventListener?.('backPress', () => {
      if (screen === 'home') {
        backHandler.exitApp();
        return true;
      }
      goBack();
      return true;
    });

    return () => subscription?.remove?.();
  }, [backHandler, goBack, screen]);

  const runRecommendations = useCallback(
    (nextFilters?: Partial<RecommendationFilters>) => {
      if (!mood) {
        return;
      }

      const filters: RecommendationFilters = {
        mood,
        genre,
        maxRuntimeMinutes,
        maxIntensity,
        era,
        ...nextFilters,
      };

      setResult(recommend(filters));
      setSelectedIndex(0);
      setScreen('results');
    },
    [era, genre, maxIntensity, maxRuntimeMinutes, mood],
  );

  const handleSubmit = useCallback(() => {
    runRecommendations();
  }, [runRecommendations]);

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

  const handleSelectResult = useCallback((index: number) => {
    setSelectedIndex(index);
    setScreen('detail');
  }, []);

  const handleReset = useCallback(() => {
    setMood(null);
    setGenre(null);
    setMaxRuntimeMinutes(null);
    setMaxIntensity(null);
    setEra(null);
    setResult(null);
    setSelectedIndex(0);
  }, []);

  /**
   * A curated collection tap applies the collection's preset filters in full
   * (overriding any half-tuned state), reruns recommendations, and jumps
   * straight to results. The mood is stored so Back/refine keeps context.
   */
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
      setScreen('results');
    },
    [],
  );

  /**
   * "You may also like" on the detail screen: open a related title directly.
   * Its mood becomes the new anchor; other filters reset so the shortlist
   * stays explainable. Back then returns to that new shortlist.
   */
  const handleShowRelated = useCallback((titleId: string) => {
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
    setScreen('detail');
  }, []);

  const selectedRecommendation = useMemo(
    () => result?.results[selectedIndex] ?? null,
    [result, selectedIndex],
  );

  return (
    <View style={styles.app}>
      {screen === 'home' && (
        <HomeScreen
          selectedMood={mood}
          onSelectMood={setMood}
          onSelectCollection={handleSelectCollection}
          onContinue={() => {
            if (mood) {
              setScreen('refine');
            }
          }}
          onReset={handleReset}
        />
      )}

      {screen === 'refine' && mood && (
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
      )}

      {screen === 'results' && result && (
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
      )}

      {screen === 'detail' && selectedRecommendation && (
        <DetailScreen
          recommendation={selectedRecommendation}
          onShowRelated={handleShowRelated}
          onBack={goBack}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
});

export default App;
