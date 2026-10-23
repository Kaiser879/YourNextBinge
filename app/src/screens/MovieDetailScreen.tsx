import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Image, ScrollView, StyleSheet, Text, View} from 'react-native';
import {AvailabilityChips} from '../components/AvailabilityChips';
import {FocusTile} from '../components/FocusTile';
import {MediaRow} from '../components/MediaRow';
import {ProviderBadge} from '../components/ProviderBadge';
import {ScreenHeader} from '../components/ScreenHeader';
import {useInitialFocus} from '../hooks/useInitialFocus';
import {useMovieDetail} from '../hooks/useMovieDetail';
import {getEmbeddingIndex} from '../services/embeddings';
import {wireFocusGrid} from '../services/focusMap';
import {getRelatedMovies} from '../services/related';
import {TmdbClient} from '../services/tmdb';
import {colors, layout, radius, spacing, type} from '../theme';
import {Movie, MovieSummary} from '../types.live';

interface MovieDetailScreenProps {
  movieId: number;
  seed?: MovieSummary;
  client: TmdbClient;
  region: string;
  selectedProviderIds: number[];
  inWatchlist: boolean;
  onToggleWatchlist: (movie: Movie | MovieSummary) => void;
  onOpenMovie: (movie: MovieSummary) => void;
  onBack: () => void;
}

function metaLine(movie: Movie | MovieSummary): string {
  const parts: string[] = [];
  if (movie.year) {
    parts.push(String(movie.year));
  }
  if ('runtime' in movie && movie.runtime != null) {
    parts.push(`${movie.runtime} min`);
  }
  if ('genres' in movie && movie.genres.length > 0) {
    parts.push(movie.genres.join(', '));
  }
  if (movie.rating != null) {
    parts.push(`${movie.rating}/10`);
  }
  return parts.join('  •  ');
}

export const MovieDetailScreen = ({
  movieId,
  seed,
  client,
  region,
  selectedProviderIds,
  inWatchlist,
  onToggleWatchlist,
  onOpenMovie,
  onBack,
}: MovieDetailScreenProps) => {
  const {movie: detail, status, error, retry} = useMovieDetail(
    client,
    movieId,
    region,
  );
  const [related, setRelated] = useState<MovieSummary[]>([]);
  const [relatedNodes, setRelatedNodes] = useState<any[]>([]);
  const actionRefs = useRef<any[]>([]);
  const watchlistRef = useInitialFocus();

  const display: Movie | MovieSummary | null = detail ?? seed ?? null;
  const backdrop = detail?.backdropUrl ?? seed?.backdropUrl ?? null;

  useEffect(() => {
    let cancelled = false;
    if (!detail) {
      setRelated([]);
      return;
    }
    void getRelatedMovies({
      movieId: detail.id,
      region,
      client,
      index: getEmbeddingIndex(),
      limit: 8,
    }).then((items) => {
      if (!cancelled) {
        setRelated(items);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [client, detail, region]);

  const handleRelatedNodes = useCallback((_row: number, nodes: any[]) => {
    setRelatedNodes((current) => {
      if (
        current.length === nodes.length &&
        current.every((node, index) => node === nodes[index])
      ) {
        return current;
      }
      return nodes;
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      wireFocusGrid([actionRefs.current, relatedNodes]);
    }, 300);
    return () => clearTimeout(timer);
  }, [relatedNodes, status]);

  if (!display) {
    return (
      <View style={styles.screen}>
        <Text style={styles.stateTitle}>Title unavailable</Text>
        <Text style={styles.stateCopy}>
          We could not load this title. Back returns to the row you came from.
        </Text>
        <FocusTile
          label="Back"
          size="chip"
          tone="accent"
          width={120}
          onPress={onBack}
          testID="movie-back"
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        eyebrow="TITLE DETAILS"
        title={display.title}
        subtitle={metaLine(display)}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {backdrop ? (
          <Image
            source={{uri: backdrop}}
            style={styles.backdrop}
            resizeMode="cover"
          />
        ) : null}

        <View style={styles.badgeRow}>
          <ProviderBadge label={display.providerLabel} />
          {display.rating != null ? (
            <Text style={styles.rating}>{display.rating}/10</Text>
          ) : null}
        </View>

        <Text style={styles.sectionLabel}>WHERE TO WATCH IN INDIA</Text>
        <AvailabilityChips
          availability={detail?.availability ?? []}
          selectedProviderIds={selectedProviderIds}
          loading={status === 'loading'}
        />
        {status === 'error' ? (
          <Text style={styles.errorText}>
            {error ?? 'Availability could not be loaded.'}
          </Text>
        ) : null}

        <Text style={styles.sectionLabel}>OVERVIEW</Text>
        <Text style={styles.overview}>
          {display.overview || 'No synopsis is available for this title yet.'}
        </Text>

        <View style={styles.actions}>
          <FocusTile
            testID="movie-back"
            label="Back"
            size="chip"
            width={110}
            onPress={onBack}
            tileRef={(node: any) => {
              actionRefs.current[0] = node;
            }}
          />
          <FocusTile
            testID="movie-watchlist"
            label={inWatchlist ? '✓ In My List' : '+ My List'}
            size="chip"
            tone={inWatchlist ? 'accent' : 'default'}
            width={190}
            onPress={() => onToggleWatchlist(display)}
            tileRef={(node: any) => {
              actionRefs.current[1] = node;
              (watchlistRef as React.MutableRefObject<any>).current = node;
            }}
            hasTVPreferredFocus
          />
          {status === 'error' ? (
            <FocusTile
              testID="movie-retry"
              label="Retry"
              size="chip"
              width={110}
              onPress={retry}
              tileRef={(node: any) => {
                actionRefs.current[2] = node;
              }}
            />
          ) : null}
        </View>

        <MediaRow
          rowIndex={0}
          title="More like this"
          subtitle="also watchable in India"
          items={related}
          status={status === 'loading' ? 'loading' : 'ready'}
          emptyMessage="No related titles yet."
          onSelect={onOpenMovie}
          onNodes={handleRelatedNodes}
          testID="row-related"
        />

        <Text style={styles.disclaimer}>
          Availability comes from TMDB / JustWatch and can change. This app
          helps you choose what to watch; it does not open other streaming apps.
        </Text>
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
  scroll: {
    flex: 1,
    marginTop: spacing.md,
    width: layout.contentMax,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  backdrop: {
    width: layout.contentMax,
    height: 180,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundElevated,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  rating: {
    color: colors.accent,
    fontSize: type.meta,
    fontWeight: '700',
  },
  sectionLabel: {
    color: colors.textFaint,
    fontSize: type.meta,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: spacing.lg,
  },
  overview: {
    color: '#dbe4ec',
    fontSize: type.body,
    lineHeight: 23,
    marginTop: spacing.sm,
    maxWidth: 820,
  },
  errorText: {
    color: colors.danger,
    fontSize: type.meta,
    marginTop: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  disclaimer: {
    color: colors.textFaint,
    fontSize: type.meta,
    marginTop: spacing.lg,
  },
  stateTitle: {
    color: colors.text,
    fontSize: type.title,
    fontWeight: '700',
    marginTop: spacing.xxl,
  },
  stateCopy: {
    color: colors.textMuted,
    fontSize: type.body,
    marginVertical: spacing.md,
  },
});
