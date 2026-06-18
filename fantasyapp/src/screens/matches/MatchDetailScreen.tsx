import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Alert, ActivityIndicator, Image, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { useAuth } from '@/context/AuthContext';
import { getMatch, getMatchContests, getMyTeams, getHistory } from '@/services/fantasy';
import ContestCard from '@/components/ContestCard';
import ScreenBackground from '@/components/ui/ScreenBackground';
import GlassCard from '@/components/ui/GlassCard';
import LivePulse from '@/components/ui/LivePulse';
import GradientButton from '@/components/ui/GradientButton';
import { Colors, Fonts, Spacing, Radius, Shadow, Gradients } from '@/utils/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'MatchDetail'>;

const TABS = [
  { id: 'Contests'  as const, icon: 'trophy-outline'   as const },
  { id: 'My Teams'  as const, icon: 'people-outline'   as const },
  { id: 'Winnings'  as const, icon: 'cash-outline'     as const },
];
type Tab = typeof TABS[number]['id'];

function useCountdown(start?: string) {
  const [txt, setTxt] = useState('');
  useEffect(() => {
    if (!start) return;
    const tick = () => {
      const diff = new Date(start).getTime() - Date.now();
      if (diff <= 0) { setTxt('Starting now'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (h > 24) setTxt(`${Math.floor(h / 24)}d ${h % 24}h ${m}m`);
      else if (h > 0) setTxt(`${h}h ${m}m ${String(s).padStart(2, '0')}s`);
      else setTxt(`${m}m ${String(s).padStart(2, '0')}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [start]);
  return txt;
}

export default function MatchDetailScreen({ route, navigation }: Props) {
  const { matchId } = route.params;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('Contests');
  const [match, setMatch] = useState<any>(null);
  const [contests, setContests] = useState<any[]>([]);
  const [myTeams, setMyTeams] = useState<any[]>([]);
  const [myEntries, setMyEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [matchRes, contestsRes, teamsRes, historyRes] = await Promise.all([
        getMatch(matchId),
        getMatchContests(matchId),
        user ? getMyTeams(matchId).catch(() => null) : null,
        user ? getHistory().catch(() => null) : null,
      ]);
      setMatch(matchRes.data);
      setContests(contestsRes.data || []);
      if (teamsRes?.data) setMyTeams(teamsRes.data);
      if (historyRes?.data?.entries) {
        setMyEntries(historyRes.data.entries.filter((e: any) => String(e.matchId) === matchId));
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [matchId, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const joinedContestIds = useMemo(() => new Set(myEntries.map((e: any) => e.contestId)), [myEntries]);
  const countdown = useCountdown(match?.startDate);

  const handleJoin = useCallback(async (contestId: string) => {
    if (!user) { navigation.navigate('Login'); return; }
    if (myTeams.length === 0) {
      Alert.alert('No Team', 'Create a team first', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Create Team', onPress: () => navigation.navigate('CreateTeam', { matchId }) },
      ]);
      return;
    }
    const team = myTeams[0];
    navigation.navigate('CaptainSelect', {
      matchId, contestId,
      playerIds: team.playerIds, existingTeamId: team._id,
    });
  }, [user, myTeams, matchId, navigation]);

  const isUpcoming = match?.status === 1;
  const isLive = match?.status === 3;

  if (loading) {
    return (
      <ScreenBackground variant="stadium">
        <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
          <ActivityIndicator color={Colors.primaryLight} size="large" />
          <Text style={styles.loadingText}>Loading match…</Text>
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground variant="stadium">
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <GlassCard radius={Radius.full} intensity={40} tint="dark">
              <View style={styles.iconBtn}>
                <Ionicons name="arrow-back" size={20} color="#fff" />
              </View>
            </GlassCard>
          </Pressable>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.topTitle} numberOfLines={1}>{match?.title || 'Match'}</Text>
            <Text style={styles.topSub} numberOfLines={1}>{match?.competitionTitle}</Text>
          </View>

          <Pressable
            onPress={() => {/* share */}}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <GlassCard radius={Radius.full} intensity={40} tint="dark">
              <View style={styles.iconBtn}>
                <Ionicons name="share-outline" size={18} color="#fff" />
              </View>
            </GlassCard>
          </Pressable>
        </View>

        {/* Hero banner */}
        {match && (
          <View style={styles.heroWrap}>
            <LinearGradient
              colors={['rgba(209,50,57,0.35)', 'rgba(209,50,57,0.08)']}
              style={StyleSheet.absoluteFill}
            />
            <GlassCard radius={Radius.xl} intensity={35} tint="dark" style={styles.heroCard}>
              <View style={styles.heroInner}>
                <TeamBlock team={match.teamA} />

                <View style={styles.centerBlock}>
                  {isLive ? (
                    <LivePulse />
                  ) : (
                    <LinearGradient
                      colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.02)']}
                      style={styles.timePill}
                    >
                      <Ionicons name="time-outline" size={13} color={Colors.accentGold} />
                      <Text style={styles.timePillText}>
                        {isUpcoming ? countdown : new Date(match.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </Text>
                    </LinearGradient>
                  )}
                  <Text style={styles.vsLarge}>VS</Text>
                  <Text style={styles.heroDate}>
                    {new Date(match.startDate).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </Text>
                </View>

                <TeamBlock team={match.teamB} reverse />
              </View>

              {match.venue && (
                <View style={styles.venueRow}>
                  <Ionicons name="location-outline" size={12} color={Colors.textOnDarkFaint} />
                  <Text style={styles.venueText} numberOfLines={1}>{match.venue}</Text>
                </View>
              )}
            </GlassCard>

            {isUpcoming && (
              <View style={styles.ctaRow}>
                <GradientButton
                  label="Create Team"
                  icon={<Ionicons name="add-circle" size={16} color="#fff" />}
                  onPress={() => navigation.navigate('CreateTeam', { matchId })}
                  size="md"
                  fullWidth
                  style={{ flex: 1 }}
                />
              </View>
            )}
          </View>
        )}

        {/* Glass tabs */}
        <View style={styles.tabsWrap}>
          <GlassCard radius={Radius.full} intensity={30} tint="dark">
            <View style={styles.tabBar}>
              {TABS.map(t => {
                const active = tab === t.id;
                return (
                  <Pressable
                    key={t.id}
                    style={styles.tab}
                    onPress={() => setTab(t.id)}
                  >
                    {active && (
                      <LinearGradient
                        colors={Gradients.cta}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[StyleSheet.absoluteFill, { borderRadius: Radius.full }]}
                      />
                    )}
                    <View style={styles.tabInner}>
                      <Ionicons name={t.icon} size={14} color={active ? '#fff' : Colors.textOnDarkMuted} />
                      <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.id}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </GlassCard>
        </View>

        {/* Content */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchData(); }}
              tintColor={Colors.primaryLight}
              colors={[Colors.primaryLight]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {tab === 'Contests' && (
            contests.length === 0 ? (
              <EmptyState icon="🏆" title="No contests live" sub="Contests will appear soon." />
            ) : (
              contests.map(c => (
                <ContestCard
                  key={c._id}
                  contestId={c._id}
                  title={c.title}
                  type={c.type}
                  entryFee={c.entryFee}
                  totalPrize={c.totalPrize}
                  maxSpots={c.maxSpots}
                  filledSpots={c.filledSpots}
                  prizeBreakdown={c.prizeBreakdown}
                  isJoined={joinedContestIds.has(c._id)}
                  onJoin={() => handleJoin(c._id)}
                  onPress={() => navigation.navigate('ContestLeaderboard', { contestId: c._id, matchId })}
                />
              ))
            )
          )}

          {tab === 'My Teams' && (
            myTeams.length === 0 ? (
              <EmptyState
                icon="👥"
                title="No teams yet"
                sub="Build your dream lineup to join contests."
                actionLabel={isUpcoming ? 'Create Team' : undefined}
                onAction={isUpcoming ? () => navigation.navigate('CreateTeam', { matchId }) : undefined}
              />
            ) : (
              myTeams.map((team, i) => (
                <GlassCard key={team._id} radius={Radius.xl} tint="dark" padded style={styles.teamCardWrap}>
                  <View style={styles.teamCardHead}>
                    <View style={styles.teamBadge}>
                      <LinearGradient colors={Gradients.cta} style={StyleSheet.absoluteFill} />
                      <Text style={styles.teamBadgeText}>T{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.teamName}>Team {i + 1}</Text>
                      <Text style={styles.teamMeta}>{team.playerIds?.length || 0} players</Text>
                    </View>
                    <Pressable
                      onPress={() => navigation.navigate('CreateTeam', { matchId, teamId: team._id })}
                      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                    >
                      <View style={styles.editPill}>
                        <Ionicons name="pencil" size={12} color={Colors.accentGold} />
                        <Text style={styles.editPillText}>Edit</Text>
                      </View>
                    </Pressable>
                  </View>
                  <View style={styles.teamCardFoot}>
                    <InfoChip icon="star" color={Colors.accentGold} label="Captain" value={team.captainId ? '2x' : '—'} />
                    <InfoChip icon="star-half" color={Colors.accent} label="Vice-Captain" value={team.viceCaptainId ? '1.5x' : '—'} />
                  </View>
                </GlassCard>
              ))
            )
          )}

          {tab === 'Winnings' && (
            myEntries.length === 0 ? (
              <EmptyState icon="🏅" title="No winnings yet" sub="Join a contest to compete for prizes." />
            ) : (
              myEntries.map(e => (
                <GlassCard key={e._id} radius={Radius.lg} tint="dark" padded style={{ marginBottom: Spacing.sm }}>
                  <View style={styles.entryRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryTitle} numberOfLines={1}>{e.contestTitle || 'Contest'}</Text>
                      <Text style={styles.entryMeta}>
                        {e.rank ? `Rank #${e.rank}` : 'Awaiting result'}
                      </Text>
                    </View>
                    <View style={[
                      styles.entryPrize,
                      { backgroundColor: e.prize > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)' },
                    ]}>
                      <Text style={[styles.entryPrizeText, { color: e.prize > 0 ? Colors.success : Colors.textOnDarkMuted }]}>
                        {e.prize > 0 ? `+₹${e.prize}` : e.rank ? '—' : 'Pending'}
                      </Text>
                    </View>
                  </View>
                </GlassCard>
              ))
            )
          )}
        </ScrollView>
      </View>
    </ScreenBackground>
  );
}

