import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {FocusTile} from '../components/FocusTile';
import {MediaRow, RowStatus} from '../components/MediaRow';
import {ScreenHeader} from '../components/ScreenHeader';
import {focusFirst, wireFocusGrid} from '../services/focusMap';
import {focusNode} from '../services/focus';
import {RowState} from '../hooks/useHomeFeed';
import {BootMode} from '../hooks/useBootMode';
import {colors, layout, radius, spacing, type} from '../theme';
import {CuratedCollection} from '../types';
import {MovieSummary, WatchlistEntry} from '../types.live';
import {CURATED_COLLECTIONS} from '../data/catalog';

export interface HomeFocus {
  row: number;
  item: number;
}

interface LiveHomeScreenProps {
  mode: BootMode;
  trending: RowState;
  onServices: RowState;
  watchlist: WatchlistEntry[];
  providerCount: number;
  refreshing: boolean;
  initialFocus?: HomeFocus;
  onSelectMovie: (movie: MovieSummary) => void;
  onSearch: () => void;
  onSettings: () => void;
  onBrowseVibe: () => void;
  onSelectCollection: (collection: CuratedCollection) => void;
  onRetry: () => void;
  onFocusItem?: (focus: HomeFocus) => void;
}

function watchlistToSummary(entry: WatchlistEntry): MovieSummary {
  return {
    id: entry.id,
    title: entry.title,
    year: entry.year,
    rating: entry.rating,
    voteCount: 0,
    overview: '',
    posterUrl: entry.posterUrl,
    backdropUrl: null,
    genreIds: [],
    providerLabel: entry.providerName,
    availability: [],
  };
}

function statusOf(row: RowState): RowStatus {
  if (row.status === 'loading') {
    return 'loading';
  }
  return row.status === 'error' ? 'error' : 'ready';
}

/**
 * Primary home: availability-scoped live rows, the persisted My List row, and
 * entry points to search and the v1 vibe flow.
 */
