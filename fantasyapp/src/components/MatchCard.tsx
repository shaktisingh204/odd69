import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from './ui/GlassCard';
import LivePulse from './ui/LivePulse';
import { Colors, Fonts, Radius, Spacing, Shadow } from '@/utils/theme';

interface Team { name: string; short: string; logo?: string; thumb?: string; color?: string; }
interface Props {
  matchId: string;
  title: string;
  competitionTitle: string;
  format: string;
  teamA: Team;
  teamB: Team;
  startDate: string;
  status: number;
  contestCount?: number;
  onPress: () => void;
}

function useCountdown(startDate: string) {
  const [label, setLabel] = useState('');
  const [urgency, setUrgency] = useState<'soon' | 'normal'>('normal');
  useEffect(() => {
    const tick = () => {
      const diff = new Date(startDate).getTime() - Date.now();
      if (diff <= 0) { setLabel('Started'); setUrgency('soon'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setUrgency(h < 1 ? 'soon' : 'normal');
      if (h > 24) setLabel(`${Math.floor(h / 24)}d ${h % 24}h`);
      else if (h > 0) setLabel(`${h}h ${m}m`);
      else setLabel(`${m}m ${String(s).padStart(2, '0')}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startDate]);
  return { label, urgency };
}

function TeamBadge({ team, align = 'left' }: { team: Team; align?: 'left' | 'right' }) {
  return (
    <View style={[styles.teamCol, align === 'right' && { alignItems: 'flex-end' }]}>
      <View style={styles.logoWrap}>
        <LinearGradient
          colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.02)']}
          style={styles.logoRing}
        />
        {team.logo || team.thumb ? (
          <Image source={{ uri: team.logo || team.thumb }} style={styles.logoImg} resizeMode="contain" />
        ) : (
          <Text style={styles.logoFallback}>{team.short?.slice(0, 2)}</Text>
        )}
      </View>
      <Text style={styles.teamName} numberOfLines={1}>{team.short || team.name}</Text>
    </View>
  );
}

export default function MatchCard({
  title, competitionTitle, format, teamA, teamB, startDate, status, contestCount, onPress,
}: Props) {
  const { label: countdown, urgency } = useCountdown(startDate);
  const isLive = status === 3;
  const isCompleted = status === 2;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.cardWrap,
        Shadow.lifted,
        { transform: [{ scale: pressed ? 0.985 : 1 }] },
      ]}
    >
      <GlassCard radius={Radius.xl} intensity={50} tint="dark" bordered>
        {/* top strip */}
        <View style={styles.topRow}>
          <View style={styles.compWrap}>
            <Ionicons name="trophy-outline" size={12} color={Colors.accentGold} />
            <Text style={styles.competition} numberOfLines={1}>{competitionTitle}</Text>
          </View>
          <View style={styles.formatBadge}>
            <Text style={styles.formatText}>{format}</Text>
          </View>
        </View>

        {/* Teams row */}
        <View style={styles.teamsRow}>
          <TeamBadge team={teamA} align="left" />

          <View style={styles.center}>
            {isLive ? (
              <LivePulse />
            ) : isCompleted ? (
              <View style={styles.completedPill}>
                <Text style={styles.completedText}>ENDED</Text>
              </View>
            ) : (
              <LinearGradient
                colors={urgency === 'soon' ? ['#FF4D56', '#D13239'] : ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.04)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.countdownPill, urgency === 'soon' && Shadow.glow]}
              >
                <Ionicons name="time-outline" size={12} color="#fff" />
                <Text style={styles.countdownText}>{countdown}</Text>
              </LinearGradient>
            )}
            <Text style={styles.vsText}>VS</Text>
          </View>

          <TeamBadge team={teamB} align="right" />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>
              {contestCount !== undefined ? `${contestCount} Contests` : 'Mega Contests'}
            </Text>
            <View style={styles.metaRow}>
              <View style={styles.miniPill}>
                <Ionicons name="cash-outline" size={10} color={Colors.accentGold} />
                <Text style={styles.miniPillText}>Cash</Text>
              </View>
              <View style={styles.miniPill}>
                <Ionicons name="gift-outline" size={10} color={Colors.accent} />
                <Text style={styles.miniPillText}>Rewards</Text>
              </View>
            </View>
          </View>

          <LinearGradient
            colors={isLive ? ['#22C55E', '#15803D'] : ['#FF6A5B', '#D13239']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.joinBtn, Shadow.glow]}
          >
            <Text style={styles.joinBtnText}>
              {isLive ? 'Live Scores' : isCompleted ? 'View Result' : 'Join Now'}
            </Text>
            <Ionicons name="arrow-forward" size={14} color="#fff" />
          </LinearGradient>
        </View>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.md,
  },
  topRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  compWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  competition: {
    flex: 1, fontSize: Fonts.sizes.xs, color: Colors.textOnDarkMuted,
    fontWeight: Fonts.weights.semibold, letterSpacing: 0.3, textTransform: 'uppercase',
  },
  formatBadge: {
    backgroundColor: 'rgba(255,209,102,0.18)',
    borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(255,209,102,0.35)',
  },
  formatText: {
    fontSize: Fonts.sizes.xs, color: Colors.accentGold,
    fontWeight: Fonts.weights.extrabold, letterSpacing: 0.5,
  },
  teamsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.base + 2,
  },
  teamCol: { flex: 1, alignItems: 'flex-start', gap: 8 },
  logoWrap: {
    width: 62, height: 62, borderRadius: 31, justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden', borderWidth: 1, borderColor: Colors.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  logoRing: { ...StyleSheet.absoluteFillObject, borderRadius: 31 },
  logoImg: { width: 44, height: 44, borderRadius: 22 },
  logoFallback: {
    fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.black,
    color: '#fff', letterSpacing: 1,
  },
  teamName: {
    fontSize: Fonts.sizes.md, fontWeight: Fonts.weights.extrabold,
    color: Colors.textOnDark, letterSpacing: 0.5,
  },
  center: { alignItems: 'center', paddingHorizontal: Spacing.md, gap: 6, minWidth: 80 },
  countdownPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5,
  },
  countdownText: {
    fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.extrabold,
    color: '#fff', letterSpacing: 0.3,
  },
  completedPill: {
    borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: Colors.glassBorder,
  },
  completedText: {
    color: Colors.textOnDarkMuted, fontSize: Fonts.sizes.xs,
    fontWeight: Fonts.weights.bold, letterSpacing: 0.5,
  },
  vsText: {
    fontSize: Fonts.sizes.xs, color: Colors.textOnDarkFaint,
    fontWeight: Fonts.weights.bold, letterSpacing: 1.5,
  },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  metaCol: { flex: 1, gap: 4 },
  metaLabel: {
    fontSize: Fonts.sizes.sm, color: Colors.textOnDark,
    fontWeight: Fonts.weights.semibold,
  },
  metaRow: { flexDirection: 'row', gap: 6, marginTop: 2 },
  miniPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: Radius.full, backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  miniPillText: { fontSize: 9, color: Colors.textOnDarkMuted, fontWeight: Fonts.weights.bold, letterSpacing: 0.3 },
  joinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 9,
  },
  joinBtnText: { color: '#fff', fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.extrabold, letterSpacing: 0.3 },
});
