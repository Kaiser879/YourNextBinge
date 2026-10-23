import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors, radius, spacing, type} from '../theme';

interface ProviderBadgeProps {
  label: string | null;
}

export const ProviderBadge = ({label}: ProviderBadgeProps) =>
  label ? (
    <View style={styles.badge}>
      <Text style={styles.text} numberOfLines={1}>
        {label}
      </Text>
    </View>
  ) : null;

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  text: {
    color: colors.accent,
    fontSize: type.micro + 1,
    fontWeight: '700',
  },
});
