import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gradients } from '@/utils/theme';

interface Props {
  children: React.ReactNode;
  variant?: 'night' | 'stadium' | 'hero';
  style?: StyleProp<ViewStyle>;
}

export default function ScreenBackground({ children, variant = 'night', style }: Props) {
  const colors =
    variant === 'stadium' ? Gradients.stadium : variant === 'hero' ? Gradients.hero : Gradients.night;

  return (
    <View style={[styles.root, style]}>
      <LinearGradient colors={colors} style={StyleSheet.absoluteFill} />
      {/* Decorative orb overlays for depth */}
      <View style={[styles.orb, styles.orbTopRight]} />
      <View style={[styles.orb, styles.orbBottomLeft]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  orb: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    opacity: 0.28,
  },
  orbTopRight: {
    top: -140,
    right: -110,
    backgroundColor: '#FF4D56',
  },
  orbBottomLeft: {
    bottom: -160,
    left: -120,
    backgroundColor: '#1565C0',
    opacity: 0.22,
  },
});
