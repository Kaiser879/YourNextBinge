import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors, radius, spacing, type} from '../theme';
import {AvailabilityEntry} from '../types.live';
import {groupAvailability} from '../services/availability';

interface AvailabilityChipsProps {
  availability: AvailabilityEntry[];
  selectedProviderIds: number[];
  loading?: boolean;
}

const GROUPS: Array<{key: 'stream' | 'rent' | 'buy'; label: string}> = [
  {key: 'stream', label: 'STREAM'},
  {key: 'rent', label: 'RENT'},
  {key: 'buy', label: 'BUY'},
];

/**
 * Stream / Rent / Buy rows, one chip per provider. Names only — provider
 * logos are a cut feature.
 */
export const AvailabilityChips = ({
  availability,
  selectedProviderIds,
  loading = false,
}: AvailabilityChipsProps) => {
  if (loading) {
    return (
      <Text style={styles.note}>Checking where to watch in India…</Text>
    );
  }
  if (availability.length === 0) {
    return (
      <Text style={styles.note}>
        No India availability listed. You can still save it to My List.
      </Text>
    );
  }

  const grouped = groupAvailability(availability);
  const selected = new Set(selectedProviderIds);
  const onSelected = availability.some((entry) => selected.has(entry.providerId));

  return (
    <View style={styles.wrap}>
      {GROUPS.map((group) => {
        const entries = grouped[group.key];
        if (entries.length === 0) {
          return null;
        }
        return (
          <View key={group.key} style={styles.group}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            <View style={styles.chips}>
              {entries.map((entry) => {
                const isMine = selected.has(entry.providerId);
                return (
                  <View
                    key={`${group.key}-${entry.providerId}`}
                    style={[styles.chip, isMine && styles.mineChip]}>
                    <Text style={[styles.chipText, isMine && styles.mineText]}>
                      {entry.providerName}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}

      {!onSelected ? (
        <Text style={styles.note}>
          Available in India, but not on the services you selected.
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.sm,
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  groupLabel: {
    color: colors.textFaint,
    fontSize: type.micro,
    fontWeight: '700',
    letterSpacing: 1.2,
    width: 52,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    flexShrink: 1,
  },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
  },
  mineChip: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: type.meta,
    fontWeight: '600',
  },
  mineText: {
    color: colors.accent,
  },
  note: {
    color: colors.textMuted,
    fontSize: type.meta + 1,
    marginTop: spacing.xs,
  },
});
