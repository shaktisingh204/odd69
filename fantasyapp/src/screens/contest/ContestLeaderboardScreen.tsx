import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { getContestLeaderboard } from '@/services/fantasy';
import ScreenBackground from '@/components/ui/ScreenBackground';
import GlassCard from '@/components/ui/GlassCard';
import { Colors, Fonts, Spacing, Radius, Shadow, Gradients } from '@/utils/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ContestLeaderboard'>;

function formatMoney(n: number) {
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `${n}`;
}

export default function ContestLeaderboardScreen({ route, navigation }: Props) {
  const { contestId } = route.params;
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<any[]>([]);
  const [contest, setContest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchPage = async (p: number) => {
    try {
      const res = await getContestLeaderboard(contestId, p);
      const data = res.data;
      setContest(data.contest);
      const newEntries: any[] = data.entries || [];
      setEntries(prev => p === 1 ? newEntries : [...prev, ...newEntries]);
      setHasMore(newEntries.length === 20);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPage(1); }, [contestId]);

  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);

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

          <View style={styles.titleBlock}>
            <Text style={styles.title} numberOfLines={1}>{contest?.title || 'Leaderboard'}</Text>
            <Text style={styles.sub}>Contest Rankings</Text>
          </View>

          <View style={{ width: 40 }} />
        </View>

        {/* Prize hero */}
        {contest && (
          <View style={styles.heroWrap}>
            <GlassCard radius={Radius.xl} intensity={40} tint="dark" padded style={Shadow.lifted}>
              <LinearGradient
                colors={['rgba(255,209,102,0.16)', 'rgba(255,138,91,0.04)']}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.heroRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroLabel}>PRIZE POOL</Text>
                  <LinearGradient
                    colors={Gradients.gold}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.heroPrizePill}
                  >
                    <Text style={styles.heroPrize}>₹{formatMoney(contest.totalPrize || 0)}</Text>
                  </LinearGradient>
                </View>
                <View style={styles.heroStats}>
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatValue}>{entries.length}</Text>
                    <Text style={styles.heroStatLabel}>Entries</Text>
                  </View>
                  <View style={styles.heroDivider} />
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatValue}>
                      {contest.prizeBreakdown?.length || 0}
                    </Text>
                    <Text style={styles.heroStatLabel}>Winners</Text>
                  </View>
                </View>
              </View>
            </GlassCard>
          </View>
        )}

        {loading ? (
          <View style={styles.centered}><ActivityIndicator color={Colors.primaryLight} size="large" /></View>
        ) : entries.length === 0 ? (
          <View style={styles.centered}>
            <GlassCard radius={Radius.xl} tint="dark" padded style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Text style={{ fontSize: 54 }}>🏆</Text>
              <Text style={styles.emptyTitle}>No entries yet</Text>
              <Text style={styles.emptySub}>Be the first to join!</Text>
            </GlassCard>
          </View>
        ) : (
          <>
            {/* Podium */}
            {podium.length > 0 && (
              <View style={styles.podiumWrap}>
                {podium[1] && <PodiumCard place={2} entry={podium[1]} />}
                {podium[0] && <PodiumCard place={1} entry={podium[0]} tall />}
                {podium[2] && <PodiumCard place={3} entry={podium[2]} />}
              </View>
            )}

            <FlatList
              data={rest}
              keyExtractor={(e, i) => e._id || String(i)}
              ListHeaderComponent={
                rest.length > 0 ? (
                  <View style={styles.listHeader}>
                    <Text style={[styles.colHead, { flex: 0.6 }]}>Rank</Text>
                    <Text style={[styles.colHead, { flex: 1 }]}>Player</Text>
                    <Text style={[styles.colHead, { textAlign: 'right', width: 60 }]}>Points</Text>
                    <Text style={[styles.colHead, { textAlign: 'right', width: 70 }]}>Prize</Text>
                  </View>
                ) : null
              }
              renderItem={({ item: e }) => <LeaderboardRow entry={e} />}
              onEndReached={() => {
                if (hasMore && !loading) {
                  const nextPage = page + 1;
                  setPage(nextPage);
                  fetchPage(nextPage);
                }
              }}
              onEndReachedThreshold={0.3}
              contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
              showsVerticalScrollIndicator={false}
            />
          </>
        )}
      </View>
    </ScreenBackground>
  );
}

