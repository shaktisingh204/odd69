import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Colors, Fonts, Radius } from '@/utils/theme';

interface Props {
  label?: string;
  color?: string;
  compact?: boolean;
}

export default function LivePulse({ label = 'LIVE', color = '#FF4D56', compact }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.35, duration: 750, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 750, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.25, duration: 750, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.9, duration: 750, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale, opacity]);

  return (
    <View style={[styles.wrap, compact && styles.compact, { backgroundColor: color + '22', borderColor: color + '55' }]}>
      <View style={styles.dotWrap}>
        <Animated.View style={[styles.aura, { backgroundColor: color, transform: [{ scale }], opacity }]} />
        <View style={[styles.dot, { backgroundColor: color }]} />
      </View>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.full, borderWidth: 1,
  },
  compact: { paddingHorizontal: 8, paddingVertical: 2 },
  dotWrap: { width: 10, height: 10, justifyContent: 'center', alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  aura: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  text: { fontSize: Fonts.sizes.xs, fontWeight: Fonts.weights.extrabold, letterSpacing: 0.8 },
});
