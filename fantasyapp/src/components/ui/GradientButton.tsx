import React from 'react';
import {
  Pressable, Text, StyleSheet, ViewStyle, StyleProp,
  ActivityIndicator, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Fonts, Radius, Shadow, Gradients } from '@/utils/theme';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'gold' | 'success' | 'ghost';
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
}

export default function GradientButton({
  label, onPress, disabled, loading,
  icon, size = 'md', variant = 'primary', style, fullWidth,
}: Props) {
  const colors =
    variant === 'gold' ? Gradients.gold
    : variant === 'success' ? Gradients.success
    : variant === 'ghost' ? (['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)'] as const)
    : Gradients.cta;

  const padV = size === 'sm' ? 8 : size === 'lg' ? 16 : 12;
  const padH = size === 'sm' ? 14 : size === 'lg' ? 24 : 18;
  const fontSize = size === 'sm' ? Fonts.sizes.sm : size === 'lg' ? Fonts.sizes.lg : Fonts.sizes.base;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.wrap,
        variant !== 'ghost' && Shadow.glow,
        { opacity: disabled ? 0.55 : pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        fullWidth && { alignSelf: 'stretch' },
        style,
      ]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.btn,
          { paddingVertical: padV, paddingHorizontal: padH },
          variant === 'ghost' && { borderWidth: 1, borderColor: Colors.glassBorder },
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <View style={styles.row}>
            {icon}
            <Text style={[styles.label, { fontSize }]}>{label}</Text>
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: Radius.full, overflow: 'visible' },
  btn: {
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: '#fff', fontWeight: Fonts.weights.extrabold, letterSpacing: 0.3 },
});
