import React, {useMemo} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {FocusTile} from '../components/FocusTile';
import {ScreenHeader} from '../components/ScreenHeader';
import {CATALOG, GENRE_LABELS, MOOD_LABELS} from '../data/catalog';
import {useInitialFocus} from '../hooks/useInitialFocus';
import {colors, layout, radius, spacing, type} from '../theme';
import {Recommendation} from '../types';

interface DetailScreenProps {
  recommendation: Recommendation;
  onShowRelated: (titleId: string) => void;
  onBack: () => void;
}

const INTENSITY_LABEL: Record<string, string> = {
  low: 'Gentle',
  medium: 'Some edge',
  high: 'Intense',
};

/**
 * Related titles share a mood or a genre, ranked by how much they overlap.
 * Kept deterministic (shared count, then newer, then id) for stable UI.
 */
function pickRelated(
  titleId: string,
  moods: string[],
  genres: string[],
): Array<{id: string; label: string; hint: string}> {
  const pool = CATALOG.filter(
    (t) =>
      t.id !== titleId &&
      (t.moods.some((m) => moods.includes(m)) ||
        t.genres.some((g) => genres.includes(g))),
  );

  return pool
    .map((t) => ({
      id: t.id,
      title: t,
      shared:
        t.moods.filter((m) => moods.includes(m)).length +
        t.genres.filter((g) => genres.includes(g)).length,
    }))
    .sort(
      (a, b) =>
        b.shared - a.shared || b.title.year - a.title.year ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 3)
    .map(({id, title}) => ({
      id,
      label: title.title,
      hint: `${title.year} — ${title.genres
        .map((g) => GENRE_LABELS[g])
        .join(', ')}`,
    }));
}

export const DetailScreen = ({
  recommendation,
  onShowRelated,
  onBack,
}: DetailScreenProps) => {
  const {title, reason} = recommendation;
  const runtime =
    title.runtime != null ? `${title.runtime} min` : 'Runtime unknown';
  const backRef = useInitialFocus();

  const related = useMemo(
    () => pickRelated(title.id, title.moods, title.genres),
    [title.genres, title.id, title.moods],
  );

  const knowNext: string[] = [];
  if (title.runtime == null) {
    knowNext.push(
      'We do not have a verified runtime for this one, so it may run longer than you expect.',
    );
  }
  if (title.intensity === 'high') {
    knowNext.push('Expect sustained tension; it is not a background watch.');
  } else if (title.intensity === 'low') {
    knowNext.push('Low commitment; easy to pick up and put down.');
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        eyebrow="TITLE DETAILS"
        title={title.title}
        subtitle={`${title.year}  •  ${runtime}  •  ${title.genres
          .map((genre) => GENRE_LABELS[genre])
          .join(', ')}`}
        step={4}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.tagRow}>
          {title.moods.map((mood) => (
            <View key={mood} style={styles.tag}>
              <Text style={styles.tagText}>{MOOD_LABELS[mood]}</Text>
            </View>
          ))}
          <View style={[styles.tag, styles.intensityTag]}>
            <Text style={styles.intensityText}>
              {INTENSITY_LABEL[title.intensity]}
            </Text>
          </View>
        </View>

        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>WHY THIS FITS</Text>
          <Text style={styles.reasonText}>{reason}</Text>
        </View>

        <Text style={styles.sectionLabel}>SYNOPSIS</Text>
        <Text style={styles.synopsis}>{title.synopsis}</Text>

        {knowNext.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>GOOD TO KNOW</Text>
            {knowNext.map((line) => (
              <Text key={line} style={styles.knowText}>
                {line}
              </Text>
            ))}
          </>
        ) : null}

        {related.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>YOU MAY ALSO LIKE</Text>
            <View style={styles.relatedRow}>
              {related.map((item) => (
                <FocusTile
                  key={item.id}
                  testID={`related-${item.id}`}
                  label={item.label}
                  hint={item.hint}
                  size="chip"
                  width={260}
                  onPress={() => onShowRelated(item.id)}
                />
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.disclaimer}>
          Streaming availability is not shown. This app helps you choose what to
          watch, not where to watch it.
        </Text>
      </ScrollView>

      <View style={styles.actions}>
        <FocusTile
          testID="detail-back"
          label="Back to results"
          size="chip"
          width={190}
          onPress={onBack}
          tileRef={backRef}
          hasTVPreferredFocus
        />
        <Text style={styles.footerHint}>
          Back restores your shortlist • Select a suggestion to jump to it
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
  scroll: {
    flex: 1,
    marginTop: spacing.md,
    width: layout.contentMax,
  },
  scrollContent: {
    paddingBottom: spacing.sm,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  tagText: {
    color: colors.accent,
    fontSize: type.meta,
    fontWeight: '600',
  },
  intensityTag: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  intensityText: {
    color: colors.textMuted,
    fontSize: type.meta,
    fontWeight: '600',
  },
  reasonBox: {
    backgroundColor: colors.backgroundElevated,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
  reasonLabel: {
    color: colors.accent,
    fontSize: type.micro + 1,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  reasonText: {
    color: colors.text,
    fontSize: type.body,
    marginTop: spacing.xs,
  },
  sectionLabel: {
    color: colors.textFaint,
    fontSize: type.meta,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: spacing.lg,
  },
  synopsis: {
    color: '#dbe4ec',
    fontSize: type.body,
    lineHeight: 24,
    marginTop: spacing.sm,
    maxWidth: 820,
  },
  knowText: {
    color: '#c8d3de',
    fontSize: type.body - 1,
    lineHeight: 21,
    marginTop: spacing.sm,
    maxWidth: 820,
  },
  relatedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  disclaimer: {
    color: colors.textFaint,
    fontSize: type.meta,
    marginTop: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerHint: {
    color: colors.textFaint,
    fontSize: type.meta,
  },
});
