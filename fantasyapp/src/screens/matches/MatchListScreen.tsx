import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { useAuth } from '@/context/AuthContext';
import { getMatches } from '@/services/fantasy';
import MatchCard from '@/components/MatchCard';
import ScreenBackground from '@/components/ui/ScreenBackground';
import GlassCard from '@/components/ui/GlassCard';
import LivePulse from '@/components/ui/LivePulse';
import { Colors, Fonts, Spacing, Radius, Shadow, Gradients } from '@/utils/theme';

const TABS = [
  { id: 1 as const, label: 'Upcoming', icon: 'calendar-outline' as const },
  { id: 3 as const, label: 'Live',     icon: 'flash-outline'   as const },
  { id: 2 as const, label: 'Completed',icon: 'checkmark-done-outline' as const },
];

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function MatchListScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<1 | 2 | 3>(1);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMatches = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getMatches(activeTab);
      setMatches(res.data?.matches || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchMatches();
    timerRef.current = setInterval(() => fetchMatches(true), 5 * 60 * 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchMatches]);

  const walletTxt = useMemo(() => {
    const v = parseFloat((user?.balance as any) || 0);
    return v.toFixed(2);
  }, [user]);

  const liveCount = activeTab === 3 ? matches.length : 0;

  return (
    <ScreenBackground variant="night">
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {/* App Header — Hero */}
        <LinearGradient
          colors={['rgba(209,50,57,0.22)', 'rgba(0,0,0,0)']}
          style={styles.headerGradient}
        >
          <View style={styles.appHeader}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <LinearGradient colors={Gradients.cta} style={StyleSheet.absoluteFill} />
                <Text style={styles.brandEmoji}>🏏</Text>
              </View>
              <View>
                <Text style={styles.brandName}>Fantasy<Text style={{ color: Colors.accentGold }}>11</Text></Text>
                <Text style={styles.brandTag}>
                  {user ? `Hi ${user.name?.split(' ')[0] || 'Player'} 👋` : 'Play · Compete · Win'}
                </Text>
              </View>
            </View>

            {user ? (
              <Pressable
                onPress={() => {/* TODO wallet */}}
                style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
              >
                <GlassCard radius={Radius.full} intensity={60} tint="dark">
                  <View style={styles.walletPill}>
                    <View style={styles.walletIcon}>
                      <Ionicons name="wallet" size={13} color={Colors.accentGold} />
                    </View>
                    <View>
                      <Text style={styles.walletLabel}>BALANCE</Text>
                      <Text style={styles.walletValue}>₹{walletTxt}</Text>
                    </View>
                    <Ionicons name="add-circle" size={20} color={Colors.accentGold} />
                  </View>
                </GlassCard>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => navigation.navigate('Login')}
                style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
              >
                <LinearGradient
                  colors={Gradients.cta}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.loginBtn, Shadow.glow]}
                >
                  <Ionicons name="log-in-outline" size={16} color="#fff" />
                  <Text style={styles.loginBtnText}>Login</Text>
                </LinearGradient>
              </Pressable>
            )}
          </View>

          {/* Marquee stats */}
          <View style={styles.statsRow}>
            <StatChip icon="trophy" color={Colors.accentGold} label="₹50 Cr" sub="Won Daily" />
            <StatChip icon="people" color="#6CB9FF" label="2.5M+" sub="Players" />
            <StatChip icon="shield-checkmark" color={Colors.success} label="100%" sub="Secure" />
          </View>
        </LinearGradient>

        {/* Glass segmented tabs */}
        <View style={styles.tabsWrap}>
          <GlassCard radius={Radius.full} intensity={35} tint="dark">
            <View style={styles.tabBar}>
              {TABS.map(tab => {
                const active = activeTab === tab.id;
                return (
                  <Pressable
                    key={tab.id}
                    onPress={() => setActiveTab(tab.id)}
                    style={({ pressed }) => [
                      styles.tab,
                      { opacity: pressed ? 0.9 : 1 },
                    ]}
                  >
                    {active ? (
                      <LinearGradient
                        colors={Gradients.cta}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[StyleSheet.absoluteFill, { borderRadius: Radius.full }]}
                      />
                    ) : null}
                    <View style={styles.tabInner}>
                      {tab.id === 3 && active ? (
                        <LivePulse compact color="#fff" label="" />
                      ) : (
                        <Ionicons
                          name={tab.icon}
                          size={14}
                          color={active ? '#fff' : Colors.textOnDarkMuted}
                        />
                      )}
                      <Text style={[
                        styles.tabText,
                        active && styles.tabTextActive,
                      ]}>{tab.label}</Text>
                      {tab.id === 3 && liveCount > 0 && active && (
                        <View style={styles.tabBadge}>
                          <Text style={styles.tabBadgeText}>{liveCount}</Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </GlassCard>
        </View>

        {/* Match list */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={Colors.primaryLight} size="large" />
            <Text style={styles.loadingText}>Loading matches…</Text>
          </View>
        ) : matches.length === 0 ? (
          <View style={styles.centered}>
            <GlassCard radius={Radius.xl} tint="dark" padded style={{ alignItems: 'center', gap: 10, paddingVertical: 32 }}>
              <Text style={styles.emptyIcon}>🏏</Text>
              <Text style={styles.emptyTitle}>No matches yet</Text>
              <Text style={styles.emptySub}>
                No {TABS.find(t => t.id === activeTab)?.label.toLowerCase()} matches right now. Pull to refresh.
              </Text>
            </GlassCard>
          </View>
        ) : (
          <FlatList
            data={matches}
            keyExtractor={item => String(item._id || item.externalMatchId)}
            renderItem={({ item }) => (
              <MatchCard
                matchId={String(item._id)}
                title={item.title}
                competitionTitle={item.competitionTitle}
                format={item.format}
                teamA={item.teamA}
                teamB={item.teamB}
                startDate={item.startDate}
                status={item.status}
                contestCount={item.contestCount}
                onPress={() => navigation.navigate('MatchDetail', { matchId: String(item._id) })}
              />
            )}
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 110 }]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); fetchMatches(); }}
                tintColor={Colors.primaryLight}
                colors={[Colors.primaryLight]}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </ScreenBackground>
  );
}