export const LiveHomeScreen = ({
  mode,
  trending,
  onServices,
  watchlist,
  providerCount,
  refreshing,
  initialFocus,
  onSelectMovie,
  onSearch,
  onSettings,
  onBrowseVibe,
  onSelectCollection,
  onRetry,
  onFocusItem,
}: LiveHomeScreenProps) => {
  const [rowNodes, setRowNodes] = useState<Record<number, any[]>>({});
  const entryRefs = useRef<any[]>([]);
  const shortcutRefs = useRef<any[]>([]);
  const didInitialFocus = useRef(false);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNodes = useCallback((rowIndex: number, nodes: any[]) => {
    setRowNodes((current) => {
      const next = {...current, [rowIndex]: nodes};
      const same =
        (current[rowIndex]?.length ?? -1) === nodes.length &&
        (current[rowIndex] ?? []).every((node, index) => node === nodes[index]);
      return same ? current : next;
    });
  }, []);

  const myListItems = watchlist.map(watchlistToSummary);
  const hasMyList = myListItems.length > 0;

  useEffect(() => {
    const timer = setTimeout(() => {
      const rows = [
        rowNodes[0],
        rowNodes[1],
        hasMyList ? rowNodes[2] : [],
        entryRefs.current,
        shortcutRefs.current,
      ];
      wireFocusGrid(rows);

      if (didInitialFocus.current) {
        return;
      }

      // Wait for posters rather than parking focus on the Search tile while
      // the first network response is still in flight.
      const contentRows = [
        rows[0] ?? [],
        rows[1] ?? [],
        hasMyList ? rows[2] ?? [] : [],
      ];
      const preferred =
        rows[initialFocus?.row ?? 0]?.[initialFocus?.item ?? 0] ??
        contentRows.flat().find(Boolean);

      if (preferred) {
        focusNode(preferred);
        didInitialFocus.current = true;
        return;
      }

      if (!fallbackTimer.current) {
        fallbackTimer.current = setTimeout(() => {
          if (!didInitialFocus.current) {
            focusFirst([entryRefs.current, shortcutRefs.current]);
            didInitialFocus.current = true;
          }
        }, 4000);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      if (fallbackTimer.current) {
        clearTimeout(fallbackTimer.current);
        fallbackTimer.current = null;
      }
    };
  }, [hasMyList, initialFocus, rowNodes]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <ScreenHeader
          eyebrow="YOUR NEXT BINGE  •  INDIA"
          title="What can you watch tonight?"
          subtitle="Only titles with an India streaming, rent, or buy option."
        />
        <View style={styles.statusChips}>
          <View style={[styles.statusChip, mode === 'offline' && styles.offlineChip]}>
            <Text style={styles.statusText}>
              {mode === 'checking'
                ? 'CHECKING…'
                : mode === 'live'
                ? 'LIVE'
                : 'OFFLINE'}
            </Text>
          </View>
          <View style={styles.statusChip}>
            <Text style={styles.statusText}>
              {providerCount === 0
                ? 'NO SERVICES SELECTED'
                : `${providerCount} SERVICE${providerCount === 1 ? '' : 'S'}`}
            </Text>
          </View>
        </View>
      </View>

      {mode === 'offline' ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Offline — curated picks. Live rows may show saved data, and the vibe
            flow still works.
          </Text>
          <FocusTile
            label="Retry live"
            size="chip"
            width={130}
            onPress={onRetry}
            testID="home-retry-live"
          />
        </View>
      ) : null}

      <MediaRow
        rowIndex={0}
        title="Trending in India"
        subtitle={refreshing ? 'refreshing…' : 'popular and watchable here'}
        items={trending.items}
        status={statusOf(trending)}
        error={trending.error}
        onSelect={onSelectMovie}
        onRetry={onRetry}
        onNodes={handleNodes}
        onFocusItem={(row, item) => onFocusItem?.({row, item})}
        testID="row-trending"
      />

      <MediaRow
        rowIndex={1}
        title="On my services"
        subtitle={
          providerCount > 0 ? `${providerCount} selected` : 'pick your services'
        }
        items={onServices.items}
        status={statusOf(onServices)}
        error={onServices.error}
        emptyMessage="Choose the services you pay for in Settings. We only show what you can press play on."
        onSelect={onSelectMovie}
        onRetry={onRetry}
        onNodes={handleNodes}
        onFocusItem={(row, item) => onFocusItem?.({row, item})}
        testID="row-services"
      />

      {hasMyList ? (
        <MediaRow
          rowIndex={2}
          title="My List"
          subtitle="saved on this device"
          items={myListItems}
          status="ready"
          onSelect={onSelectMovie}
          onNodes={handleNodes}
          onFocusItem={(row, item) => onFocusItem?.({row, item})}
          testID="row-my-list"
        />
      ) : null}

      <View style={styles.entryRow}>
        <FocusTile
          testID="home-search"
          label="Describe what you want"
          hint="cosy sci-fi • funny heist • sad but hopeful"
          size="chip"
          tone="accent"
          width={300}
          onPress={onSearch}
          tileRef={(node: any) => {
            entryRefs.current[0] = node;
          }}
        />
        <FocusTile
          testID="home-settings"
          label="Settings"
          hint="Pick your India services"
          size="chip"
          width={200}
          onPress={onSettings}
          tileRef={(node: any) => {
            entryRefs.current[1] = node;
          }}
        />
        <FocusTile
          testID="home-vibe"
          label="Browse by vibe"
          hint="The original mood picker"
          size="chip"
          width={200}
          onPress={onBrowseVibe}
          tileRef={(node: any) => {
            entryRefs.current[2] = node;
          }}
        />
      </View>

      <View style={styles.shortcuts}>
        <Text style={styles.sectionLabel}>CURATOR'S SHORTCUTS</Text>
        <View style={styles.shortcutRow}>
          {CURATED_COLLECTIONS.map((collection, index) => (
            <FocusTile
              key={collection.id}
              testID={`home-collection-${collection.id}`}
              label={collection.name}
              hint={collection.blurb}
              size="chip"
              width={210}
              onPress={() => onSelectCollection(collection)}
              tileRef={(node: any) => {
                shortcutRefs.current[index] = node;
              }}
            />
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          This product uses the TMDB API but is not endorsed or certified by
          TMDB. Availability data via TMDB.
        </Text>
        <Text style={styles.footerText}>
          D-pad to browse • Select to open • Back exits
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: layout.screenX,
    paddingTop: layout.screenTop,
    paddingBottom: layout.screenBottom,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  statusChips: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  statusChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  offlineChip: {
    borderColor: colors.accent,
  },
  statusText: {
    color: colors.textMuted,
    fontSize: type.micro,
    fontWeight: '700',
    letterSpacing: 1,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.accentFaint,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bannerText: {
    color: colors.text,
    fontSize: type.meta + 1,
    flexShrink: 1,
  },
  entryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg + 4,
  },
  shortcuts: {
    marginTop: spacing.lg,
  },
  sectionLabel: {
    color: colors.textFaint,
    fontSize: type.meta,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  shortcutRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.lg,
    marginTop: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: {
    color: colors.textFaint,
    fontSize: type.micro + 1,
    maxWidth: 520,
  },
});
