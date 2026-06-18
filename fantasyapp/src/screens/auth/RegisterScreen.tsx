import React, { useState } from 'react';
import {
  View, Text, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { useAuth } from '@/context/AuthContext';
import ScreenBackground from '@/components/ui/ScreenBackground';
import GlassCard from '@/components/ui/GlassCard';
import GlassInput from '@/components/ui/GlassInput';
import GradientButton from '@/components/ui/GradientButton';
import { Colors, Fonts, Spacing, Radius, Shadow, Gradients } from '@/utils/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [referral, setReferral] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !phone.trim() || !password.trim()) {
      Alert.alert('Missing Info', 'Name, phone and password are required');
      return;
    }
    setLoading(true);
    try {
      await register({
        name: name.trim(),
        phone: phone.trim(),
        password,
        referralCode: referral.trim() || undefined,
      });
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Registration Failed', err?.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenBackground variant="night">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <Pressable
              onPress={() => navigation.canGoBack() ? navigation.goBack() : null}
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            >
              <GlassCard radius={Radius.full} intensity={40} tint="dark">
                <View style={styles.iconBtn}>
                  <Ionicons name="arrow-back" size={20} color="#fff" />
                </View>
              </GlassCard>
            </Pressable>
          </View>

          <View style={styles.hero}>
            <View style={styles.brandMark}>
              <LinearGradient colors={Gradients.cta} style={StyleSheet.absoluteFill} />
              <Text style={styles.brandEmoji}>🏏</Text>
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join millions playing fantasy cricket daily</Text>
          </View>

          {/* Perks row */}
          <View style={styles.perkRow}>
            <Perk icon="gift" color={Colors.accentGold} label="₹100 Bonus" />
            <Perk icon="flash" color="#6CB9FF" label="Instant Play" />
            <Perk icon="shield-checkmark" color={Colors.success} label="Secure" />
          </View>

          <GlassCard radius={Radius.xxl} intensity={40} tint="dark" padded style={[styles.formCard, Shadow.lifted]}>
            <GlassInput
              label="Full Name"
              icon="person-outline"
              placeholder="Your full name"
              value={name}
              onChangeText={setName}
              containerStyle={{ marginBottom: Spacing.md }}
            />
            <GlassInput
              label="Phone Number"
              icon="call-outline"
              placeholder="10-digit mobile number"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              containerStyle={{ marginBottom: Spacing.md }}
            />
            <GlassInput
              label="Password"
              icon="lock-closed-outline"
              placeholder="Create a strong password"
              secure
              value={password}
              onChangeText={setPassword}
              containerStyle={{ marginBottom: Spacing.md }}
            />
            <GlassInput
              label="Referral Code (optional)"
              icon="gift-outline"
              placeholder="Enter referral code"
              value={referral}
              onChangeText={setReferral}
              autoCapitalize="characters"
            />

            <GradientButton
              label="Create Account"
              onPress={handleRegister}
              loading={loading}
              size="lg"
              fullWidth
              icon={<Ionicons name="sparkles" size={18} color="#fff" />}
              style={{ marginTop: Spacing.lg }}
            />

            <Text style={styles.legalInline}>
              By signing up, you agree to our <Text style={styles.legalLink}>Terms</Text> &{' '}
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </Text>
          </GlassCard>

          <Pressable
            onPress={() => navigation.replace('Login')}
            style={styles.switchRow}
            hitSlop={10}
          >
            <Text style={styles.switchText}>
              Already have an account? <Text style={styles.switchLink}>Log in →</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

function Perk({ icon, color, label }: { icon: any; color: string; label: string }) {
  return (
    <View style={styles.perkChip}>
      <View style={[styles.perkIcon, { backgroundColor: color + '22', borderColor: color + '44' }]}>
        <Ionicons name={icon} size={14} color={color} />
      </View>
      <Text style={styles.perkLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: Spacing.base },
  topBar: { flexDirection: 'row' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', marginTop: 20, marginBottom: 20 },
  brandMark: {
    width: 68, height: 68, borderRadius: 22, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.glow, marginBottom: 12,
  },
  brandEmoji: { fontSize: 32 },
  title: {
    fontSize: Fonts.sizes.xxxl, fontWeight: Fonts.weights.black,
    color: '#fff', letterSpacing: 0.3, marginBottom: 6,
  },
  subtitle: {
    fontSize: Fonts.sizes.md, color: Colors.textOnDarkMuted,
    fontWeight: Fonts.weights.medium, textAlign: 'center',
  },
  perkRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.base },
  perkChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: Colors.glassBorder,
  },
  perkIcon: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  perkLabel: { color: '#fff', fontSize: Fonts.sizes.xs, fontWeight: Fonts.weights.extrabold },
  formCard: { padding: Spacing.lg },
  legalInline: {
    color: Colors.textOnDarkFaint, fontSize: Fonts.sizes.xs,
    textAlign: 'center', marginTop: Spacing.md,
  },
  legalLink: { color: Colors.accentGold, fontWeight: Fonts.weights.bold },
  switchRow: { alignItems: 'center', marginTop: 18 },
  switchText: { fontSize: Fonts.sizes.sm, color: Colors.textOnDarkMuted, fontWeight: Fonts.weights.medium },
  switchLink: { color: Colors.accentGold, fontWeight: Fonts.weights.extrabold },
});