function StatChip({ icon, color, label, sub }: { icon: any; color: string; label: string; sub: string }) {
  return (
    <View style={styles.statChip}>
      <View style={[styles.statIcon, { backgroundColor: color + '22', borderColor: color + '44' }]}>
        <Ionicons name={icon} size={13} color={color} />
      </View>
      <View>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statSub}>{sub}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerGradient: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.base,
  },
  appHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 42, height: 42, borderRadius: 14, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.glow,
  },
  brandEmoji: { fontSize: 22 },
  brandName: { color: '#fff', fontSize: Fonts.sizes.xl, fontWeight: Fonts.weights.black, letterSpacing: 0.5 },
  brandTag: { color: Colors.textOnDarkMuted, fontSize: Fonts.sizes.xs, fontWeight: Fonts.weights.semibold },
  walletPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  walletIcon: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,209,102,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,209,102,0.35)',
  },
  walletLabel: { color: Colors.textOnDarkFaint, fontSize: 9, fontWeight: Fonts.weights.bold, letterSpacing: 0.6 },
  walletValue: { color: '#fff', fontSize: Fonts.sizes.md, fontWeight: Fonts.weights.extrabold },
  loginBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 9,
  },
  loginBtnText: { color: '#fff', fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.extrabold },
  statsRow: {
    flexDirection: 'row', gap: 8, marginTop: 2, marginBottom: Spacing.sm,
  },
  statChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: Colors.glassBorder,
  },
  statIcon: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  statLabel: { color: '#fff', fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.extrabold },
  statSub: { color: Colors.textOnDarkFaint, fontSize: 9, fontWeight: Fonts.weights.semibold },
  tabsWrap: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  tabBar: { flexDirection: 'row', padding: 4 },
  tab: { flex: 1, borderRadius: Radius.full, overflow: 'hidden' },
  tabInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10,
  },
  tabText: {
    fontSize: Fonts.sizes.sm, color: Colors.textOnDarkMuted,
    fontWeight: Fonts.weights.bold, letterSpacing: 0.3,
  },
  tabTextActive: { color: '#fff' },
  tabBadge: {
    backgroundColor: 'rgba(255,255,255,0.28)',
    paddingHorizontal: 6, borderRadius: Radius.full, minWidth: 18, alignItems: 'center',
  },
  tabBadgeText: { color: '#fff', fontSize: 10, fontWeight: Fonts.weights.extrabold },
  list: { paddingTop: Spacing.sm },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.base },
  loadingText: { color: Colors.textOnDarkMuted, fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.semibold },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: Fonts.sizes.lg, color: '#fff', fontWeight: Fonts.weights.extrabold },
  emptySub: { fontSize: Fonts.sizes.sm, color: Colors.textOnDarkMuted, textAlign: 'center' },
});
