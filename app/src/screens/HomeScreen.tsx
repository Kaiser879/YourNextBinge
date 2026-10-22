import React, {useEffect, useRef} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {TVFocusGuideView} from '@amazon-devices/react-native-kepler';
import {FocusTile} from '../components/FocusTile';
import {ScreenHeader} from '../components/ScreenHeader';
import {CATALOG, CURATED_COLLECTIONS, MOODS} from '../data/catalog';
import {focusNode, setNextFocus} from '../services/focus';
import {colors, layout, spacing, type} from '../theme';
import {CuratedCollection, MoodId} from '../types';

interface HomeScreenProps {
  selectedMood: MoodId | null;
  onSelectMood: (mood: MoodId) => void;
  onSelectCollection: (collection: CuratedCollection) => void;
  onContinue: () => void;
  onReset: () => void;
}

/**
 * Four columns is deliberate: 4 * 216 + 3 * 10 = 894, which fits the 896 dp
 * content width. The D-pad map below assumes exactly this column count.
 */
const COLUMNS = 4;
const TILE_WIDTH = 216;
const TILE_HEIGHT = 112;
const COLLECTION_WIDTH = 216;
const CONTINUE_INDEX = MOODS.length;
const RESET_INDEX = MOODS.length + 1;
const COLLECTION_START = MOODS.length + 2;

/**
 * Explicit D-pad map for the mood grid.
 *
 * Geometric focus is unreliable at row edges (it can land on the wrong row or
 * skip the action row), so every direction is wired to a node handle. Indexes
 * 0..6 are moods, 7 = Continue, 8 = Reset, 9.. = curated collections.
 */
function buildFocusMap(): Array<Record<string, number | undefined>> {
  const map: Array<Record<string, number | undefined>> = [];

  for (let i = 0; i < MOODS.length; i += 1) {
    const row = Math.floor(i / COLUMNS);
    const col = i % COLUMNS;
    const nextRow = i + COLUMNS;

    map[i] = {
      up: row > 0 ? i - COLUMNS : undefined,
      down: nextRow < MOODS.length ? nextRow : CONTINUE_INDEX,
      left: col > 0 ? i - 1 : undefined,
      right: col < COLUMNS - 1 && i + 1 < MOODS.length ? i + 1 : undefined,
    };
  }

  map[CONTINUE_INDEX] = {
    up: MOODS.length - 3, // comfort-watch, directly above Continue
    left: undefined,
    right: RESET_INDEX,
    down: COLLECTION_START,
  };

  map[RESET_INDEX] = {
    up: MOODS.length - 3,
    left: CONTINUE_INDEX,
    right: undefined,
    down: COLLECTION_START + 1,
  };

  for (let c = 0; c < CURATED_COLLECTIONS.length; c += 1) {
    const index = COLLECTION_START + c;
    map[index] = {
      up: c % 2 === 0 ? CONTINUE_INDEX : RESET_INDEX,
      left: c > 0 ? index - 1 : undefined,
      right: c < CURATED_COLLECTIONS.length - 1 ? index + 1 : undefined,
      down: undefined,
    };
  }

  return map;
}

const FOCUS_MAP = buildFocusMap();

export const HomeScreen = ({
  selectedMood,
  onSelectMood,
  onSelectCollection,
  onContinue,
  onReset,
}: HomeScreenProps) => {
  const tileRefs = useRef<Array<any>>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const nodes = tileRefs.current;

      // Wire every direction explicitly. Geometric focus drifts at row edges,
      // especially between the grid and the action row.
      nodes.forEach((source, index) => {
        const entry = FOCUS_MAP[index];
        if (!source || !entry) {
          return;
        }
        (['up', 'down', 'left', 'right'] as const).forEach((direction) => {
          const targetIndex = entry[direction];
          if (targetIndex != null) {
            setNextFocus(source, nodes[targetIndex], direction);
          }
        });
      });

      focusNode(nodes[0]);
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  const setTileRef = (index: number) => (node: any) => {
    tileRefs.current[index] = node;
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        eyebrow="YOUR NEXT BINGE"
        title="What are you in the mood for?"
        subtitle="Pick a mood, or skip straight to a curator's shortlist below."
        step={1}
      />

      <TVFocusGuideView style={styles.grid} autoFocus>
        {MOODS.map((mood, index) => (
          <FocusTile
            key={mood.id}
            testID={`mood-${mood.id}`}
            label={mood.label}
            hint={mood.blurb}
            selected={selectedMood === mood.id}
            onPress={() => onSelectMood(mood.id)}
            width={
              index === MOODS.length - 1
                ? TILE_WIDTH * 2 + layout.gridGap
                : TILE_WIDTH
            }
            height={TILE_HEIGHT}
            tileRef={setTileRef(index)}
            hasTVPreferredFocus={index === 0}
          />
        ))}
      </TVFocusGuideView>

      <View style={styles.divider} />

      <View style={styles.actions}>
        <FocusTile
          testID="mood-continue"
          label="Continue"
          size="chip"
          tone="accent"
          width={170}
          disabled={selectedMood == null}
          onPress={onContinue}
          tileRef={setTileRef(CONTINUE_INDEX)}
        />
        <FocusTile
          testID="mood-reset"
          label="Reset"
          size="chip"
          width={110}
          disabled={selectedMood == null}
          onPress={onReset}
          tileRef={setTileRef(RESET_INDEX)}
        />
      </View>

      <View style={styles.collections}>
        <Text style={styles.collectionLabel}>CURATOR'S SHORTCUTS</Text>
        <View style={styles.collectionRow}>
          {CURATED_COLLECTIONS.map((collection, index) => (
            <FocusTile
              key={collection.id}
              testID={`collection-${collection.id}`}
              label={collection.name}
              hint={collection.blurb}
              size="chip"
              onPress={() => onSelectCollection(collection)}
              width={COLLECTION_WIDTH}
              tileRef={setTileRef(COLLECTION_START + index)}
            />
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerMeta}>
          {`${MOODS.length} MOODS  •  ${CATALOG.length} TITLES  •  ${
            CURATED_COLLECTIONS.length
          } COLLECTIONS  •  OFFLINE`}
        </Text>
        <Text style={styles.hint}>D-pad to move • Select to choose</Text>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: layout.gridGap,
    marginTop: spacing.lg + 2,
    width: COLUMNS * TILE_WIDTH + (COLUMNS - 1) * layout.gridGap,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing.md + 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 2,
    marginTop: spacing.md,
  },
  collections: {
    marginTop: spacing.sm + 2,
  },
  collectionLabel: {
    color: colors.textFaint,
    fontSize: type.meta,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  collectionRow: {
    flexDirection: 'row',
    gap: layout.gridGap,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: spacing.md,
  },
  footerMeta: {
    color: colors.textFaint,
    fontSize: type.micro + 1,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  hint: {
    color: colors.textFaint,
    fontSize: type.meta,
  },
});
