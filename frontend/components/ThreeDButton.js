import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';

// Simple darken utility for #rrggbb colors
function darkenHex(hex, amount = 0.2) {
  try {
    const normalized = hex.replace('#', '');
    if (normalized.length !== 6) return hex;
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    const dr = Math.max(0, Math.min(255, Math.round(r * (1 - amount))));
    const dg = Math.max(0, Math.min(255, Math.round(g * (1 - amount))));
    const db = Math.max(0, Math.min(255, Math.round(b * (1 - amount))));
    const toHex = (v) => v.toString(16).padStart(2, '0');
    return `#${toHex(dr)}${toHex(dg)}${toHex(db)}`;
  } catch {
    return hex;
  }
}

export default function ThreeDButton({
  text,
  onPress,
  color = '#22c55e',
  depthColor,
  textColor = '#fff',
  disabled = false,
  containerStyle,
  height = 52,
  textStyle,
}) {
  const baseDepth = depthColor || darkenHex(color, 0.25);

  return (
    <View style={[{ height }, containerStyle]}> 
      <View style={[styles.btn3DWrap, { height }]}> 
        <View style={[styles.btnDepth, { backgroundColor: baseDepth }]} />
        <Pressable
          disabled={disabled}
          onPress={onPress}
          style={({ pressed }) => [
            styles.btnSurface,
            { backgroundColor: color },
            pressed && !disabled && styles.btnSurfacePressed,
            disabled && styles.btnDisabled,
          ]}
        >
          <Text style={[styles.btnText, { color: textColor }, textStyle]}>
            {text}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  btn3DWrap: { position: 'relative' },
  btnDepth: {
    position: 'absolute', left: 0, right: 0, bottom: 0, top: 4,
    borderRadius: 12,
  },
  btnSurface: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 4,
    borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  btnSurfacePressed: {
    transform: [{ translateY: 4 }],
    bottom: 0,
    shadowOpacity: 0.05,
    elevation: 1,
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { fontFamily: 'LilitaOne_400Regular', fontSize: 18 },
});
