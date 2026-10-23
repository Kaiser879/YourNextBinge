import React, {useEffect, useRef, useState} from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {FocusTile} from '../components/FocusTile';
import {ScreenHeader} from '../components/ScreenHeader';
import {focusNode} from '../services/focus';
import {wireFocusGrid} from '../services/focusMap';
import {colors, layout, radius, spacing, type} from '../theme';
import {MovieSummary, SearchState} from '../types.live';

interface SearchScreenProps {
  state: SearchState;
  onSubmit: (query: string) => void;
  onSelect: (movie: MovieSummary) => void;
  onBack: () => void;
}

const SUGGESTIONS = [
  'cosy sci-fi',
  'funny heist',
  'sad but hopeful space movie',
];

function modeCaption(state: Extract<SearchState, {status: 'results'}>): string {
  if (state.mode === 'semantic') {
    return `Smart search  •  ${state.items.length} matches  •  ${state.tookMs} ms`;
  }
  if (state.mode === 'keyword') {
    return 'Keyword matches — smart search is unavailable. These titles are still watchable in India.';
  }
  return 'Offline — title matches only. Start the embedding server for smarter results.';
}

export const SearchScreen = ({
  state,
  onSubmit,
  onSelect,
  onBack,
}: SearchScreenProps) => {
  const [query, setQuery] = useState(
    state.status === 'results' || state.status === 'loading' ? state.query : '',
  );
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const suggestionRefs = useRef<any[]>([]);
  const resultRefs = useRef<any[]>([]);
  const backRef = useRef<any>(null);
  const lastSubmitted = useRef(
    state.status === 'results' || state.status === 'loading'
      ? state.query.trim()
      : '',
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      wireFocusGrid([suggestionRefs.current, resultRefs.current, [backRef.current]]);
      // Returning from a title with results already on screen should not pull
      // focus (and the keyboard) back into the input.
      if (state.status !== 'results') {
        inputRef.current?.focus();
      }
    }, 300);
    return () => clearTimeout(timer);
    // Run once per mount; state at mount decides whether to open the keyboard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.status === 'results' && state.items.length > 0) {
      const timer = setTimeout(() => {
        focusNode(resultRefs.current[0]);
      }, 120);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [state]);

  const submit = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return;
    }
    lastSubmitted.current = trimmed;
    Keyboard.dismiss();
    onSubmit(trimmed);
  };

  /**
   * TV keyboards make an explicit Submit trip awkward: the D-pad is captured
   * by the TextInput, and the keyboard's enter key does not always reach
   * `onSubmitEditing`. Search after a short pause, and dismiss the keyboard so
   * focus can move to the results. The button and suggestion chips still
   * submit immediately.
   */
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3 || trimmed === lastSubmitted.current) {
      return undefined;
    }
    const timer = setTimeout(() => submit(trimmed), 900);
    return () => clearTimeout(timer);
    // submit is intentionally read from the render that owns this query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const results = state.status === 'results' ? state.items : [];
  const loading = state.status === 'loading';

  return (
    <View style={styles.screen}>
      <ScreenHeader
        eyebrow="SEARCH  •  INDIA"
        title="Describe what you want"
        subtitle="Plain language works: mood, tone, setting, era. Results are scoped to what you can watch in India."
      />

      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          testID="search-input"
          value={query}
          onChangeText={(value) => {
            setQuery(value);
          }}
          onSubmitEditing={() => submit(query)}
          autoFocus={state.status !== 'results'}
          placeholder="e.g. cosy sci-fi, funny heist, sad but hopeful space movie"
          placeholderTextColor={colors.textFaint}
          style={[styles.input, inputFocused && styles.inputFocused]}
          onFocus={() => {
            setInputFocused(true);
          }}
          onBlur={() => setInputFocused(false)}
          returnKeyType="search"
          accessibilityLabel="Search for something to watch"
        />
        <FocusTile
          testID="search-submit"
          label={loading ? 'Searching…' : 'Search'}
          size="chip"
          tone="accent"
          width={130}
          disabled={loading || query.trim().length === 0}
          onPress={() => submit(query)}
        />
      </View>

      <View style={styles.suggestions}>
        <Text style={styles.suggestionLabel}>TRY</Text>
        {SUGGESTIONS.map((suggestion, index) => (
          <FocusTile
            key={suggestion}
            testID={`search-suggestion-${index}`}
            label={suggestion}
            size="chip"
            width={210}
            onPress={() => {
              setQuery(suggestion);
              submit(suggestion);
            }}
            tileRef={(node: any) => {
              suggestionRefs.current[index] = node;
            }}
          />
        ))}
      </View>

      {state.status === 'results' ? (
        <Text style={styles.caption}>{modeCaption(state)}</Text>
      ) : null}
      {loading ? (
        <Text style={styles.caption}>{`Searching for “${state.query}”…`}</Text>
      ) : null}
      {state.status === 'error' ? (
        <Text style={[styles.caption, styles.error]}>
          {state.message || 'Search failed. Try again.'}
        </Text>
      ) : null}

      <ScrollView
        style={styles.results}
        contentContainerStyle={styles.resultsContent}
        showsVerticalScrollIndicator={false}>
        {state.status === 'results' && results.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No watchable matches</Text>
            <Text style={styles.emptyCopy}>
              Try a broader phrase — for example "space movie" or "funny
              thriller". We only show titles with an India availability option.
            </Text>
          </View>
        ) : null}

        {results.map((movie, index) => (
          <FocusTile
            key={movie.id}
            testID={`search-result-${index}`}
            label={movie.title}
            hint={[
              movie.year,
              movie.rating != null ? `${movie.rating}/10` : null,
              movie.providerLabel,
            ]
              .filter(Boolean)
              .join('  •  ')}
            width={layout.contentMax}
            onPress={() => onSelect(movie)}
            tileRef={(node: any) => {
              resultRefs.current[index] = node;
            }}
          />
        ))}

        <View style={styles.actions}>
          <FocusTile
            testID="search-back"
            label="Back to home"
            size="chip"
            width={160}
            onPress={onBack}
            tileRef={(node: any) => {
              backRef.current = node;
            }}
          />
          <Text style={styles.hint}>
            Select a result for availability and My List
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: layout.screenX,
    paddingTop: layout.screenTop,
    paddingBottom: layout.screenBottom,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  input: {
    flex: 1,
    maxWidth: layout.contentMax - 142,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: type.body,
    paddingHorizontal: spacing.md,
  },
  inputFocused: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceFocused,
  },
  suggestions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  suggestionLabel: {
    color: colors.textFaint,
    fontSize: type.micro,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  caption: {
    color: colors.textMuted,
    fontSize: type.meta,
    marginTop: spacing.md,
  },
  error: {
    color: colors.danger,
  },
  results: {
    flex: 1,
    marginTop: spacing.sm,
    width: layout.contentMax,
  },
  resultsContent: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  hint: {
    color: colors.textFaint,
    fontSize: type.meta,
  },
  empty: {
    paddingVertical: spacing.lg,
    maxWidth: 720,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: type.card,
    fontWeight: '700',
  },
  emptyCopy: {
    color: colors.textMuted,
    fontSize: type.body,
    lineHeight: 23,
    marginTop: spacing.sm,
  },
});
