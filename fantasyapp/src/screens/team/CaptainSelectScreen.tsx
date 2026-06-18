import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  ActivityIndicator, Image, Alert, ScrollView, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { getMatchSquads, createTeam, joinContest } from '@/services/fantasy';
import ScreenBackground from '@/components/ui/ScreenBackground';
import GlassCard from '@/components/ui/GlassCard';
import GradientButton from '@/components/ui/GradientButton';
import { Colors, Fonts, Spacing, Radius, Shadow, Gradients } from '@/utils/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'CaptainSelect'>;

const ROLE_ORDER = ['keeper', 'batsman', 'allrounder', 'bowler'];
const ROLE_LABELS: Record<string, string> = {
  keeper: 'Wicket Keeper',
  batsman: 'Batsmen',
  allrounder: 'All Rounders',
  bowler: 'Bowlers',
};
const ROLE_COLORS: Record<string, string> = {
  keeper: '#C084FC',
  batsman: '#60A5FA',
  allrounder: '#FBBF24',
  bowler: '#34D399',
};

export default function CaptainSelectScreen({ route, navigation }: Props) {
  const { matchId, contestId, playerIds, existingTeamId } = route.params;
  const insets = useSafeAreaInsets();
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [vcId, setVcId] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    getMatchSquads(matchId)
      .then(res => {
        const squad: any[] = res.data?.squads || [];
        setAllPlayers(squad.filter(p => playerIds.includes(p.playerId)));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [matchId, playerIds]);

  const handleTap = (playerId: number) => {
    const isCaptain = captainId === playerId;
    const isVc = vcId === playerId;
    if (!isCaptain && !isVc) {
      if (!captainId) setCaptainId(playerId);
      else if (!vcId && playerId !== captainId) setVcId(playerId);
    } else if (isCaptain) {
      setCaptainId(null);
    } else {
      setVcId(null);
    }
  };

  const handleSave = useCallback(async () => {
    if (!captainId || !vcId) return;
    setSaving(true);
    try {
      let teamId = existingTeamId;
      if (!teamId) {
        const res = await createTeam({ matchId, playerIds, captainId, viceCaptainId: vcId });
        teamId = res.data._id;
      }
      if (contestId) {
        await joinContest({ contestId, teamId: teamId! });
        setShowPreview(false);
        Alert.alert('Joined! 🎉', 'You have successfully joined the contest', [
          { text: 'OK', onPress: () => navigation.popToTop() },
        ]);
      } else {
        setShowPreview(false);
        Alert.alert('Team Saved!', 'Your team has been created', [
          { text: 'OK', onPress: () => navigation.popToTop() },
        ]);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }, [captainId, vcId, existingTeamId, matchId, playerIds, contestId, navigation]);

  if (loading) {
    return (
      <ScreenBackground variant="stadium">
        <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
          <ActivityIndicator color={Colors.primaryLight} size="large" />
        </View>
      </ScreenBackground>
    );
  }

  const captainPlayer = allPlayers.find(p => p.playerId === captainId);
  const vcPlayer = allPlayers.find(p => p.playerId === vcId);
  const groupedByRole = ROLE_ORDER.map(role => ({
    role,
    label: ROLE_LABELS[role] || role,
    color: ROLE_COLORS[role] || '#fff',
    players: allPlayers.filter(p => p.role === role),
  })).filter(g => g.players.length > 0);

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
            <Text style={styles.title}>Captain & Vice-Captain</Text>
            <Text style={styles.sub}>C gets 2× pts · VC gets 1.5× pts</Text>
          </View>

          <View style={{ width: 40 }} />
        </View>

        {/* Info banner */}
        <View style={styles.infoWrap}>
          <GlassCard radius={Radius.lg} intensity={30} tint="dark" padded style={styles.info}>
            <Ionicons name="bulb" size={14} color={Colors.accentGold} />
            <Text style={styles.infoText}>
              Tap once for C · Tap again for VC
            </Text>
          </GlassCard>
        </View>

        {/* Player list */}
        <FlatList
          data={allPlayers}
          keyExtractor={p => String(p.playerId)}
          renderItem={({ item: p }) => {
            const isCaptain = captainId === p.playerId;
            const isVc = vcId === p.playerId;
            const roleColor = ROLE_COLORS[p.role] || '#fff';
            const highlighted = isCaptain || isVc;
            return (
              <Pressable
                style={({ pressed }) => [styles.rowWrap, { opacity: pressed ? 0.92 : 1 }]}
                onPress={() => handleTap(p.playerId)}
              >
                <GlassCard
                  radius={Radius.lg}
                  tint="dark"
                  bordered
                  style={highlighted ? Shadow.glow : undefined}
                >
                  {highlighted && (
                    <LinearGradient
                      colors={
                        isCaptain
                          ? ['rgba(209,50,57,0.25)', 'rgba(209,50,57,0.05)']
                          : ['rgba(255,209,102,0.22)', 'rgba(255,209,102,0.05)']
                      }
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  <View style={styles.playerRow}>
                    <View style={styles.avatarWrap}>
                      <View style={[styles.avatar, { borderColor: roleColor }]}>
                        {p.image ? (
                          <Image source={{ uri: p.image }} style={styles.avatarImg} resizeMode="cover" />
                        ) : (
                          <View style={styles.avatarFallback}>
                            <Text style={styles.avatarText}>{p.name?.slice(0, 1)}</Text>
                          </View>
                        )}
                      </View>
                      {highlighted && (
                        <LinearGradient
                          colors={isCaptain ? Gradients.cta : Gradients.gold}
                          style={styles.cvBadge}
                        >
                          <Text style={[styles.cvBadgeText, { color: isCaptain ? '#fff' : '#1A0F00' }]}>
                            {isCaptain ? 'C' : 'VC'}
                          </Text>
                        </LinearGradient>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.playerName}>{p.shortName || p.name}</Text>
                      <Text style={styles.playerMeta}>
                        {p.teamName} · {p.credit} cr
                      </Text>
                    </View>
                    <View style={styles.multCol}>
                      <Text style={[styles.multVal, isCaptain && { color: Colors.primaryLight }]}>2×</Text>
                      <Text style={styles.multLabel}>C</Text>
                    </View>
                    <View style={styles.multCol}>
                      <Text style={[styles.multVal, isVc && { color: Colors.accentGold }]}>1.5×</Text>
                      <Text style={styles.multLabel}>VC</Text>
                    </View>
                  </View>
                </GlassCard>
              </Pressable>
            );
          }}
          contentContainerStyle={{ paddingBottom: 160 }}
          showsVerticalScrollIndicator={false}
        />

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
          <LinearGradient
            colors={['rgba(10,12,20,0.1)', 'rgba(10,12,20,0.95)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.footerChips}>
            <View style={styles.footerChip}>
              <LinearGradient colors={Gradients.cta} style={styles.footerChipBadge}>
                <Text style={styles.footerChipBadgeText}>C</Text>
              </LinearGradient>
              <Text style={styles.footerChipText} numberOfLines={1}>
                {captainPlayer?.shortName || 'Select Captain'}
              </Text>
            </View>
            <View style={styles.footerChip}>
              <LinearGradient colors={Gradients.gold} style={styles.footerChipBadge}>
                <Text style={[styles.footerChipBadgeText, { color: '#1A0F00' }]}>VC</Text>
              </LinearGradient>
              <Text style={styles.footerChipText} numberOfLines={1}>
                {vcPlayer?.shortName || 'Select Vice-Captain'}
              </Text>
            </View>
          </View>
          <GradientButton
            label="Preview Team"
            onPress={() => setShowPreview(true)}
            disabled={!captainId || !vcId}
            icon={<Ionicons name="eye" size={18} color="#fff" />}
            size="lg"
            fullWidth
          />
        </View>

        {/* Preview Modal */}
        <Modal visible={showPreview} animationType="slide" onRequestClose={() => setShowPreview(false)} transparent>
          <ScreenBackground variant="stadium">
            <View style={[{ flex: 1 }, { paddingTop: insets.top }]}>
              {/* Modal top */}
              <View style={styles.topBar}>
                <Pressable onPress={() => setShowPreview(false)}>
                  <GlassCard radius={Radius.full} intensity={35} tint="dark">
                    <View style={styles.iconBtn}>
                      <Ionicons name="close" size={22} color="#fff" />
                    </View>
                  </GlassCard>
                </Pressable>
                <View style={styles.titleBlock}>
                  <Text style={styles.title}>Team Preview</Text>
                  <Text style={styles.sub}>Review before saving</Text>
                </View>
                <View style={{ width: 40 }} />
              </View>

              {/* Field banner */}
              <View style={styles.fieldBanner}>
                <LinearGradient
                  colors={['#134E2A', '#083018']}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.fieldOval} />
                <View style={styles.fieldInnerOval} />
                <View style={styles.fieldCenter}>
                  <Text style={styles.fieldLabel}>YOUR TEAM · 11 PLAYERS</Text>
                  <Text style={styles.fieldSub}>1×C  ·  1×VC  ·  9 Others</Text>
                </View>
              </View>

              <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
                {/* C/VC highlight */}
                <View style={styles.cvStrip}>
                  <GlassCard radius={Radius.xl} tint="dark" padded style={styles.cvCardWrap}>
                    <LinearGradient
                      colors={['rgba(209,50,57,0.2)', 'rgba(209,50,57,0.02)']}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.cvInner}>
                      <View style={styles.cvAvatarWrap}>
                        {captainPlayer?.image ? (
                          <Image source={{ uri: captainPlayer.image }} style={styles.cvAvatar} resizeMode="cover" />
                        ) : (
                          <View style={[styles.cvAvatar, styles.cvAvatarFallback]}>
                            <Text style={styles.cvAvatarText}>{captainPlayer?.name?.slice(0, 1)}</Text>
                          </View>
                        )}
                        <LinearGradient colors={Gradients.cta} style={styles.cvBadgeBig}>
                          <Text style={styles.cvBadgeBigText}>C</Text>
                        </LinearGradient>
                      </View>
                      <Text style={styles.cvName} numberOfLines={1}>{captainPlayer?.shortName || captainPlayer?.name}</Text>
                      <Text style={styles.cvMult}>2× points</Text>
                    </View>
                  </GlassCard>

                  <GlassCard radius={Radius.xl} tint="dark" padded style={styles.cvCardWrap}>
                    <LinearGradient
                      colors={['rgba(255,209,102,0.2)', 'rgba(255,209,102,0.02)']}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.cvInner}>
                      <View style={styles.cvAvatarWrap}>
                        {vcPlayer?.image ? (
                          <Image source={{ uri: vcPlayer.image }} style={styles.cvAvatar} resizeMode="cover" />
                        ) : (
                          <View style={[styles.cvAvatar, styles.cvAvatarFallback]}>
                            <Text style={styles.cvAvatarText}>{vcPlayer?.name?.slice(0, 1)}</Text>
                          </View>
                        )}
                        <LinearGradient colors={Gradients.gold} style={styles.cvBadgeBig}>
                          <Text style={[styles.cvBadgeBigText, { color: '#1A0F00' }]}>VC</Text>
                        </LinearGradient>
                      </View>
                      <Text style={styles.cvName} numberOfLines={1}>{vcPlayer?.shortName || vcPlayer?.name}</Text>
                      <Text style={styles.cvMult}>1.5× points</Text>
                    </View>
                  </GlassCard>
                </View>

                {/* Groups */}
                {groupedByRole.map(g => (
                  <View key={g.role} style={styles.roleGroup}>
                    <View style={[styles.roleHeader, { borderLeftColor: g.color }]}>
                      <Text style={[styles.roleHeaderTitle, { color: g.color }]}>{g.label}</Text>
                      <View style={[styles.roleCountPill, { backgroundColor: g.color + '22', borderColor: g.color + '55' }]}>
                        <Text style={[styles.roleCountText, { color: g.color }]}>{g.players.length}</Text>
                      </View>
                    </View>

                    {g.players.map(p => {
                      const isC = p.playerId === captainId;
                      const isV = p.playerId === vcId;
                      const hi = isC || isV;
                      return (
                        <View key={p.playerId} style={styles.pvRowWrap}>
                          <GlassCard radius={Radius.lg} tint="dark" style={hi ? Shadow.glow : undefined}>
                            {hi && (
                              <LinearGradient
                                colors={isC ? ['rgba(209,50,57,0.2)', 'rgba(209,50,57,0.03)'] : ['rgba(255,209,102,0.2)', 'rgba(255,209,102,0.03)']}
                                style={StyleSheet.absoluteFill}
                              />
                            )}
                            <View style={styles.pvRow}>
                              <View style={styles.pvAvatarWrap}>
                                <View style={[styles.pvAvatar, { borderColor: g.color }]}>
                                  {p.image ? (
                                    <Image source={{ uri: p.image }} style={styles.pvAvatarImg} resizeMode="cover" />
                                  ) : (
                                    <Text style={styles.pvAvatarText}>{p.name?.slice(0, 1)}</Text>
                                  )}
                                </View>
                                {hi && (
                                  <LinearGradient
                                    colors={isC ? Gradients.cta : Gradients.gold}
                                    style={styles.pvCVBadge}
                                  >
                                    <Text style={[styles.pvCVBadgeText, { color: isC ? '#fff' : '#1A0F00' }]}>
                                      {isC ? 'C' : 'VC'}
                                    </Text>
                                  </LinearGradient>
                                )}
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={[
                                  styles.pvName,
                                  hi && { color: isC ? Colors.primaryLight : Colors.accentGold },
                                ]}>
                                  {p.shortName || p.name}
                                </Text>
                                <Text style={styles.pvMeta}>{p.teamName}</Text>
                              </View>
                              <Text style={styles.pvCredit}>{p.credit} cr</Text>
                            </View>
                          </GlassCard>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </ScrollView>

              {/* Preview footer */}
              <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
                <LinearGradient
                  colors={['rgba(10,12,20,0.1)', 'rgba(10,12,20,0.95)']}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.previewActions}>
                  <Pressable
                    onPress={() => setShowPreview(false)}
                    style={({ pressed }) => [styles.editBtn, { opacity: pressed ? 0.85 : 1 }]}
                  >
                    <Ionicons name="pencil" size={16} color={Colors.accentGold} />
                    <Text style={styles.editBtnText}>Edit C/VC</Text>
                  </Pressable>
                  <GradientButton
                    label={contestId ? 'Join Contest' : 'Save Team'}
                    onPress={handleSave}
                    loading={saving}
                    icon={<Ionicons name={contestId ? 'trophy' : 'checkmark-circle'} size={18} color="#fff" />}
                    size="lg"
                    style={{ flex: 1 }}
                    fullWidth
                  />
                </View>
              </View>
            </View>
          </ScreenBackground>
        </Modal>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },

  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  titleBlock: { flex: 1, alignItems: 'center' },
  title: { color: '#fff', fontSize: Fonts.sizes.lg, fontWeight: Fonts.weights.extrabold },
  sub: { color: Colors.textOnDarkMuted, fontSize: Fonts.sizes.xs, marginTop: 2, fontWeight: Fonts.weights.semibold },

  infoWrap: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  info: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  infoText: { color: Colors.textOnDark, fontSize: Fonts.sizes.xs, fontWeight: Fonts.weights.semibold, flex: 1 },

  rowWrap: { paddingHorizontal: Spacing.base, marginBottom: 8 },
  playerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 10,
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 2,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: Fonts.sizes.xl, fontWeight: Fonts.weights.black, color: '#fff' },
  cvBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.bgDeep,
  },
  cvBadgeText: { fontSize: 10, fontWeight: Fonts.weights.black },
  playerName: { color: '#fff', fontSize: Fonts.sizes.md, fontWeight: Fonts.weights.extrabold },
  playerMeta: { color: Colors.textOnDarkMuted, fontSize: Fonts.sizes.xs, fontWeight: Fonts.weights.semibold, marginTop: 2 },
  multCol: { alignItems: 'center', minWidth: 36 },
  multVal: { color: Colors.textOnDarkFaint, fontSize: Fonts.sizes.md, fontWeight: Fonts.weights.black },
  multLabel: { color: Colors.textOnDarkFaint, fontSize: 9, fontWeight: Fonts.weights.bold },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingTop: Spacing.md, paddingHorizontal: Spacing.base, gap: 10,
  },
  footerChips: { flexDirection: 'row', gap: 8, marginBottom: 2 },
  footerChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: Colors.glassBorder,
  },
  footerChipBadge: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  footerChipBadgeText: { color: '#fff', fontSize: 10, fontWeight: Fonts.weights.black },
  footerChipText: { color: '#fff', fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.bold, flex: 1 },

  // Preview
  fieldBanner: {
    height: 110, marginHorizontal: Spacing.base,
    borderRadius: Radius.xl,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.glassBorder,
  },
  fieldOval: {
    position: 'absolute', width: 220, height: 80, borderRadius: 110,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)',
  },
  fieldInnerOval: {
    position: 'absolute', width: 120, height: 44, borderRadius: 60,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)',
  },
  fieldCenter: { alignItems: 'center' },
  fieldLabel: { color: '#fff', fontSize: Fonts.sizes.xs, fontWeight: Fonts.weights.black, letterSpacing: 3, marginBottom: 4 },
  fieldSub: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: Fonts.weights.bold, letterSpacing: 0.5 },

  cvStrip: { flexDirection: 'row', gap: 10, paddingHorizontal: Spacing.base, marginBottom: Spacing.base },
  cvCardWrap: { flex: 1, padding: 0 },
  cvInner: { alignItems: 'center', padding: Spacing.md, gap: 6 },
  cvAvatarWrap: { position: 'relative', marginBottom: 4 },
  cvAvatar: { width: 64, height: 64, borderRadius: 32 },
  cvAvatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: Colors.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  cvAvatarText: { color: '#fff', fontSize: Fonts.sizes.xxl, fontWeight: Fonts.weights.black },
  cvBadgeBig: {
    position: 'absolute', bottom: -4, right: -4,
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.bgDeep,
  },
  cvBadgeBigText: { fontSize: 11, fontWeight: Fonts.weights.black },
  cvName: { color: '#fff', fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.extrabold, textAlign: 'center' },
  cvMult: { color: Colors.textOnDarkFaint, fontSize: Fonts.sizes.xs, fontWeight: Fonts.weights.semibold },

  roleGroup: { marginHorizontal: Spacing.base, marginBottom: Spacing.base },
  roleHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderLeftWidth: 3, paddingLeft: Spacing.sm, marginBottom: Spacing.sm,
  },
  roleHeaderTitle: { fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.black, textTransform: 'uppercase', letterSpacing: 1 },
  roleCountPill: {
    paddingHorizontal: 8, paddingVertical: 1,
    borderRadius: Radius.full, borderWidth: 1,
  },
  roleCountText: { fontSize: 10, fontWeight: Fonts.weights.black },

  pvRowWrap: { marginBottom: 6 },
  pvRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  pvAvatarWrap: { position: 'relative' },
  pvAvatar: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 2,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  pvAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  pvAvatarText: { color: '#fff', fontSize: Fonts.sizes.md, fontWeight: Fonts.weights.black },
  pvCVBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.bgDeep,
  },
  pvCVBadgeText: { fontSize: 8, fontWeight: Fonts.weights.black },
  pvName: { color: '#fff', fontSize: Fonts.sizes.md, fontWeight: Fonts.weights.extrabold },
  pvMeta: { color: Colors.textOnDarkMuted, fontSize: Fonts.sizes.xs, marginTop: 2, fontWeight: Fonts.weights.semibold },
  pvCredit: { color: Colors.accentGold, fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.extrabold },

  previewActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: 'rgba(255,209,102,0.4)',
    backgroundColor: 'rgba(255,209,102,0.12)',
  },
  editBtnText: { color: Colors.accentGold, fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.extrabold },
});
