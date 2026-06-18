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

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone.trim() || !password.trim()) {
      Alert.alert('Missing Info', 'Please enter phone and password');
      return;
    }
    setLoading(true);
    try {
      await login(phone.trim(), password);
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Login Failed', err?.response?.data?.message || 'Invalid credentials');
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
          {/* Top bar */}
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

          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.brandMark}>
              <LinearGradient colors={Gradients.cta} style={StyleSheet.absoluteFill} />
              <Text style={styles.brandEmoji}>🏏</Text>
            </View>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Log in to join contests & win big rewards</Text>
          </View>

          {/* Glass form */}
          <GlassCard radius={Radius.xxl} intensity={40} tint="dark" padded style={[styles.formCard, Shadow.lifted]}>
            <GlassInput
              label="Phone Number"
              icon="call-outline"
              placeholder="10-digit mobile number"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              autoCapitalize="none"
              containerStyle={{ marginBottom: Spacing.md }}
            />
            <GlassInput
              label="Password"
              icon="lock-closed-outline"
              placeholder="Enter your password"
              secure
              value={password}
              onChangeText={setPassword}
              containerStyle={{ marginBottom: Spacing.sm }}
            />

            <Pressable hitSlop={8}>
              <Text style={styles.forgot}>Forgot password?</Text>
            </Pressable>

            <GradientButton
              label="Log In"
              onPress={handleLogin}
              loading={loading}
              size="lg"
              fullWidth
              icon={<Ionicons name="arrow-forward-circle" size={18} color="#fff" />}
              style={{ marginTop: Spacing.md }}
            />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialRow}>
              <SocialBtn icon="logo-google" label="Google" />
              <SocialBtn icon="logo-apple" label="Apple" />
            </View>
          </GlassCard>

          <Pressable
            onPress={() => navigation.replace('Register')}
            style={styles.switchRow}
            hitSlop={10}
          >
            <Text style={styles.switchText}>
              New here? <Text style={styles.switchLink}>Create account →</Text>
            </Text>
          </Pressable>

          <View style={styles.legal}>
            <Ionicons name="shield-checkmark" size={12} color={Colors.textOnDarkFaint} />
            <Text style={styles.legalText}>
              Secure login · 100% Encrypted · 18+ only
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

function SocialBtn({ icon, label }: { icon: any; label: string }) {
  return (
    <Pressable style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1, flex: 1 }]}>
      <GlassCard radius={Radius.lg} intensity={30} tint="dark">
        <View style={styles.socialInner}>
          <Ionicons name={icon} size={18} color="#fff" />
          <Text style={styles.socialLabel}>{label}</Text>
        </View>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: Spacing.base },
  topBar: { flexDirection: 'row' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', marginTop: 24, marginBottom: 28 },
  brandMark: {
    width: 72, height: 72, borderRadius: 24, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.glow, marginBottom: 14,
  },
  brandEmoji: { fontSize: 36 },
  title: {
    fontSize: Fonts.sizes.xxxl, fontWeight: Fonts.weights.black,
    color: '#fff', letterSpacing: 0.3, marginBottom: 6,
  },
  subtitle: {
    fontSize: Fonts.sizes.md, color: Colors.textOnDarkMuted,
    fontWeight: Fonts.weights.medium, textAlign: 'center',
  },
  formCard: { padding: Spacing.lg },
  forgot: {
    color: Colors.accentGold, fontSize: Fonts.sizes.xs,
    fontWeight: Fonts.weights.extrabold, alignSelf: 'flex-end',
    marginTop: 4, marginBottom: 4, letterSpacing: 0.3,
  },
  divider: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginVertical: Spacing.md,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.glassBorder },
  dividerText: {
    color: Colors.textOnDarkFaint, fontSize: Fonts.sizes.xs,
    fontWeight: Fonts.weights.bold, letterSpacing: 1,
  },
  socialRow: { flexDirection: 'row', gap: 10 },
  socialInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12,
  },
  socialLabel: { color: '#fff', fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.bold },
  switchRow: { alignItems: 'center', marginTop: 22 },
  switchText: { fontSize: Fonts.sizes.sm, color: Colors.textOnDarkMuted, fontWeight: Fonts.weights.medium },
  switchLink: { color: Colors.accentGold, fontWeight: Fonts.weights.extrabold },
  legal: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 16,
  },
  legalText: { fontSize: Fonts.sizes.xs, color: Colors.textOnDarkFaint, fontWeight: Fonts.weights.semibold },
});
