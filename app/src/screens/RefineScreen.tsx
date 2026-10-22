import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {FocusTile} from '../components/FocusTile';
import {ScreenHeader} from '../components/ScreenHeader';
import {GENRES, MOOD_LABELS} from '../data/catalog';
import {useInitialFocus} from '../hooks/useInitialFocus';
import {colors, layout, spacing, type} from '../theme';
import {ERA_LABELS, EraId, GenreId, Intensity, MoodId} from '../types';

const RUNTIME_OPTIONS: {label: string; value: number | null}[] = [
  {label: 'Any length', value: null},
  {label: 'Under 90 min', value: 90},
  {label: 'Under 120 min', value: 120},
  {label: 'Under 180 min', value: 180},
];

const INTENSITY_OPTIONS: {label: string; value: Intensity | null}[] = [
  {label: 'Any intensity', value: null},
  {label: 'Gentle', value: 'low'},
  {label: 'Some edge', value: 'medium'},
  {label: 'Intense', value: 'high'},
];

const ERA_OPTIONS: {label: string; value: EraId | null}[] = [
  {label: 'Any era', value: null},
  {label: ERA_LABELS['2020s'], value: '2020s'},
  {label: ERA_LABELS['2010s'], value: '2010s'},
  {label: ERA_LABELS['2000s'], value: '2000s'},
  {label: ERA_LABELS['1990s'], value: '1990s'},
  {label: ERA_LABELS.earlier, value: 'earlier'},
];

interface RefineScreenProps {
  mood: MoodId;
  genre: GenreId | null;
  maxRuntimeMinutes: number | null;
  maxIntensity: Intensity | null;
  era: EraId | null;
  onSelectGenre: (genre: GenreId | null) => void;
  onSelectRuntime: (minutes: number | null) => void;
  onSelectIntensity: (intensity: Intensity | null) => void;
  onSelectEra: (era: EraId | null) => void;
  onSubmit: () => void;
  onBack: () => void;
}

export const RefineScreen = ({
  mood,
  genre,
  maxRuntimeMinutes,
  maxIntensity,
  era,
  onSelectGenre,
  onSelectRuntime,
  onSelectIntensity,
  onSelectEra,
  onSubmit,
  onBack,
}: RefineScreenProps) => {
  const submitRef = useInitialFocus();

  return (
    <View style={styles.screen}>
      <ScreenHeader
        eyebrow={`MOOD • ${MOOD_LABELS[mood].toUpperCase()}`}
        title="Anything else we should know?"
        subtitle="Everything here is optional. Skip it all and we will still find something worth watching."
        step={2}
      />

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>TIME</Text>
        <View style={styles.chipRow}>
          {RUNTIME_OPTIONS.map((option) => (
            <FocusTile
              key={option.label}
              testID={`runtime-${option.value ?? 'any'}`}
              label={option.label}
              size="chip"
              selected={maxRuntimeMinutes === option.value}
              onPress={() => onSelectRuntime(option.value)}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>GENRE</Text>
        <View style={styles.chipRow}>
          <FocusTile
            testID="genre-any"
            label="Any genre"
            size="chip"
            selected={genre == null}
            onPress={() => onSelectGenre(null)}
          />
          {GENRES.map((option) => (
            <FocusTile
              key={option.id}
              testID={`genre-${option.id}`}
              label={option.label}
              size="chip"
              selected={genre === option.id}
              onPress={() => onSelectGenre(option.id)}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>INTENSITY</Text>
        <View style={styles.chipRow}>
          {INTENSITY_OPTIONS.map((option) => (
            <FocusTile
              key={option.label}
              testID={`intensity-${option.value ?? 'any'}`}
              label={option.label}
              size="chip"
              selected={maxIntensity === option.value}
              onPress={() => onSelectIntensity(option.value)}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ERA</Text>
        <View style={styles.chipRow}>
          {ERA_OPTIONS.map((option) => (
            <FocusTile
              key={option.label}
              testID={`era-${option.value ?? 'any'}`}
              label={option.label}
              size="chip"
              selected={era === option.value}
              onPress={() => onSelectEra(option.value)}
            />
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <FocusTile
          testID="refine-submit"
          label="Find my next binge"
          size="chip"
          tone="accent"
          width={240}
          onPress={onSubmit}
          tileRef={submitRef}
          hasTVPreferredFocus
        />
        <FocusTile
          testID="refine-back"
          label="Back"
          size="chip"
          width={110}
          onPress={onBack}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerMeta}>ALL FILTERS OPTIONAL</Text>
        <Text style={styles.footerHint}>Select to apply • Back returns to moods</Text>
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
  section: {
    marginTop: spacing.lg + 2,
  },
  sectionLabel: {
    color: colors.textFaint,
    fontSize: type.meta,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    width: layout.contentMax,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 2,
    marginTop: spacing.lg + 4,
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
  footerMeta: {
    color: colors.textFaint,
    fontSize: type.micro + 1,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  footerHint: {
    color: colors.textFaint,
    fontSize: type.meta,
  },
});
