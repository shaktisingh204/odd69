import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Radius, Shadow } from '@/utils/theme';

interface Props {
  children: React.ReactNode;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  radius?: number;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  bordered?: boolean;
  glowColor?: string;
}

export default function GlassCard({
  children,
  intensity = 40,
  tint = 'dark',
  radius = Radius.xl,
  padded = false,
  style,
  bordered = true,
  glowColor,
}: Props) {
  const glowStyle = glowColor
    ? {
        shadowColor: glowColor,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 18,
        elevation: 8,
      }
    : Shadow.soft;

  const content = (
    <LinearGradient
      colors={
        tint === 'dark'
          ? ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.03)']
          : ['rgba(255,255,255,0.65)', 'rgba(255,255,255,0.35)']
      }
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.inner,
        { borderRadius: radius },
        bordered && {
          borderWidth: 1,
          borderColor: tint === 'dark' ? Colors.glassBorder : 'rgba(255,255,255,0.6)',
        },
        padded && styles.padding,
      ]}
    >
      {children}
    </LinearGradient>
  );

  // On Android, BlurView support is limited — fall back to semi-transparent surface
  if (Platform.OS === 'android') {
    return (
      <View
        style={[
          glowStyle,
          {
            borderRadius: radius,
            backgroundColor: tint === 'dark' ? 'rgba(21,24,36,0.72)' : 'rgba(255,255,255,0.85)',
            overflow: 'hidden',
          },
          style,
        ]}
      >
        {content}
      </View>
    );
  }

  return (
    <View style={[glowStyle, { borderRadius: radius, overflow: 'hidden' }, style]}>
      <BlurView intensity={intensity} tint={tint} style={{ borderRadius: radius, overflow: 'hidden' }}>
        {content}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  inner: {
    overflow: 'hidden',
  },
  padding: {
    padding: 16,
  },
});
