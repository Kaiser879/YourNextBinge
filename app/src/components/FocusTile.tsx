import React, {useRef, useState} from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import {colors, radius, spacing, type} from '../theme';
import {focusNode} from '../services/focus';

export interface FocusTileProps {
  label: string;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  /** Optional supporting line rendered under the label. */
  hint?: string;
  /** Fixed width keeps the grid predictable for D-pad traversal. */
  width?: number;
  height?: number;
  size?: 'large' | 'chip';
  /** `accent` marks the primary action on a screen. */
  tone?: 'default' | 'accent';
  testID?: string;
  accessibilityLabel?: string;
  hasTVPreferredFocus?: boolean;
  style?: StyleProp<ViewStyle>;
  onFocus?: () => void;
  /** Used by screens to set initial focus imperatively via FocusManager. */
  tileRef?: React.Ref<any>;
}

/**
 * The one focusable primitive used everywhere.
 *
 * Focus and selection stay visually distinct:
 *  - focus    = accent ring + slight lift, background stays readable
 *  - selected = solid accent fill with dark text
 *  - both     = accent fill + light ring, never dark-on-dark
 */
export const FocusTile = ({
  label,
  onPress,
  selected = false,
  disabled = false,
  hint,
  width,
  height,
  size = 'large',
  tone = 'default',
  testID,
  accessibilityLabel,
  hasTVPreferredFocus,
  style,
  onFocus,
  tileRef,
}: FocusTileProps) => {
  const [focused, setFocused] = useState(false);
  const isChip = size === 'chip';
  const isAccent = tone === 'accent';
  const localRef = useRef<any>(null);

  const assignRef = (node: any) => {
    localRef.current = node;
    if (!tileRef) {
      return;
    }
    if (typeof tileRef === 'function') {
      tileRef(node);
    } else {
      (tileRef as React.MutableRefObject<any>).current = node;
    }
  };

  const handlePress = () => {
    onPress();
    // Selecting a tile changes parent state, which re-renders the row and can
    // leave the platform with no focused node. Restore focus to this tile so
    // D-pad navigation continues from where the user was.
    setTimeout(() => {
      focusNode(localRef.current);
    }, 80);
  };

  const focusedStyle = selected
    ? styles.focusedSelected
    : isAccent
    ? styles.focusedAccent
    : styles.focused;

  return (
    <Pressable
      ref={assignRef}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{selected, disabled}}
      disabled={disabled}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onPress={disabled ? undefined : handlePress}
      onFocus={() => {
        setFocused(true);
        onFocus?.();
      }}
      onBlur={() => setFocused(false)}
      style={[
        styles.base,
        isChip ? styles.chip : styles.tile,
        {width, height},
        isAccent && styles.accent,
        selected && styles.selected,
        focused && !disabled && focusedStyle,
        disabled && styles.disabled,
        style,
      ]}>
      <Text
        style={[
          isChip ? styles.chipLabel : styles.label,
          isAccent && styles.labelAccent,
          selected && styles.labelSelected,
          disabled && styles.labelDisabled,
        ]}
        numberOfLines={2}>
        {label}
      </Text>
      {hint ? (
        <Text
          style={[
            styles.hint,
            (selected || isAccent) && styles.hintSelected,
            disabled && styles.labelDisabled,
          ]}
          numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg - 2,
    paddingVertical: spacing.sm,
  },
  tile: {
    minHeight: 104,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.md - 1,
    paddingVertical: 0,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accent: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  selected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  focused: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceFocused,
  },
  focusedAccent: {
    borderColor: colors.text,
  },
  focusedSelected: {
    borderColor: colors.text,
  },
  disabled: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  label: {
    color: colors.text,
    fontSize: type.card,
    fontWeight: '700',
  },
  chipLabel: {
    color: colors.text,
    fontSize: type.body - 1,
    fontWeight: '600',
  },
  labelAccent: {
    color: colors.textOnAccent,
  },
  labelSelected: {
    color: colors.textOnAccent,
  },
  labelDisabled: {
    color: colors.textFaint,
  },
  hint: {
    color: colors.textMuted,
    fontSize: type.meta,
    lineHeight: 16,
    marginTop: spacing.xs,
  },
  hintSelected: {
    color: colors.textOnAccentMuted,
  },
});
