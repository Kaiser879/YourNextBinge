import React, {useEffect, useRef} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {FocusTile} from '../components/FocusTile';
import {ScreenHeader} from '../components/ScreenHeader';
import {wireFocusGrid} from '../services/focusMap';
import {focusNode} from '../services/focus';
import {colors, layout, spacing, type} from '../theme';
import {Provider, Settings} from '../types.live';

interface SettingsScreenProps {
  settings: Settings;
  providers: Provider[];
  status: 'loading' | 'ready' | 'error';
  error?: string | null;
  onToggleProvider: (providerId: number) => void;
  onRetry: () => void;
  onBack: () => void;
}

const COLUMNS = 3;

export const SettingsScreen = ({
  settings,
  providers,
  status,
  error,
  onToggleProvider,
  onRetry,
  onBack,
}: SettingsScreenProps) => {
  const providerRefs = useRef<any[]>([]);
  const backRef = useRef<any>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const rows: any[][] = [];
      for (let i = 0; i < providers.length; i += COLUMNS) {
        rows.push(providerRefs.current.slice(i, i + COLUMNS));
      }
      rows.push([backRef.current]);
      wireFocusGrid(rows);
      // Land on the first provider, not on Back.
      focusNode(providerRefs.current[0] ?? backRef.current);
    }, 300);
    return () => clearTimeout(timer);
  }, [providers.length]);

  const selected = new Set(settings.providerIds);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        eyebrow="SETTINGS"
        title="Your services"
        subtitle="Pick the streaming services you actually pay for. The On my services row only shows titles available on them."
      />

      <View style={styles.regionRow}>
        <Text style={styles.regionLabel}>REGION</Text>
        <View style={styles.regionChip}>
          <Text style={styles.regionText}>India (IN) — fixed for this demo</Text>
        </View>
        <Text style={styles.count}>
          {selected.size} selected of {providers.length}
        </Text>
      </View>

      {status === 'loading' ? (
        <Text style={styles.stateText}>Loading India providers…</Text>
      ) : null}
      {status === 'error' ? (
        <View style={styles.errorRow}>
          <FocusTile
            label="Retry"
            size="chip"
            tone="accent"
            width={120}
            onPress={onRetry}
            testID="settings-retry"
          />
          <Text style={styles.stateText}>
            {error ?? 'Could not load providers.'}
          </Text>
        </View>
      ) : null}

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {providers.map((provider, index) => (
            <FocusTile
              key={provider.id}
              testID={`provider-${provider.id}`}
              label={provider.name}
              size="chip"
              width={280}
              selected={selected.has(provider.id)}
              onPress={() => onToggleProvider(provider.id)}
              tileRef={(node: any) => {
                providerRefs.current[index] = node;
              }}
            />
          ))}
        </View>

        <View style={styles.actions}>
          <FocusTile
            label="Back to home"
            size="chip"
            width={170}
            onPress={onBack}
            tileRef={backRef}
            testID="settings-back"
          />
          <Text style={styles.hint}>
            Changes are saved as you toggle • D-pad to move • Select to toggle
          </Text>
        </View>
      </ScrollView>
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
  regionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  regionLabel: {
    color: colors.textFaint,
    fontSize: type.micro,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  regionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  regionText: {
    color: colors.textMuted,
    fontSize: type.meta,
  },
  count: {
    color: colors.textFaint,
    fontSize: type.meta,
  },
  list: {
    flex: 1,
    marginTop: spacing.md,
    width: layout.contentMax,
  },
  listContent: {
    paddingBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  hint: {
    color: colors.textFaint,
    fontSize: type.meta,
  },
  stateText: {
    color: colors.textMuted,
    fontSize: type.body,
    marginTop: spacing.sm,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
});
