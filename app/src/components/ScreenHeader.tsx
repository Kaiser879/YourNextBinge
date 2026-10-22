import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors, spacing, type} from '../theme';

interface ScreenHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** 1-based position in the four-screen flow. */
  step: 1 | 2 | 3 | 4;
}

const TOTAL_STEPS = 4;

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * Shared page header: accent rule + eyebrow, title, optional subtitle, and a
 * step counter pinned to the top-right. Every screen uses it so the flow reads
 * as one product instead of four separate layouts.
 */
export const ScreenHeader = ({
  eyebrow,
  title,
  subtitle,
  step,
}: ScreenHeaderProps) => (
  <View style={styles.row}>
    <View style={styles.copy}>
      <View style={styles.eyebrowRow}>
        <View style={styles.rule} />
        <Text style={styles.eyebrow}>{eyebrow}</Text>
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
    </View>
    <Text style={styles.step}>
      {pad(step)}
      <Text style={styles.stepTotal}>{` / ${pad(TOTAL_STEPS)}`}</Text>
    </Text>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  copy: {
    flexShrink: 1,
    maxWidth: 760,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rule: {
    width: 18,
    height: 2,
    backgroundColor: colors.accent,
    marginRight: spacing.sm,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: type.meta,
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: {
    color: colors.text,
    fontSize: type.display,
    fontWeight: '700',
    marginTop: 6,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: type.body,
    lineHeight: 22,
    marginTop: 6,
  },
  step: {
    color: colors.textMuted,
    fontSize: type.meta,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 2,
    marginLeft: spacing.lg,
  },
  stepTotal: {
    color: colors.textFaint,
    fontWeight: '600',
  },
});