function PodiumCard({ place, entry, tall }: { place: number; entry: any; tall?: boolean }) {
  const colors: [string, string] =
    place === 1 ? ['#FFD166', '#FF8A5B']
    : place === 2 ? ['#C7D2E8', '#8A98B8']
    : ['#E8A37D', '#B77652'];
  const height = tall ? 134 : 110;

  return (
    <View style={[podium.wrap, tall && podium.tall]}>
      <View style={[podium.avatarWrap, tall && podium.avatarWrapTall]}>
        <LinearGradient colors={colors} style={StyleSheet.absoluteFill} />
        <View style={podium.avatarInner}>
          <Text style={[podium.avatarInitial, tall && { fontSize: 22 }]}>
            {(entry.userName || '?').slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View style={[podium.medal, { backgroundColor: colors[0] }]}>
          <Text style={podium.medalText}>{place}</Text>
        </View>
      </View>
      <Text style={podium.name} numberOfLines={1}>{entry.userName || 'Player'}</Text>
      <Text style={podium.points}>{entry.totalPoints?.toFixed(1) ?? '—'} pts</Text>
      <LinearGradient colors={colors} style={[podium.bar, { height }]}>
        {entry.prize > 0 && (
          <Text style={podium.prize}>₹{formatMoney(entry.prize)}</Text>
        )}
      </LinearGradient>
    </View>
  );
}

function LeaderboardRow({ entry: e }: { entry: any }) {
  const won = e.prize > 0;
  return (
    <View style={styles.rowWrap}>
      <GlassCard
        radius={Radius.lg}
        tint="dark"
        bordered
        style={e.isMe ? Shadow.glow : undefined}
      >
        {e.isMe && (
          <LinearGradient
            colors={['rgba(209,50,57,0.25)', 'rgba(209,50,57,0.04)']}
            style={StyleSheet.absoluteFill}
          />
        )}
        <View style={styles.row}>
          <View style={[styles.rankPill, e.isMe && { borderColor: Colors.primaryLight }]}>
            <Text style={styles.rankText}>#{e.rank ?? '—'}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.player} numberOfLines={1}>
              {e.userName || e.userId}{e.isMe ? ' · You' : ''}
            </Text>
            <Text style={styles.teamLabel}>Team {e.teamNumber || 1}</Text>
          </View>
          <Text style={styles.pts}>{e.totalPoints?.toFixed(1) ?? '—'}</Text>
          <Text style={[styles.prize, won && styles.prizeWon]}>
            {won ? `₹${formatMoney(e.prize)}` : '—'}
          </Text>
        </View>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.base },

  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  titleBlock: { flex: 1, alignItems: 'center' },
  title: { color: '#fff', fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.extrabold },
  sub: { color: Colors.textOnDarkMuted, fontSize: Fonts.sizes.xs, marginTop: 1, fontWeight: Fonts.weights.semibold },

  heroWrap: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroLabel: { color: Colors.textOnDarkFaint, fontSize: 10, fontWeight: Fonts.weights.bold, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 },
  heroPrizePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.full,
    ...Shadow.glowGold,
  },
  heroPrize: { color: '#1A0F00', fontSize: Fonts.sizes.xl, fontWeight: Fonts.weights.black, letterSpacing: 0.3 },
  heroStats: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingLeft: 14,
    borderLeftWidth: 1, borderLeftColor: Colors.glassBorder,
  },
  heroStat: { alignItems: 'center', minWidth: 52 },
  heroStatValue: { color: '#fff', fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.black },
  heroStatLabel: { color: Colors.textOnDarkFaint, fontSize: 10, fontWeight: Fonts.weights.bold, letterSpacing: 0.4 },
  heroDivider: { width: 1, height: 26, backgroundColor: Colors.glassBorder },

  listHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    marginHorizontal: Spacing.base, marginBottom: 6,
  },
  colHead: { color: Colors.textOnDarkFaint, fontSize: 10, fontWeight: Fonts.weights.black, letterSpacing: 0.8, textTransform: 'uppercase' },

  podiumWrap: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center',
    gap: 8, paddingHorizontal: Spacing.base, paddingVertical: Spacing.base,
  },

  rowWrap: { paddingHorizontal: Spacing.base, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 10 },
  rankPill: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: Colors.glassBorder,
    minWidth: 50, alignItems: 'center',
  },
  rankText: { color: '#fff', fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.extrabold, letterSpacing: 0.3 },
  player: { color: '#fff', fontSize: Fonts.sizes.md, fontWeight: Fonts.weights.extrabold },
  teamLabel: { color: Colors.textOnDarkMuted, fontSize: Fonts.sizes.xs, marginTop: 2, fontWeight: Fonts.weights.semibold },
  pts: { color: Colors.accentGold, fontSize: Fonts.sizes.md, fontWeight: Fonts.weights.black, width: 60, textAlign: 'right' },
  prize: { color: Colors.textOnDarkFaint, fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.bold, width: 70, textAlign: 'right' },
  prizeWon: { color: Colors.success, fontWeight: Fonts.weights.black },

  emptyTitle: { color: '#fff', fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.extrabold, marginTop: 8 },
  emptySub: { color: Colors.textOnDarkMuted, fontSize: Fonts.sizes.sm, marginTop: 4 },
});

const podium = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', gap: 6 },
  tall: { marginBottom: 12 },
  avatarWrap: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', ...Shadow.glow,
  },
  avatarWrapTall: { width: 68, height: 68, borderRadius: 34 },
  avatarInner: {
    width: '84%', height: '84%', borderRadius: 999,
    backgroundColor: 'rgba(10,12,20,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { color: '#fff', fontSize: Fonts.sizes.xl, fontWeight: Fonts.weights.black },
  medal: {
    position: 'absolute', bottom: -4, right: -4,
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.bgDeep,
  },
  medalText: { color: '#1A0F00', fontSize: 11, fontWeight: Fonts.weights.black },
  name: { color: '#fff', fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.extrabold, textAlign: 'center' },
  points: { color: Colors.textOnDarkMuted, fontSize: 10, fontWeight: Fonts.weights.bold },
  bar: {
    width: '100%', borderTopLeftRadius: 10, borderTopRightRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
  },
  prize: { color: '#1A0F00', fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.black },
});