function TeamBlock({ team, reverse }: { team: any; reverse?: boolean }) {
  return (
    <View style={[heroStyles.wrap, reverse && { alignItems: 'flex-end' }]}>
      <View style={heroStyles.logoRing}>
        <LinearGradient
          colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.04)']}
          style={StyleSheet.absoluteFill}
        />
        {team?.logo || team?.thumb ? (
          <Image source={{ uri: team.logo || team.thumb }} style={heroStyles.logo} resizeMode="contain" />
        ) : (
          <Text style={heroStyles.logoTxt}>{team?.short?.slice(0, 2)}</Text>
        )}
      </View>
      <Text style={heroStyles.short}>{team?.short || team?.name}</Text>
      <Text style={heroStyles.long} numberOfLines={1}>{team?.name}</Text>
    </View>
  );
}

function InfoChip({ icon, color, label, value }: { icon: any; color: string; label: string; value: string }) {
  return (
    <View style={chipStyles.wrap}>
      <View style={[chipStyles.iconWrap, { backgroundColor: color + '22', borderColor: color + '44' }]}>
        <Ionicons name={icon} size={12} color={color} />
      </View>
      <View>
        <Text style={chipStyles.label}>{label}</Text>
        <Text style={chipStyles.value}>{value}</Text>
      </View>
    </View>
  );
}

