import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  ActivityIndicator, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { getMatchSquads } from '@/services/fantasy';
import ScreenBackground from '@/components/ui/ScreenBackground';
import GlassCard from '@/components/ui/GlassCard';
import GradientButton from '@/components/ui/GradientButton';
import { Colors, Fonts, Spacing, Radius, Shadow, Gradients } from '@/utils/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateTeam'>;

interface Player {
  playerId: number; name: string; shortName: string;
  role: string; teamId: number; teamName: string;
  credit: number; isPlaying11: boolean; image: string;
}

const ROLES = [
  { id: 'keeper',     label: 'WK',   min: 1, max: 4, color: '#C084FC' },
  { id: 'batsman',    label: 'BAT',  min: 3, max: 6, color: '#60A5FA' },
  { id: 'allrounder', label: 'AR',   min: 1, max: 4, color: '#FBBF24' },
  { id: 'bowler',     label: 'BOWL', min: 3, max: 6, color: '#34D399' },
] as const;

const MAX_PLAYERS = 11;
const MAX_PER_TEAM = 7;
const TOTAL_CREDITS = 100;

export default function CreateTeamScreen({ route, navigation }: Props) {
  const { matchId } = route.params;
  const insets = useSafeAreaInsets();
  const [squads, setSquads] = useState<Player[]>([]);
  const [teamA, setTeamA] = useState<any>(null);
  const [teamB, setTeamB] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>('keeper');
  const [selected, setSelected] = useState<Map<number, Player>>(new Map());

  useEffect(() => {
    getMatchSquads(matchId)
      .then(res => {
        setSquads(res.data?.squads || []);
        setTeamA(res.data?.teamA);
        setTeamB(res.data?.teamB);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [matchId]);

  const usedCredits = useMemo(() =>
    Array.from(selected.values()).reduce((s, p) => s + p.credit, 0), [selected]);

  const selectedByTeam = useMemo(() => {
    const c: Record<number, number> = {};
    for (const p of selected.values()) c[p.teamId] = (c[p.teamId] || 0) + 1;
    return c;
  }, [selected]);

  const selectedByRole = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of selected.values()) c[p.role] = (c[p.role] || 0) + 1;
    return c;
  }, [selected]);

  const canSelect = (p: Player): boolean => {
    if (selected.has(p.playerId)) return true;
    if (selected.size >= MAX_PLAYERS) return false;
    if ((selectedByTeam[p.teamId] || 0) >= MAX_PER_TEAM) return false;
    if (usedCredits + p.credit > TOTAL_CREDITS) return false;
    const cfg = ROLES.find(r => r.id === p.role);
    if (cfg && (selectedByRole[p.role] || 0) >= cfg.max) return false;
    return true;
  };

  const togglePlayer = (p: Player) => {
    setSelected(prev => {
      const next = new Map(prev);
      if (next.has(p.playerId)) next.delete(p.playerId);
      else if (canSelect(p)) next.set(p.playerId, p);
      return next;
    });
  };

  const filtered = useMemo(() =>
    squads
      .filter(p => p.role === roleFilter)
      .sort((a, b) => (a.isPlaying11 === b.isPlaying11 ? b.credit - a.credit : a.isPlaying11 ? -1 : 1)),
    [squads, roleFilter]);

  const allValid = useMemo(() => {
    for (const r of ROLES) {
      if ((selectedByRole[r.id] || 0) < r.min) return false;
    }
    return selected.size === MAX_PLAYERS;
  }, [selected.size, selectedByRole]);

  const handleNext = () => {
    navigation.navigate('CaptainSelect', {
      matchId, contestId: '',
      playerIds: Array.from(selected.keys()),
    });
  };

  if (loading) {
    return (
      <ScreenBackground variant="stadium">
        <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
          <ActivityIndicator color={Colors.primaryLight} size="large" />
          <Text style={styles.loadingText}>Loading squads…</Text>
        </View>
      </ScreenBackground>
    );
  }

  const creditPct = Math.min((usedCredits / TOTAL_CREDITS) * 100, 100);
  const creditLeft = Math.max(TOTAL_CREDITS - usedCredits, 0);

  return (
    <ScreenBackground variant="stadium">
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <GlassCard radius={Radius.full} intensity={35} tint="dark">
              <View style={styles.iconBtn}>
                <Ionicons name="arrow-back" size={20} color="#fff" />
              </View>
            </GlassCard>
          </Pressable>

          <View style={styles.centerTitle}>
            <Text style={styles.title}>Create Team</Text>
            <Text style={styles.subtitle}>
              {teamA?.short} vs {teamB?.short}
            </Text>
          </View>

          <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
            <GlassCard radius={Radius.full} intensity={35} tint="dark">
              <View style={styles.iconBtn}>
                <Ionicons name="information-circle-outline" size={20} color="#fff" />
              </View>
            </GlassCard>
          </Pressable>
        </View>

        {/* Stats hero */}
        <View style={styles.heroWrap}>
          <GlassCard radius={Radius.xl} intensity={40} tint="dark" padded style={Shadow.lifted}>
            <View style={styles.heroRow}>
              <HeroStat
                label="Players"
                value={`${selected.size}/${MAX_PLAYERS}`}
                icon="people"
                color={selected.size === MAX_PLAYERS ? Colors.success : '#6CB9FF'}
              />
              <View style={styles.heroDivider} />
              <HeroStat
                label="Credits Left"
                value={creditLeft.toFixed(1)}
                icon="diamond"
                color={creditLeft < 0 ? Colors.danger : Colors.accentGold}
              />
              <View style={styles.heroDivider} />
              <HeroStat
                label={teamA?.short || 'T1'}
                value={String(selectedByTeam[teamA?.id] || 0)}
                icon="flag"
                color="#FF6A5B"
              />
              <View style={styles.heroDivider} />
              <HeroStat
                label={teamB?.short || 'T2'}
                value={String(selectedByTeam[teamB?.id] || 0)}
                icon="flag"
                color="#6CB9FF"
              />
            </View>

            {/* Credit bar */}
            <View style={styles.creditBar}>
              <LinearGradient
                colors={creditPct > 95 ? ['#FF4D56', '#FFD166'] : ['#FFD166', '#FF8A5B']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[styles.creditFill, { width: `${creditPct}%` }]}
              />
            </View>
            <View style={styles.creditMeta}>
              <Text style={styles.creditMetaText}>
                {usedCredits.toFixed(1)} / {TOTAL_CREDITS} credits used
              </Text>
            </View>
          </GlassCard>
        </View>

        {/* Role progress chips */}
        <View style={styles.roleStrip}>
          {ROLES.map(r => {
            const count = selectedByRole[r.id] || 0;
            const low = count < r.min;
            return (
              <View key={r.id} style={[
                styles.rolePill,
                { borderColor: low ? 'rgba(220,53,69,0.5)' : r.color + '55', backgroundColor: low ? 'rgba(220,53,69,0.12)' : r.color + '14' },
              ]}>
                <Text style={[styles.rolePillCount, { color: low ? Colors.danger : '#fff' }]}>{count}</Text>
                <Text style={[styles.rolePillLabel, { color: r.color }]}>{r.label}</Text>
              </View>
            );
          })}
        </View>

        {/* Filter tabs */}
        <View style={styles.filterWrap}>
          <GlassCard radius={Radius.full} intensity={30} tint="dark">
            <View style={styles.filterRow}>
              {ROLES.map(r => {
                const active = roleFilter === r.id;
                const count = selectedByRole[r.id] || 0;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => setRoleFilter(r.id)}
                    style={({ pressed }) => [styles.filterTab, { opacity: pressed ? 0.85 : 1 }]}
                  >
                    {active && (
                      <LinearGradient
                        colors={[r.color, r.color + 'BB']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[StyleSheet.absoluteFill, { borderRadius: Radius.full }]}
                      />
                    )}
                    <View style={styles.filterInner}>
                      <Text style={[styles.filterText, active && styles.filterTextActive]}>{r.label}</Text>
                      <View style={[styles.filterCount, active && styles.filterCountActive]}>
                        <Text style={[styles.filterCountText, active && styles.filterCountTextActive]}>
                          {count}/{r.max}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </GlassCard>
        </View>

        {/* Player list */}
        <FlatList
          data={filtered}
          keyExtractor={p => String(p.playerId)}
          renderItem={({ item: p }) => {
            const isSelected = selected.has(p.playerId);
            const disabled = !isSelected && !canSelect(p);
            const roleColor = ROLES.find(r => r.id === p.role)?.color || '#fff';
            return (
              <Pressable
                style={({ pressed }) => [styles.playerRowWrap, { opacity: disabled ? 0.35 : pressed ? 0.92 : 1 }]}
                onPress={() => togglePlayer(p)}
                disabled={disabled && !isSelected}
              >
                <GlassCard
                  radius={Radius.lg}
                  tint="dark"
                  style={isSelected ? Shadow.glow : undefined}
                  bordered
                >
                  {isSelected && (
                    <LinearGradient
                      colors={['rgba(209,50,57,0.22)', 'rgba(209,50,57,0.06)']}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  <View style={styles.playerRow}>
                    <View style={[styles.playerAvatar, { borderColor: roleColor }]}>
                      {p.image ? (
                        <Image source={{ uri: p.image }} style={styles.playerImg} resizeMode="cover" />
                      ) : (
                        <Text style={styles.playerAvatarText}>{p.name?.slice(0, 1)}</Text>
                      )}
                      {p.isPlaying11 && <View style={styles.playing11Dot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.playerName}>{p.shortName || p.name}</Text>
                      <Text style={styles.playerTeam}>
                        {p.teamName} {p.isPlaying11 ? '· Playing XI' : ''}
                      </Text>
                    </View>
                    <View style={styles.creditBlock}>
                      <Text style={styles.creditValue}>{p.credit}</Text>
                      <Text style={styles.creditLabel}>Cr</Text>
                    </View>
                    <View style={[styles.selectDot, isSelected && styles.selectDotActive]}>
                      {isSelected ? (
                        <Ionicons name="checkmark" size={16} color="#fff" />
                      ) : (
                        <Ionicons name="add" size={16} color={Colors.textOnDarkMuted} />
                      )}
                    </View>
                  </View>
                </GlassCard>
              </Pressable>
            );
          }}
          contentContainerStyle={{ paddingBottom: 130 }}
          showsVerticalScrollIndicator={false}
        />

        {/* Footer CTA */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
          <LinearGradient
            colors={['rgba(10,12,20,0.1)', 'rgba(10,12,20,0.95)']}
            style={StyleSheet.absoluteFill}
          />
          <GradientButton
            label={
              selected.size < MAX_PLAYERS
                ? `Select ${MAX_PLAYERS - selected.size} more players`
                : 'Choose C & VC'
            }
            onPress={handleNext}
            disabled={!allValid}
            size="lg"
            fullWidth
            icon={<Ionicons name="arrow-forward-circle" size={18} color="#fff" />}
          />
        </View>
      </View>
    </ScreenBackground>
  );
}

function HeroStat({ label, value, icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <View style={heroStyles.wrap}>
      <View style={[heroStyles.icon, { backgroundColor: color + '22', borderColor: color + '44' }]}>
        <Ionicons name={icon} size={12} color={color} />
      </View>
      <Text style={heroStyles.value}>{value}</Text>
      <Text style={heroStyles.label} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center', gap: 10 },
  loadingText: { color: Colors.textOnDarkMuted, fontSize: Fonts.sizes.sm },

  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  centerTitle: { flex: 1, alignItems: 'center' },
  title: { color: '#fff', fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.extrabold },
  subtitle: { color: Colors.textOnDarkMuted, fontSize: Fonts.sizes.xs, fontWeight: Fonts.weights.bold, marginTop: 1, letterSpacing: 0.5 },

  heroWrap: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroDivider: { width: 1, height: 28, backgroundColor: Colors.glassBorder },

  creditBar: {
    height: 6, borderRadius: 3, marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden',
  },
  creditFill: { height: 6, borderRadius: 3 },
  creditMeta: { alignItems: 'center', marginTop: 6 },
  creditMetaText: { color: Colors.textOnDarkFaint, fontSize: Fonts.sizes.xs, fontWeight: Fonts.weights.semibold, letterSpacing: 0.3 },

  roleStrip: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: Spacing.base, paddingBottom: 4,
  },
  rolePill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 6, borderRadius: Radius.full,
    borderWidth: 1,
  },
  rolePillCount: { fontSize: Fonts.sizes.md, fontWeight: Fonts.weights.black },
  rolePillLabel: { fontSize: 10, fontWeight: Fonts.weights.extrabold, letterSpacing: 0.6 },

  filterWrap: { paddingHorizontal: Spacing.base, paddingTop: Spacing.sm, paddingBottom: Spacing.sm },
  filterRow: { flexDirection: 'row', padding: 4 },
  filterTab: {
    flex: 1, borderRadius: Radius.full, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  filterInner: { alignItems: 'center', paddingVertical: 8, gap: 2 },
  filterText: {
    fontSize: Fonts.sizes.sm, color: Colors.textOnDarkMuted,
    fontWeight: Fonts.weights.extrabold, letterSpacing: 0.3,
  },
  filterTextActive: { color: '#fff' },
  filterCount: {
    paddingHorizontal: 6, borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  filterCountActive: { backgroundColor: 'rgba(255,255,255,0.28)' },
  filterCountText: { fontSize: 9, color: Colors.textOnDarkFaint, fontWeight: Fonts.weights.bold },
  filterCountTextActive: { color: '#fff' },

  playerRowWrap: { marginHorizontal: Spacing.base, marginBottom: 8 },
  playerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 10,
  },
  playerAvatar: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 2, overflow: 'hidden',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  playerImg: { width: 40, height: 40, borderRadius: 20 },
  playerAvatarText: { fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.black, color: '#fff' },
  playing11Dot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.success, borderWidth: 1.5, borderColor: Colors.bgDeep,
  },
  playerName: { fontSize: Fonts.sizes.md, fontWeight: Fonts.weights.extrabold, color: '#fff' },
  playerTeam: { fontSize: Fonts.sizes.xs, color: Colors.textOnDarkMuted, marginTop: 2, fontWeight: Fonts.weights.semibold },
  creditBlock: { alignItems: 'center', minWidth: 40 },
  creditValue: { fontSize: Fonts.sizes.md, fontWeight: Fonts.weights.black, color: Colors.accentGold },
  creditLabel: { fontSize: 9, color: Colors.textOnDarkFaint, fontWeight: Fonts.weights.bold, letterSpacing: 0.3 },
  selectDot: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.glassBorder,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  selectDotActive: { backgroundColor: Colors.primary, borderColor: Colors.primaryLight },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingTop: Spacing.md, paddingHorizontal: Spacing.base,
  },
});

const heroStyles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 6 },
  icon: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  value: { color: '#fff', fontSize: Fonts.sizes.md, fontWeight: Fonts.weights.black },
  label: { color: Colors.textOnDarkFaint, fontSize: 9, fontWeight: Fonts.weights.bold, letterSpacing: 0.4 },
});
