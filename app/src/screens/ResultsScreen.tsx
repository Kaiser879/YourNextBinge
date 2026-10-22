import React, {useEffect, useRef} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {FocusTile} from '../components/FocusTile';
import {RankCard} from '../components/RankCard';
import {ScreenHeader} from '../components/ScreenHeader';
import {focusNode, setNextFocus} from '../services/focus';
import {colors, layout, spacing, type} from '../theme';
import {Intensity, RecommendationResult} from '../types';

const CARD_GAP = 8;
const CARD_HEIGHT = 96;

interface ResultsScreenProps {
  result: RecommendationResult;
  genreLabel: string | null;
  maxRuntimeMinutes: number | null;
  maxIntensity: Intensity | null;
  eraLabel: string | null;
  initialFocusIndex: number;
  onSelect: (index: number) => void;
  onBack: () => void;
  onBroaden: () => void;
}

function filterSummary(
  genreLabel: string | null,
  maxRuntimeMinutes: number | null,
  maxIntensity: Intensity | null,
  eraLabel: string | null,
): string {
  const parts = [genreLabel ?? 'Any genre'];
  parts.push(
    maxRuntimeMinutes != null ? `Under ${maxRuntimeMinutes} min` : 'Any length',
  );
  if (maxIntensity != null) {
    parts.push(
      maxIntensity === 'low'
        ? 'Gentle'
        : maxIntensity === 'medium'
        ? 'Some edge'
        : 'Intense',
    );
  }
  parts.push(eraLabel ?? 'Any era');
  return parts.join('  •  ');
}

/** Human sentence for each constraint the recommender loosened. */
function relaxedExplanation(constraints: string[]): string {
  const names: Record<string, string> = {
    intensity: 'the intensity cap',
    genre: 'the genre filter',
    era: 'the era preference',
    runtime: 'the runtime cap',
    mood: 'the mood preference',
  };
  const list = constraints.map((c) => names[c] ?? c).join(', then ');
  return `Nothing matched every filter, so we widened the search past ${list}. These are the closest fits.`;
}

type Direction = 'up' | 'down' | 'left' | 'right';
type FocusMap = Record<number, Partial<Record<Direction, number>>>;

/**
 * Results use a TV grid: the top match spans the row, the rest sit in a
 * three-column grid. Three columns means 3-6 results always fit in two rows,
 * so there is no clipped card and no scroll position to lose.
 *
 * Focus is wired explicitly (top -> grid -> Back), matching the Home screen.
 */
export const ResultsScreen = ({
  result,
  genreLabel,
  maxRuntimeMinutes,
  maxIntensity,
  eraLabel,
  initialFocusIndex,
  onSelect,
  onBack,
  onBroaden,
}: ResultsScreenProps) => {
  const cardRefs = useRef<Array<any>>([]);
  const backRef = useRef<any>(null);
  const count = result.results.length;
  // Two columns reads better at 960 dp; fall back to three if a caller ever
  // requests the hard cap of six, so everything still fits in two rows.
  const columns = count > 5 ? 3 : 2;
  const cardWidth = Math.floor(
    (layout.contentMax - CARD_GAP * (columns - 1)) / columns,
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      const nodes = cardRefs.current;
      const backIndex = count;
      const map: FocusMap = {};

      if (count > 0) {
        map[0] = {down: count > 1 ? 1 : backIndex};
      }

      for (let i = 1; i < count; i += 1) {
        const position = i - 1;
        const row = Math.floor(position / columns);
        const column = position % columns;

        map[i] = {
          up: row === 0 ? 0 : i - columns,
          down: i + columns < count ? i + columns : backIndex,
          left: column > 0 ? i - 1 : undefined,
          right: column < columns - 1 && i + 1 < count ? i + 1 : undefined,
        };
      }

      map[backIndex] = {up: count > 0 ? count - 1 : undefined};

      Object.keys(map).forEach((rawIndex) => {
        const index = Number(rawIndex);
        const source = index === backIndex ? backRef.current : nodes[index];
        if (!source) {
          return;
        }
        (['up', 'down', 'left', 'right'] as const).forEach((direction) => {
          const target = map[index][direction];
          if (target == null) {
            return;
          }
          const targetNode =
            target === backIndex ? backRef.current : nodes[target];
          setNextFocus(source, targetNode, direction);
        });
      });

      const focusIndex =
        initialFocusIndex >= 0 && initialFocusIndex < count
          ? initialFocusIndex
          : 0;
      focusNode(count === 0 ? backRef.current : nodes[focusIndex]);
    }, 300);

    return () => clearTimeout(timer);
  }, [columns, count, initialFocusIndex]);

  const setCardRef = (index: number) => (node: any) => {
    cardRefs.current[index] = node;
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        eyebrow="RECOMMENDATIONS"
        title={result.wasRelaxed ? 'Closest matches' : 'Your shortlist'}
        subtitle={
          result.wasRelaxed
            ? 'Nothing matched exactly, so we widened the search.'
            : 'These fit what you asked for.'
        }
        step={3}
      />

      {result.wasRelaxed ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            {relaxedExplanation(result.relaxedConstraints)}
          </Text>
          <FocusTile
            testID="results-broaden"
            label="Broaden request"
            size="chip"
            width={180}
            onPress={onBroaden}
          />
        </View>
      ) : (
        <Text style={styles.filterLine}>
          {filterSummary(
            genreLabel,
            maxRuntimeMinutes,
            maxIntensity,
            eraLabel,
          )}
        </Text>
      )}

      <View style={styles.topWrap}>
        {result.results[0] ? (
          <RankCard
            testID="result-0"
            recommendation={result.results[0]}
            rank={1}
            isTop
            cardRef={setCardRef(0)}
            onPress={() => onSelect(0)}
          />
        ) : null}
      </View>

      <View style={styles.grid}>
        {result.results.slice(1).map((recommendation, offset) => {
          const index = offset + 1;
          return (
            <RankCard
              key={recommendation.title.id}
              testID={`result-${index}`}
              recommendation={recommendation}
              rank={index + 1}
              cardRef={setCardRef(index)}
              onPress={() => onSelect(index)}
              style={{width: cardWidth, height: CARD_HEIGHT}}
            />
          );
        })}
      </View>

      <View style={styles.footer}>
        <FocusTile
          testID="results-back"
          label="Back"
          size="chip"
          width={110}
          onPress={onBack}
          tileRef={backRef}
        />
        <Text style={styles.footerHint}>
          Select a title for details • Back returns to your filters
        </Text>
      </View>
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
  filterLine: {
    color: colors.textFaint,
    fontSize: type.meta,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginTop: spacing.sm,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accentSoft,
    borderRadius: 10,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm - 2,
    marginTop: spacing.sm,
    width: layout.contentMax,
  },
  bannerText: {
    color: colors.accent,
    fontSize: type.body - 1,
    fontWeight: '600',
    flexShrink: 1,
    marginRight: spacing.md,
  },
  topWrap: {
    marginTop: spacing.sm,
    width: layout.contentMax,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
    marginTop: CARD_GAP,
    width: layout.contentMax,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerHint: {
    color: colors.textFaint,
    fontSize: type.meta,
  },
});
