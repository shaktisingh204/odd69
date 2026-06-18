import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  TextInputProps, StyleProp, ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '@/utils/theme';

interface Props extends TextInputProps {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  secure?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  error?: string;
}

export default function GlassInput({
  label, icon, secure, containerStyle, error, value, onFocus, onBlur, ...rest
}: Props) {
  const [focused, setFocused] = useState(false);
  const [hide, setHide] = useState(!!secure);

  return (
    <View style={containerStyle}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[
        styles.wrap,
        focused && styles.wrapFocus,
        error && styles.wrapError,
      ]}>
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color={focused ? Colors.accentGold : Colors.textOnDarkFaint}
            style={styles.icon}
          />
        )}
        <TextInput
          {...rest}
          value={value}
          secureTextEntry={hide}
          placeholderTextColor={Colors.textOnDarkFaint}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          style={styles.input}
        />
        {secure && (
          <Pressable onPress={() => setHide(h => !h)} hitSlop={10}>
            <Ionicons
              name={hide ? 'eye-outline' : 'eye-off-outline'}
              size={18}
              color={Colors.textOnDarkFaint}
            />
          </Pressable>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: Colors.textOnDarkMuted,
    fontSize: Fonts.sizes.xs,
    fontWeight: Fonts.weights.bold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: Colors.glassBorder,
  },
  wrapFocus: {
    borderColor: Colors.accentGold,
    backgroundColor: 'rgba(255,209,102,0.06)',
  },
  wrapError: {
    borderColor: Colors.danger,
  },
  icon: { width: 22 },
  input: {
    flex: 1,
    fontSize: Fonts.sizes.base,
    color: '#fff',
    fontWeight: Fonts.weights.semibold,
    paddingVertical: 0,
  },
  error: {
    color: Colors.danger,
    fontSize: Fonts.sizes.xs,
    marginTop: 6,
    fontWeight: Fonts.weights.semibold,
  },
});
