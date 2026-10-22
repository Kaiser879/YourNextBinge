import React, {useState} from 'react';
import {Pressable, StyleProp, StyleSheet, Text, View, ViewStyle} from 'react-native';
import {colors, radius, spacing, type} from '../theme';
import {Recommendation} from '../types';
import {GENRE_LABELS} from '../data/catalog';

interface RankCardProps {
  recommendation: Recommendation;
  isTop?: boolean;
  rank: number;
  onPress: () => void;
  onFocus?: () => void;
  hasTVPreferredFocus?: boolean;
  testID?: string;
  cardRef?: React.Ref<any>;
  style?: StyleProp<ViewStyle>;
}

function metaLine(recommendation: Recommendation): string {
  const {title} = recommendation;
  const runtime = title.runtime != null ? `${title.runtime} min` : 'Runtime unknown';
  const genres = title.genres.map((genre) => GENRE_LABELS[genre]).join(', ');
  return `${title.year} • ${runtime} • ${genres}`;
}

/**
 * Ranked result card. The top match is wider and louder; the remaining rows
 * are compact so four or five stay reachable without a long scroll.
 */
export const RankCard = ({
  recommendation,
  isTop = false,
  rank,
  onPress,
  onFocus,
  hasTVPreferredFocus,
  testID,
  cardRef,
  style,
}: RankCardProps) => {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      ref={cardRef}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${recommendation.title.title}, rank ${rank}. ${recommendation.reason}`}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onPress={onPress}
      onFocus={() => {
        setFocused(true);
        onFocus?.();
      }}
      onBlur={() => setFocused(false)}
      style={[
        styles.card,
        isTop ? styles.topCard : styles.rowCard,
        focused && styles.focused,
        style,
      ]}>
      <View style={[styles.rankBadge, isTop && styles.rankBadgeTop]}>
        <Text style={[styles.rankText, isTop && styles.rankTextTop]}>{rank}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text
            style={isTop ? styles.topTitle : styles.rowTitle}
            numberOfLines={1}>
            {recommendation.title.title}
          </Text>
          {isTop ? (
            <View style={styles.topBadge}>
              <Text style={styles.topBadgeText}>TOP MATCH</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {metaLine(recommendation)}
        </Text>
        <Text style={styles.reason} numberOfLines={2}>
          {recommendation.reason}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    paddingHorizontal: spacing.lg - 2,
    paddingVertical: spacing.sm,
  },
  topCard: {
    minHeight: 96,
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowCard: {
    minHeight: 58,
  },
  focused: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceFocused,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rankBadgeTop: {
    width: 36,
    height: 36,
    backgroundColor: colors.accent,
  },
  rankText: {
    color: colors.accent,
    fontSize: type.body,
    fontWeight: '700',
  },
  rankTextTop: {
    color: colors.textOnAccent,
  },
  body: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topTitle: {
    color: colors.text,
    fontSize: type.card + 2,
    fontWeight: '700',
    flexShrink: 1,
  },
  rowTitle: {
    color: colors.text,
    fontSize: type.card - 1,
    fontWeight: '600',
  },
  meta: {
    color: colors.textMuted,
    fontSize: type.meta,
    marginTop: 2,
  },
  reason: {
    color: '#cdd8e3',
    fontSize: type.body - 1,
    lineHeight: 19,
    marginTop: 3,
  },
  topBadge: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    marginLeft: spacing.md,
  },
  topBadgeText: {
    color: colors.accent,
    fontSize: type.micro,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
});
