import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { useAuth } from '@/context/AuthContext';
import { getHistory } from '@/services/fantasy';
import ScreenBackground from '@/components/ui/ScreenBackground';
import GlassCard from '@/components/ui/GlassCard';
import GradientButton from '@/components/ui/GradientButton';
import { Colors, Fonts, Spacing, Radius, Shadow, Gradients } from '@/utils/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type FilterKey = 'all' | 'won' | 'lost' | 'pending';

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');

  const fetchHistory = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const res = await getHistory();
      setEntries(res.data?.entries || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const filtered = useMemo(() => {
    if (filter === 'all') return entries;
    return entries.filter(e => {
      if (filter === 'won') return e.prize > 0;
      if (filter === 'lost') return e.status === 'settled' && !e.prize;
      return e.status !== 'settled';
    });
  }, [entries, filter]);

  const stats = useMemo(() => {
    const played = entries.length;
    const won = entries.filter(e => e.prize > 0).length;
    const totalWon = entries.reduce((s, e) => s + (e.prize || 0), 0);
    return { played, won, totalWon };
  }, [entries]);

  if (!user) {
    return (
      <ScreenBackground variant="night">
        <View style={[styles.root, styles.guestWrap, { paddingTop: insets.top }]}>
          <View style={styles.guestIcon}>
            <LinearGradient colors={Gradients.cta} style={StyleSheet.absoluteFill} />
            <Ionicons name="time" size={36} color="#fff" />
          </View>
          <Text style={styles.guestTitle}>See your game history</Text>
          <Text style={styles.guestSub}>Log in to track matches, wins and ranks</Text>
          <GradientButton
            label="Log In"
            onPress={() => navigation.navigate('Login')}
            icon={<Ionicons name="log-in-outline" size={16} color="#fff" />}
            size="lg"
            style={{ minWidth: 200, marginTop: 8 }}
          />
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground variant="night">
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {/* Header */}
        <LinearGradient
          colors={['rgba(209,50,57,0.25)', 'rgba(0,0,0,0)']}
          style={styles.headerGradient}
        >
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>My Matches</Text>
            <View style={styles.headerIcon}>
              <Ionicons name="stats-chart" size={16} color={Colors.accentGold} />
            </View>
          </View>

          <View style={styles.statsRow}>
            <StatBlock label="Played" value={String(stats.played)} icon="game-controller" color="#6CB9FF" />
            <StatBlock label="Won" value={String(stats.won)} icon="trophy" color={Colors.accentGold} />
            <StatBlock label="Earned" value={`₹${stats.totalWon}`} icon="cash" color={Colors.success} />
          </View>
        </LinearGradient>

        {/* Filter tabs */}
        <View style={styles.filterWrap}>
          <GlassCard radius={Radius.full} intensity={30} tint="dark">
            <View style={styles.filterRow}>
              {(['all', 'won', 'lost', 'pending'] as FilterKey[]).map(f => {
                const active = filter === f;
                return (
                  <Pressable
                    key={f}
                    onPress={() => setFilter(f)}
                    style={({ pressed }) => [styles.filterTab, { opacity: pressed ? 0.8 : 1 }]}
                  >
                    {active && (
                      <LinearGradient
                        colors={Gradients.cta}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[StyleSheet.absoluteFill, { borderRadius: Radius.full }]}
                      />
                    )}
                    <Text style={[styles.filterText, active && styles.filterTextActive]}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </GlassCard>
        </View>

        {/* List */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={Colors.primaryLight} size="large" />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(e, i) => e._id || String(i)}
            renderItem={({ item: e }) => <HistoryEntry entry={e} onPress={() => navigation.navigate('MatchDetail', { matchId: String(e.matchId) })} />}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <GlassCard radius={Radius.xl} tint="dark" padded style={{ alignItems: 'center', paddingVertical: 36 }}>
                  <Text style={{ fontSize: 54 }}>📋</Text>
                  <Text style={styles.emptyTitle}>Nothing here yet</Text>
                  <Text style={styles.emptySub}>Join your first contest to see history</Text>
                </GlassCard>
              </View>
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); fetchHistory(); }}
                tintColor={Colors.primaryLight}
                colors={[Colors.primaryLight]}
              />
            }
            contentContainerStyle={{ paddingVertical: Spacing.sm, paddingBottom: insets.bottom + 100 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </ScreenBackground>
  );
}

function StatBlock({ label, value, icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <View style={styles.statBlock}>
      <GlassCard radius={Radius.lg} intensity={30} tint="dark" padded style={styles.statInner}>
        <View style={[styles.statIcon, { backgroundColor: color + '22', borderColor: color + '44' }]}>
          <Ionicons name={icon} size={13} color={color} />
        </View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </GlassCard>
    </View>
  );
}

function HistoryEntry({ entry: e, onPress }: { entry: any; onPress: () => void }) {
  const won = e.prize > 0;
  const settled = e.status === 'settled';
  const pending = !settled;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.entryWrap, { transform: [{ scale: pressed ? 0.99 : 1 }] }]}
    >
      <GlassCard radius={Radius.lg} tint="dark" padded style={styles.entryCard}>
        <View style={styles.entryTopRow}>
          <View style={[
            styles.statusDot,
            {
              backgroundColor: won ? Colors.success : pending ? Colors.accentGold : Colors.danger,
              shadowColor: won ? Colors.success : pending ? Colors.accentGold : Colors.danger,
            },
          ]} />
          <Text style={styles.matchTitle} numberOfLines={1}>{e.matchTitle || 'Match'}</Text>
          <Text style={styles.dateText}>
            {e.createdAt ? new Date(e.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''}
          </Text>
        </View>
        <Text style={styles.contestTitle} numberOfLines={1}>{e.contestTitle || 'Contest'}</Text>

        <View style={styles.entryFoot}>
          <View style={styles.rankChip}>
            <Ionicons name="trophy-outline" size={11} color={Colors.accentGold} />
            <Text style={styles.rankText}>{e.rank ? `Rank #${e.rank}` : 'Awaiting'}</Text>
          </View>
          <View style={[
            styles.prizeChip,
            {
              backgroundColor: won
                ? 'rgba(34,197,94,0.16)'
                : pending
                  ? 'rgba(255,209,102,0.14)'
                  : 'rgba(255,255,255,0.05)',
              borderColor: won
                ? 'rgba(34,197,94,0.4)'
                : pending
                  ? 'rgba(255,209,102,0.3)'
                  : Colors.glassBorder,
            },
          ]}>
            <Text style={[
              styles.prizeText,
              { color: won ? Colors.success : pending ? Colors.accentGold : Colors.textOnDarkMuted },
            ]}>
              {won ? `+₹${e.prize}` : pending ? 'Pending' : 'Lost'}
            </Text>
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  guestWrap: { justifyContent: 'center', alignItems: 'center', gap: 10, padding: Spacing.lg },
  guestIcon: {
    width: 80, height: 80, borderRadius: 40,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    ...Shadow.glow, marginBottom: 10,
  },
  guestTitle: { color: '#fff', fontSize: Fonts.sizes.xxl, fontWeight: Fonts.weights.black },
  guestSub: { color: Colors.textOnDarkMuted, fontSize: Fonts.sizes.md, textAlign: 'center' },

  headerGradient: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.base },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Spacing.sm, paddingBottom: Spacing.base,
  },
  headerTitle: { color: '#fff', fontSize: Fonts.sizes.xxl, fontWeight: Fonts.weights.black },
  headerIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,209,102,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,209,102,0.3)',
  },
  statsRow: { flexDirection: 'row', gap: 8 },
  statBlock: { flex: 1 },
  statInner: { alignItems: 'flex-start', gap: 4, padding: 10 },
  statIcon: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  statValue: { color: '#fff', fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.black },
  statLabel: { color: Colors.textOnDarkFaint, fontSize: 10, fontWeight: Fonts.weights.bold, letterSpacing: 0.4 },

  filterWrap: { paddingHorizontal: Spacing.base, paddingTop: 2, paddingBottom: Spacing.sm },
  filterRow: { flexDirection: 'row', padding: 4 },
  filterTab: {
    flex: 1, paddingVertical: 8, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  filterText: {
    fontSize: Fonts.sizes.xs, color: Colors.textOnDarkMuted,
    fontWeight: Fonts.weights.extrabold, letterSpacing: 0.3,
  },
  filterTextActive: { color: '#fff' },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { paddingHorizontal: Spacing.base, paddingTop: 60 },
  emptyTitle: { color: '#fff', fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.extrabold, marginTop: 8 },
  emptySub: { color: Colors.textOnDarkMuted, fontSize: Fonts.sizes.sm, marginTop: 4 },

  entryWrap: { paddingHorizontal: Spacing.base, marginBottom: Spacing.sm },
  entryCard: { padding: Spacing.base, gap: 6 },
  entryTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: {
    width: 8, height: 8, borderRadius: 4,
    shadowOpacity: 0.5, shadowRadius: 4, shadowOffset: { width: 0, height: 0 }, elevation: 2,
  },
  matchTitle: { flex: 1, color: '#fff', fontSize: Fonts.sizes.md, fontWeight: Fonts.weights.extrabold },
  dateText: { color: Colors.textOnDarkFaint, fontSize: Fonts.sizes.xs, fontWeight: Fonts.weights.bold },
  contestTitle: { color: Colors.textOnDarkMuted, fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.semibold, marginLeft: 16 },
  entryFoot: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 6, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  rankChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: Colors.glassBorder,
  },
  rankText: { color: Colors.textOnDark, fontSize: Fonts.sizes.xs, fontWeight: Fonts.weights.bold },
  prizeChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.full,
    borderWidth: 1,
  },
  prizeText: { fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.extrabold, letterSpacing: 0.3 },
});
