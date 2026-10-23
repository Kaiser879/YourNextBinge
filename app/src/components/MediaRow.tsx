import React, {useEffect, useRef} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {FocusTile} from './FocusTile';
import {POSTER_WIDTH, PosterCard} from './PosterCard';
import {colors, spacing, type} from '../theme';
import {MovieSummary} from '../types.live';

export type RowStatus = 'loading' | 'ready' | 'error';

interface MediaRowProps {
  rowIndex: number;
  title: string;
  subtitle?: string;
  items: MovieSummary[];
  status: RowStatus;
  error?: string | null;
  emptyMessage?: string;
  onSelect: (movie: MovieSummary) => void;
  onRetry?: () => void;
  onNodes: (rowIndex: number, nodes: any[]) => void;
  onFocusItem?: (rowIndex: number, itemIndex: number) => void;
  testID?: string;
}

const CARD_GAP = spacing.sm + 2;

const SKELETON_KEYS = ['a', 'b', 'c', 'd', 'e'];

/**
 * One horizontal poster row.
 *
 * The row reports its focusable nodes to the screen, which wires the entire
 * grid's directions (left/right here, up/down across rows). Scroll position
 * follows focus so a card is never clipped when moving right.
 */
export const MediaRow = ({
  rowIndex,
  title,
  subtitle,
  items,
  status,
  error,
  emptyMessage,
  onSelect,
  onRetry,
  onNodes,
  onFocusItem,
  testID,
}: MediaRowProps) => {
  const scrollRef = useRef<ScrollView>(null);
  const nodeRefs = useRef<any[]>([]);
  // Kept in a ref so an inline parent callback cannot re-trigger this effect
  // (and therefore cannot loop state updates).
  const onNodesRef = useRef(onNodes);
  onNodesRef.current = onNodes;

  useEffect(() => {
    if (status === 'ready') {
      onNodesRef.current(rowIndex, nodeRefs.current.slice(0, items.length));
    } else if (status === 'error') {
      onNodesRef.current(rowIndex, [nodeRefs.current[0]].filter(Boolean));
    } else {
      onNodesRef.current(rowIndex, []);
    }
  }, [items.length, rowIndex, status]);

  const handleFocus = (itemIndex: number) => {
    onFocusItem?.(rowIndex, itemIndex);
    scrollRef.current?.scrollTo({
      x: Math.max(0, itemIndex * (POSTER_WIDTH + CARD_GAP) - POSTER_WIDTH),
      animated: false,
    });
  };

  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      {status === 'loading' ? (
        <View style={styles.skeletons}>
          {SKELETON_KEYS.map((key) => (
            <View key={key} style={styles.skeleton}>
              <View style={styles.skeletonPoster} />
              <View style={styles.skeletonLine} />
            </View>
          ))}
        </View>
      ) : null}

      {status === 'error' ? (
        <View style={styles.stateRow}>
          <FocusTile
            label="Retry"
            size="chip"
            tone="accent"
            width={120}
            onPress={() => onRetry?.()}
            tileRef={(node: any) => {
              nodeRefs.current[0] = node;
            }}
            testID={`row-retry-${rowIndex}`}
          />
          <Text style={styles.stateText}>
            {error ?? 'Could not load this row.'}
          </Text>
        </View>
      ) : null}

      {status === 'ready' && items.length === 0 ? (
        <Text style={styles.stateText}>
          {emptyMessage ?? 'Nothing here right now.'}
        </Text>
      ) : null}

      {status === 'ready' && items.length > 0 ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cards}>
          {items.map((movie, index) => (
            <PosterCard
              key={movie.id}
              testID={`poster-${rowIndex}-${index}`}
              movie={movie}
              onPress={() => onSelect(movie)}
              onFocus={() => handleFocus(index)}
              cardRef={(node: any) => {
                nodeRefs.current[index] = node;
              }}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    marginTop: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: type.card - 2,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textFaint,
    fontSize: type.meta,
    marginLeft: spacing.sm,
  },
  cards: {
    gap: CARD_GAP,
    paddingBottom: spacing.xs,
  },
  skeletons: {
    flexDirection: 'row',
    gap: CARD_GAP,
  },
  skeleton: {
    width: POSTER_WIDTH,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingBottom: spacing.sm,
    overflow: 'hidden',
  },
  skeletonPoster: {
    height: 210,
    backgroundColor: colors.backgroundElevated,
  },
  skeletonLine: {
    height: 10,
    marginHorizontal: spacing.sm,
    marginTop: spacing.sm,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stateText: {
    color: colors.textMuted,
    fontSize: type.meta + 1,
    maxWidth: 640,
  },
});
