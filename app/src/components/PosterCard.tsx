import React, {useRef, useState} from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {colors, radius, spacing, type} from '../theme';
import {MovieSummary} from '../types.live';
import {focusNode} from '../services/focus';

export const POSTER_WIDTH = 140;
export const POSTER_HEIGHT = 210;

interface PosterCardProps {
  movie: MovieSummary;
  onPress: () => void;
  onFocus?: () => void;
  testID?: string;
  cardRef?: React.Ref<any>;
  hasTVPreferredFocus?: boolean;
}

/**
 * Focusable poster tile for live rows. Falls back to a typographic tile when
 * TMDB has no poster or the image fails, so a row never renders a blank box.
 */
export const PosterCard = ({
  movie,
  onPress,
  onFocus,
  testID,
  cardRef,
  hasTVPreferredFocus,
}: PosterCardProps) => {
  const [focused, setFocused] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const localRef = useRef<any>(null);

  const assignRef = (node: any) => {
    localRef.current = node;
    if (!cardRef) {
      return;
    }
    if (typeof cardRef === 'function') {
      cardRef(node);
    } else {
      (cardRef as React.MutableRefObject<any>).current = node;
    }
  };

  const showImage = movie.posterUrl != null && !imageFailed;

  const handlePress = () => {
    onPress();
    // State changes can drop the platform's focused node; restore it.
    setTimeout(() => focusNode(localRef.current), 80);
  };

  return (
    <Pressable
      ref={assignRef}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${movie.title}${
        movie.year ? `, ${movie.year}` : ''
      }${movie.providerLabel ? `, on ${movie.providerLabel}` : ''}`}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onPress={handlePress}
      onFocus={() => {
        setFocused(true);
        onFocus?.();
      }}
      onBlur={() => setFocused(false)}
      style={[styles.card, focused && styles.focused]}>
      {showImage ? (
        <Image
          source={{uri: movie.posterUrl ?? undefined}}
          style={styles.poster}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <View style={styles.fallback}>
          <Text style={styles.fallbackTitle} numberOfLines={4}>
            {movie.title}
          </Text>
          {movie.year ? (
            <Text style={styles.fallbackYear}>{movie.year}</Text>
          ) : null}
        </View>
      )}

      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={1}>
          {movie.title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {[movie.year, movie.rating != null ? `${movie.rating}/10` : null]
            .filter(Boolean)
            .join('  •  ')}
        </Text>
      </View>

      {movie.providerLabel ? (
        <View style={styles.providerBadge}>
          <Text style={styles.providerText} numberOfLines={1}>
            {movie.providerLabel}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    width: POSTER_WIDTH,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  focused: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceFocused,
  },
  poster: {
    width: POSTER_WIDTH - 4,
    height: POSTER_HEIGHT,
    backgroundColor: colors.backgroundElevated,
  },
  fallback: {
    width: POSTER_WIDTH - 4,
    height: POSTER_HEIGHT,
    padding: spacing.sm,
    justifyContent: 'flex-end',
    backgroundColor: colors.backgroundElevated,
  },
  fallbackTitle: {
    color: colors.text,
    fontSize: type.body,
    fontWeight: '700',
  },
  fallbackYear: {
    color: colors.textMuted,
    fontSize: type.meta,
    marginTop: spacing.xs,
  },
  meta: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs + 2,
    paddingBottom: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: type.meta + 1,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: type.micro + 1,
    marginTop: 2,
  },
  providerBadge: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    maxWidth: POSTER_WIDTH - 20,
    backgroundColor: 'rgba(8, 12, 17, 0.84)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  providerText: {
    color: colors.accent,
    fontSize: type.micro,
    fontWeight: '700',
  },
});