function EmptyState({ icon, title, sub, actionLabel, onAction }: {
  icon: string; title: string; sub: string; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <GlassCard radius={Radius.xl} tint="dark" padded style={{ alignItems: 'center', paddingVertical: 36, gap: 10 }}>
      <Text style={{ fontSize: 54 }}>{icon}</Text>
      <Text style={{ color: '#fff', fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.extrabold }}>{title}</Text>
      <Text style={{ color: Colors.textOnDarkMuted, fontSize: Fonts.sizes.sm, textAlign: 'center' }}>{sub}</Text>
      {actionLabel && onAction && (
        <GradientButton label={actionLabel} onPress={onAction} icon={<Ionicons name="add-circle" size={16} color="#fff" />} />
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center', gap: 10 },
  loadingText: { color: Colors.textOnDarkMuted, fontSize: Fonts.sizes.sm },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  topTitle: { fontSize: Fonts.sizes.base, fontWeight: Fonts.weights.extrabold, color: '#fff' },
  topSub: { fontSize: Fonts.sizes.xs, color: Colors.textOnDarkFaint, marginTop: 2 },
  heroWrap: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  heroCard: { ...Shadow.lifted },
  heroInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.lg,
  },
  centerBlock: { alignItems: 'center', gap: 6, paddingHorizontal: Spacing.sm },
  timePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.glassBorder,
  },
  timePillText: { color: '#fff', fontSize: Fonts.sizes.xs, fontWeight: Fonts.weights.extrabold },
  vsLarge: { color: Colors.textOnDark, fontSize: Fonts.sizes.xxl, fontWeight: Fonts.weights.black, letterSpacing: 2 },
  heroDate: { color: Colors.textOnDarkFaint, fontSize: 10, fontWeight: Fonts.weights.semibold },
  venueRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm, paddingTop: 4,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
  },
  venueText: { color: Colors.textOnDarkFaint, fontSize: Fonts.sizes.xs, fontWeight: Fonts.weights.medium },
  ctaRow: { flexDirection: 'row', marginTop: Spacing.sm },
  tabsWrap: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm },
  tabBar: { flexDirection: 'row', padding: 4 },
  tab: { flex: 1, borderRadius: Radius.full, overflow: 'hidden' },
  tabInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  tabText: { fontSize: Fonts.sizes.sm, color: Colors.textOnDarkMuted, fontWeight: Fonts.weights.bold },
  tabTextActive: { color: '#fff' },
  content: { padding: Spacing.base, paddingTop: 4 },
  teamCardWrap: { marginBottom: Spacing.md },
  teamCardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  teamBadge: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', ...Shadow.glow,
  },
  teamBadgeText: { color: '#fff', fontWeight: Fonts.weights.black, fontSize: Fonts.sizes.md, letterSpacing: 0.3 },
  teamName: { color: '#fff', fontSize: Fonts.sizes.md, fontWeight: Fonts.weights.extrabold },
  teamMeta: { color: Colors.textOnDarkFaint, fontSize: Fonts.sizes.xs, marginTop: 2 },
  editPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,209,102,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,209,102,0.35)',
  },
  editPillText: { color: Colors.accentGold, fontSize: Fonts.sizes.xs, fontWeight: Fonts.weights.extrabold },
  teamCardFoot: {
    flexDirection: 'row', gap: 10, marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  entryTitle: { color: '#fff', fontSize: Fonts.sizes.md, fontWeight: Fonts.weights.bold },
  entryMeta: { color: Colors.textOnDarkMuted, fontSize: Fonts.sizes.xs, marginTop: 2 },
  entryPrize: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  entryPrizeText: { fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.extrabold },
});

const heroStyles = StyleSheet.create({
  wrap: { alignItems: 'flex-start', width: 100, gap: 4 },
  logoRing: {
    width: 68, height: 68, borderRadius: 34,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.glassBorder,
  },
  logo: { width: 50, height: 50, borderRadius: 25 },
  logoTxt: { color: '#fff', fontWeight: Fonts.weights.black, fontSize: Fonts.sizes.lg, letterSpacing: 0.5 },
  short: { color: '#fff', fontSize: Fonts.sizes.md, fontWeight: Fonts.weights.extrabold, marginTop: 4 },
  long: { color: Colors.textOnDarkFaint, fontSize: 10, fontWeight: Fonts.weights.medium },
});

const chipStyles = StyleSheet.create({
  wrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, borderRadius: Radius.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: Colors.glassBorder,
  },
  iconWrap: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  label: { color: Colors.textOnDarkFaint, fontSize: 10, fontWeight: Fonts.weights.semibold, letterSpacing: 0.3 },
  value: { color: '#fff', fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.extrabold },
});
