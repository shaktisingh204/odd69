import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Colors, Fonts, Radius, Shadow, Gradients } from '@/utils/theme';

const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Matches: ['trophy', 'trophy-outline'],
  MyTeams: ['people', 'people-outline'],
  History: ['time', 'time-outline'],
  Profile: ['person', 'person-outline'],
};

const LABELS: Record<string, string> = {
  Matches: 'Matches',
  MyTeams: 'Teams',
  History: 'History',
  Profile: 'Profile',
};

export default function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const Content = (
    <View style={styles.row}>
      {state.routes.map((route, i) => {
        const isFocused = state.index === i;
        const [active, inactive] = ICONS[route.name] ?? ['ellipse', 'ellipse-outline'];

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={({ pressed }) => [
              styles.tab,
              { opacity: pressed ? 0.85 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: isFocused }}
          >
            {isFocused && (
              <LinearGradient
                colors={Gradients.cta}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.activeBg, Shadow.glow]}
              />
            )}
            <View style={styles.tabInner}>
              <Ionicons
                name={isFocused ? active : inactive}
                size={isFocused ? 20 : 18}
                color={isFocused ? '#fff' : Colors.textOnDarkMuted}
              />
              {isFocused ? (
                <Text style={styles.labelActive} numberOfLines={1}>{LABELS[route.name] || route.name}</Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View
      style={[
        styles.wrap,
        { paddingBottom: Math.max(insets.bottom, 10), bottom: 0 },
        Shadow.lifted,
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.inner}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill}>
            <LinearGradient
              colors={['rgba(21,24,36,0.6)', 'rgba(10,12,20,0.85)']}
              style={StyleSheet.absoluteFill}
            />
          </BlurView>
        ) : (
          <LinearGradient
            colors={['rgba(21,24,36,0.94)', 'rgba(10,12,20,0.98)']}
            style={StyleSheet.absoluteFill}
          />
        )}
        {Content}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12, right: 12,
    paddingTop: 0,
  },
  inner: {
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    marginHorizontal: 2,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    minHeight: 48,
    justifyContent: 'center',
  },
  activeBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.xl,
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  labelActive: {
    color: '#fff',
    fontSize: Fonts.sizes.xs,
    fontWeight: Fonts.weights.extrabold,
    letterSpacing: 0.3,
  },
});
