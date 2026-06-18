import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from './ui/GlassCard';
import { Colors, Fonts, Radius, Spacing, Shadow } from '@/utils/theme';

interface Props {
  contestId: string;
  title: string;
  type: string;
  entryFee: number;
  totalPrize: number;
  maxSpots: number;
  filledSpots: number;
  prizeBreakdown?: Array<{ rankFrom: number; rankTo: number; prize: number }>;
  isJoined?: boolean;
  onJoin: () => void;
  onPress: () => void;
}

function formatMoney(n: number) {
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `${n}`;
}

export default function ContestCard({
  title, type, entryFee, totalPrize, maxSpots, filledSpots,
  prizeBreakdown, isJoined, onJoin, onPress,
}: Props) {
  const spotsLeft = maxSpots - filledSpots;
  const fillPct = Math.min((filledSpots / Math.max(maxSpots, 1)) * 100, 100);
  const topPrize = prizeBreakdown?.[0]?.prize;
  const winners = prizeBreakdown?.length || 0;
  const isFillingFast = fillPct > 75 && spotsLeft > 0;

  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: fillPct,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fillPct, progress]);

  const fillWidth = progress.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.wrap,
        Shadow.lifted,
        { transform: [{ scale: pressed ? 0.985 : 1 }] },
      ]}
    >
      <GlassCard radius={Radius.xl} intensity={45} tint="dark">
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <View style={styles.typeRow}>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{type?.toUpperCase() || 'MEGA'}</Text>
              </View>
              {winners > 0 && (
                <View style={styles.winnersBadge}>
                  <Ionicons name="people" size={10} color={Colors.textOnDarkMuted} />
                  <Text style={styles.winnersText}>{winners} winners</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.prizeBlock}>
            <Text style={styles.prizeLabel}>Prize Pool</Text>
            <LinearGradient
              colors={['#FFD166', '#FF8A5B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.prizeValueWrap}
            >
              <Text style={styles.prizeValue}>₹{formatMoney(totalPrize)}</Text>
            </LinearGradient>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBlock}>
          <View style={styles.progressBg}>
            <Animated.View style={[StyleSheet.absoluteFill, { width: fillWidth }]}>
              <LinearGradient
                colors={isFillingFast ? ['#FF4D56', '#FFD166'] : ['#FF6A5B', '#D13239']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
          <View style={styles.spotsRow}>
            <View style={styles.spotsLeft}>
              {isFillingFast && <Ionicons name="flame" size={11} color="#FF4D56" />}
              <Text style={[styles.spotsText, isFillingFast && { color: '#FF4D56' }]}>
                {spotsLeft > 0 ? `${formatMoney(spotsLeft)} spots left` : 'Full'}
              </Text>
            </View>
            <Text style={styles.spotsSub}>{formatMoney(maxSpots)} total</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.entryBlock}>
            <Text style={styles.entryLabel}>Entry</Text>
            <Text style={styles.entryValue}>{entryFee === 0 ? 'FREE' : `₹${entryFee}`}</Text>
          </View>

          {topPrize ? (
            <View style={styles.perkBlock}>
              <Ionicons name="trophy" size={13} color={Colors.accentGold} />
              <View>
                <Text style={styles.perkLabel}>1st prize</Text>
                <Text style={styles.perkValue}>₹{formatMoney(topPrize)}</Text>
              </View>
            </View>
          ) : null}

          <Pressable
            onPress={(e) => { e.stopPropagation?.(); onJoin(); }}
            style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
          >
            <LinearGradient
              colors={isJoined ? ['rgba(34,197,94,0.25)', 'rgba(34,197,94,0.1)'] : ['#FF6A5B', '#D13239']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.joinBtn, !isJoined && Shadow.glow, isJoined && styles.joinBtnJoined]}
            >
              {isJoined && <Ionicons name="checkmark-circle" size={14} color={Colors.success} />}
              <Text style={[styles.joinBtnText, isJoined && styles.joinBtnTextJoined]}>
                {isJoined ? 'Joined' : entryFee === 0 ? 'Join Free' : `Join ₹${entryFee}`}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.md },
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: Spacing.base, paddingBottom: Spacing.sm, gap: 10,
  },
  title: {
    fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.extrabold,
    color: Colors.textOnDark, marginBottom: 6,
  },
  typeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  typeBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1, borderColor: Colors.glassBorder,
  },
  typeBadgeText: {
    fontSize: 10, color: Colors.textOnDark,
    fontWeight: Fonts.weights.extrabold, letterSpacing: 0.5,
  },
  winnersBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: Radius.full,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  winnersText: { fontSize: 10, color: Colors.textOnDarkMuted, fontWeight: Fonts.weights.semibold },
  prizeBlock: { alignItems: 'flex-end' },
  prizeLabel: {
    fontSize: 10, color: Colors.textOnDarkFaint,
    fontWeight: Fonts.weights.semibold, letterSpacing: 0.5,
    textTransform: 'uppercase', marginBottom: 4,
  },
  prizeValueWrap: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.full,
    ...Shadow.glowGold,
  },
  prizeValue: {
    fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.black,
    color: '#1A0F00', letterSpacing: 0.3,
  },
  progressBlock: { paddingHorizontal: Spacing.base, paddingBottom: 4 },
  progressBg: {
    height: 6, backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3, overflow: 'hidden',
  },
  spotsRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6, alignItems: 'center',
  },
  spotsLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  spotsText: { fontSize: Fonts.sizes.xs, color: Colors.textOnDark, fontWeight: Fonts.weights.bold },
  spotsSub: { fontSize: Fonts.sizes.xs, color: Colors.textOnDarkFaint, fontWeight: Fonts.weights.medium },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  entryBlock: { gap: 1 },
  entryLabel: { fontSize: 10, color: Colors.textOnDarkFaint, fontWeight: Fonts.weights.semibold, letterSpacing: 0.4, textTransform: 'uppercase' },
  entryValue: { fontSize: Fonts.sizes.md, fontWeight: Fonts.weights.extrabold, color: Colors.textOnDark },
  perkBlock: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  perkLabel: { fontSize: 10, color: Colors.textOnDarkFaint, fontWeight: Fonts.weights.semibold, letterSpacing: 0.3 },
  perkValue: { fontSize: Fonts.sizes.sm, color: Colors.textOnDark, fontWeight: Fonts.weights.extrabold },
  joinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: Radius.full, paddingHorizontal: 18, paddingVertical: 9,
  },
  joinBtnJoined: {
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.5)',
  },
  joinBtnText: { color: '#fff', fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.extrabold, letterSpacing: 0.3 },
  joinBtnTextJoined: { color: Colors.success },
});
