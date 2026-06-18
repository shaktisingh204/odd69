import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { useAuth } from '@/context/AuthContext';
import { getStreak, claimStreak, getMyRank } from '@/services/fantasy';
import ScreenBackground from '@/components/ui/ScreenBackground';
import GlassCard from '@/components/ui/GlassCard';
import GradientButton from '@/components/ui/GradientButton';
import { Colors, Fonts, Spacing, Radius, Shadow, Gradients } from '@/utils/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { user, logout, refreshUser } = useAuth();
  const [streak, setStreak] = useState<any>(null);
  const [rank, setRank] = useState<any>(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getStreak().then(r => setStreak(r.data)).catch(() => {}),
      getMyRank().then(r => setRank(r.data)).catch(() => {}),
    ]);
  }, [user]);

  const handleClaimStreak = async () => {
    setClaiming(true);
    try {
      await claimStreak();
      Alert.alert('Claimed!', 'Daily streak reward collected');
      const res = await getStreak();
      setStreak(res.data);
      refreshUser();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Cannot claim now');
    } finally {
      setClaiming(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  if (!user) {
    return (
      <ScreenBackground variant="night">
        <View style={[styles.root, styles.guestRoot, { paddingTop: insets.top }]}>
          <View style={styles.guestIconWrap}>
            <LinearGradient colors={Gradients.cta} style={StyleSheet.absoluteFill} />
            <Ionicons name="person" size={44} color="#fff" />
          </View>
          <Text style={styles.guestTitle}>Join the Game!</Text>
          <Text style={styles.guestSub}>Log in to track your performance, claim rewards & compete</Text>
          <GradientButton
            label="Log In"
            onPress={() => navigation.navigate('Login')}
            size="lg"
            icon={<Ionicons name="log-in-outline" size={18} color="#fff" />}
            style={{ minWidth: 220, marginTop: 12 }}
          />
          <Pressable
            onPress={() => navigation.navigate('Register')}
            style={({ pressed }) => [styles.ghostBtn, { opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={styles.ghostBtnText}>Create Account</Text>
          </Pressable>
        </View>
      </ScreenBackground>
    );
  }

  const balance = parseFloat((user.balance as any) || 0);

  return (
    <ScreenBackground variant="night">
      <ScrollView
        style={[styles.root, { paddingTop: insets.top }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <LinearGradient
          colors={['rgba(209,50,57,0.32)', 'rgba(0,0,0,0)']}
          style={styles.headerGradient}
        >
          <View style={styles.headerInner}>
            <View style={styles.avatarOuter}>
              <LinearGradient colors={Gradients.cta} style={StyleSheet.absoluteFill} />
              <Text style={styles.avatarText}>
                {user.name?.slice(0, 1)?.toUpperCase() || '?'}
              </Text>
              <View style={styles.levelPill}>
                <Ionicons name="star" size={9} color="#1A0F00" />
                <Text style={styles.levelPillText}>LVL 12</Text>
              </View>
            </View>
            <Text style={styles.userName} numberOfLines={1}>{user.name}</Text>
            <Text style={styles.userPhone}>+91 · {user.phone}</Text>

            <View style={styles.idChip}>
              <Ionicons name="copy-outline" size={11} color={Colors.textOnDarkFaint} />
              <Text style={styles.idChipText}>ID: {(user.id || '—').slice(-8).toUpperCase()}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Balance + stats */}
        <View style={styles.statsWrap}>
          <GlassCard radius={Radius.xl} intensity={45} tint="dark" style={styles.balanceMain}>
            <View style={styles.balanceRow}>
              <View>
                <Text style={styles.balanceLabel}>TOTAL BALANCE</Text>
                <Text style={styles.balanceValue}>₹{balance.toFixed(2)}</Text>
              </View>
              <LinearGradient colors={Gradients.gold} style={[styles.addFundBtn, Shadow.glowGold]}>
                <Ionicons name="add" size={16} color="#1A0F00" />
                <Text style={styles.addFundText}>Add Cash</Text>
              </LinearGradient>
            </View>

            <View style={styles.splitRow}>
              <View style={styles.splitItem}>
                <View style={[styles.splitDot, { backgroundColor: Colors.success }]} />
                <View>
                  <Text style={styles.splitLabel}>Deposits</Text>
                  <Text style={styles.splitValue}>₹{balance.toFixed(2)}</Text>
                </View>
              </View>
              <View style={styles.splitDivider} />
              <View style={styles.splitItem}>
                <View style={[styles.splitDot, { backgroundColor: Colors.accentGold }]} />
                <View>
                  <Text style={styles.splitLabel}>Winnings</Text>
                  <Text style={styles.splitValue}>₹0.00</Text>
                </View>
              </View>
            </View>
          </GlassCard>

          <View style={styles.tileRow}>
            <Tile
              icon="trophy"
              color={Colors.accentGold}
              label="Season Rank"
              value={rank?.rank ? `#${rank.rank}` : '—'}
            />
            <Tile
              icon="flame"
              color="#FF6A5B"
              label="Day Streak"
              value={streak?.currentStreak ? `${streak.currentStreak}` : '0'}
            />
            <Tile
              icon="game-controller"
              color="#6CB9FF"
              label="Matches"
              value={String(rank?.totalMatches ?? '—')}
            />
          </View>
        </View>

        {/* Streak claim */}
        {streak?.canClaim && (
          <View style={styles.sectionWrap}>
            <GlassCard radius={Radius.xl} intensity={40} tint="dark" padded style={Shadow.glowGold}>
              <View style={styles.streakRow}>
                <View style={styles.streakIconBig}>
                  <LinearGradient colors={Gradients.gold} style={StyleSheet.absoluteFill} />
                  <Text style={{ fontSize: 22 }}>🔥</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.streakTitle}>Daily Reward Ready!</Text>
                  <Text style={styles.streakSub}>Claim your Day {streak.currentStreak + 1} bonus</Text>
                </View>
                <GradientButton
                  label="Claim"
                  variant="gold"
                  onPress={handleClaimStreak}
                  loading={claiming}
                  size="sm"
                />
              </View>
            </GlassCard>
          </View>
        )}

        {/* Quick actions */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickRow}>
            <QuickAction icon="arrow-down-circle" color={Colors.success} label="Deposit" />
            <QuickAction icon="arrow-up-circle" color={Colors.accent} label="Withdraw" />
            <QuickAction icon="gift" color={Colors.accentGold} label="Invite" />
            <QuickAction icon="headset" color="#6CB9FF" label="Support" />
          </View>
        </View>

        {/* Menu */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Account</Text>
          <GlassCard radius={Radius.xl} intensity={35} tint="dark">
            {[
              { icon: 'time-outline',           label: 'Match History',        onPress: () => {} },
              { icon: 'person-circle-outline',  label: 'Profile & KYC',        onPress: () => {} },
              { icon: 'card-outline',           label: 'Transactions',         onPress: () => {} },
              { icon: 'notifications-outline',  label: 'Notifications',        onPress: () => {} },
              { icon: 'shield-checkmark-outline', label: 'Privacy & Security', onPress: () => {} },
              { icon: 'help-circle-outline',    label: 'Help Center',          onPress: () => {} },
            ].map((item, i, arr) => (
              <Pressable
                key={item.label}
                onPress={item.onPress}
                style={({ pressed }) => [
                  styles.menuItem,
                  i !== arr.length - 1 && styles.menuDivider,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <View style={styles.menuIconWrap}>
                  <Ionicons name={item.icon as any} size={16} color={Colors.accentGold} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textOnDarkFaint} />
              </Pressable>
            ))}
          </GlassCard>
        </View>

        {/* Logout */}
        <View style={styles.sectionWrap}>
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [styles.logoutBtn, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
          <Text style={styles.versionText}>Fantasy11 v1.0.0 · Play Responsibly · 18+</Text>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}

function Tile({ icon, color, label, value }: { icon: any; color: string; label: string; value: string }) {
  return (
    <View style={styles.tileWrap}>
      <GlassCard radius={Radius.lg} intensity={35} tint="dark" padded style={styles.tile}>
        <View style={[styles.tileIcon, { backgroundColor: color + '22', borderColor: color + '44' }]}>
          <Ionicons name={icon} size={14} color={color} />
        </View>
        <Text style={styles.tileValue}>{value}</Text>
        <Text style={styles.tileLabel}>{label}</Text>
      </GlassCard>
    </View>
  );
}

function QuickAction({ icon, color, label }: { icon: any; color: string; label: string }) {
  return (
    <Pressable style={({ pressed }) => [styles.quickWrap, { opacity: pressed ? 0.8 : 1 }]}>
      <GlassCard radius={Radius.lg} intensity={30} tint="dark" padded style={styles.quickInner}>
        <View style={[styles.quickIcon, { backgroundColor: color + '22', borderColor: color + '44' }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text style={styles.quickLabel}>{label}</Text>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  guestRoot: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    gap: 10, padding: Spacing.lg,
  },
  guestIconWrap: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', marginBottom: 14, ...Shadow.glow,
  },
  guestTitle: { fontSize: Fonts.sizes.xxxl, fontWeight: Fonts.weights.black, color: '#fff', letterSpacing: 0.3 },
  guestSub: { fontSize: Fonts.sizes.md, color: Colors.textOnDarkMuted, textAlign: 'center', lineHeight: 20 },
  ghostBtn: { paddingHorizontal: 24, paddingVertical: 12, marginTop: 6 },
  ghostBtnText: { color: Colors.accentGold, fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.extrabold, letterSpacing: 0.3 },

  headerGradient: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.base,
  },
  headerInner: { alignItems: 'center', paddingVertical: Spacing.md },
  avatarOuter: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', marginBottom: 12, ...Shadow.glow,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: { fontSize: 36, fontWeight: Fonts.weights.black, color: '#fff' },
  levelPill: {
    position: 'absolute', bottom: -4, right: -4,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full,
    backgroundColor: Colors.accentGold,
    borderWidth: 2, borderColor: Colors.bgDeep,
  },
  levelPillText: { fontSize: 9, color: '#1A0F00', fontWeight: Fonts.weights.black },
  userName: { fontSize: Fonts.sizes.xxl, fontWeight: Fonts.weights.black, color: '#fff' },
  userPhone: { fontSize: Fonts.sizes.sm, color: Colors.textOnDarkMuted, marginTop: 3, fontWeight: Fonts.weights.semibold },
  idChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 10, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: Colors.glassBorder,
  },
  idChipText: { color: Colors.textOnDarkFaint, fontSize: 10, fontWeight: Fonts.weights.bold, letterSpacing: 0.5 },

  statsWrap: { paddingHorizontal: Spacing.base, gap: 10 },
  balanceMain: { padding: Spacing.base },
  balanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balanceLabel: { fontSize: 10, color: Colors.textOnDarkFaint, fontWeight: Fonts.weights.bold, letterSpacing: 0.6 },
  balanceValue: { fontSize: Fonts.sizes.xxxl, fontWeight: Fonts.weights.black, color: '#fff', marginTop: 2 },
  addFundBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full,
  },
  addFundText: { color: '#1A0F00', fontWeight: Fonts.weights.black, fontSize: Fonts.sizes.sm },
  splitRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  splitItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  splitDot: { width: 8, height: 8, borderRadius: 4 },
  splitLabel: { color: Colors.textOnDarkFaint, fontSize: 10, fontWeight: Fonts.weights.bold, letterSpacing: 0.4 },
  splitValue: { color: '#fff', fontSize: Fonts.sizes.md, fontWeight: Fonts.weights.extrabold },
  splitDivider: { width: 1, height: 24, backgroundColor: Colors.glassBorder },

  tileRow: { flexDirection: 'row', gap: 10 },
  tileWrap: { flex: 1 },
  tile: { alignItems: 'flex-start', gap: 6, padding: 12 },
  tileIcon: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  tileValue: { color: '#fff', fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.black },
  tileLabel: { color: Colors.textOnDarkFaint, fontSize: 10, fontWeight: Fonts.weights.bold, letterSpacing: 0.3 },

  sectionWrap: { paddingHorizontal: Spacing.base, marginTop: Spacing.lg },
  sectionTitle: {
    color: Colors.textOnDarkMuted, fontSize: Fonts.sizes.xs,
    fontWeight: Fonts.weights.extrabold, letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 10,
  },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  streakIconBig: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  streakTitle: { color: '#fff', fontSize: Fonts.sizes.md, fontWeight: Fonts.weights.extrabold },
  streakSub: { color: Colors.textOnDarkMuted, fontSize: Fonts.sizes.xs, marginTop: 2 },

  quickRow: { flexDirection: 'row', gap: 8 },
  quickWrap: { flex: 1 },
  quickInner: { alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 4 },
  quickIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  quickLabel: { color: '#fff', fontSize: Fonts.sizes.xs, fontWeight: Fonts.weights.bold },

  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Spacing.base, paddingVertical: 14,
  },
  menuDivider: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  menuIconWrap: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,209,102,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,209,102,0.3)',
  },
  menuLabel: { flex: 1, color: '#fff', fontSize: Fonts.sizes.md, fontWeight: Fonts.weights.semibold },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: Radius.lg, paddingVertical: 14,
    backgroundColor: 'rgba(220,53,69,0.12)',
    borderWidth: 1, borderColor: 'rgba(220,53,69,0.3)',
  },
  logoutText: { color: Colors.danger, fontSize: Fonts.sizes.md, fontWeight: Fonts.weights.extrabold, letterSpacing: 0.3 },
  versionText: {
    textAlign: 'center', color: Colors.textOnDarkFaint, fontSize: Fonts.sizes.xs,
    marginTop: 14, fontWeight: Fonts.weights.medium,
  },
});
