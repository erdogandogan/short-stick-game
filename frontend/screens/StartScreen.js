import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import ThreeDButton from '../components/ThreeDButton';

export default function StartScreen({ navigation }) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <View style={styles.navigationButtons}>
        <ThreeDButton
          text="Giris Yap"
          color={theme.colors.primary}
          onPress={() => navigation.navigate('Login')}
          containerStyle={{ marginBottom: 16 }}
          height={60}
          textStyle={{ fontSize: 24 }}
        />
        <ThreeDButton
          text="Kayıt Ol"
          color={theme.colors.success}
          onPress={() => navigation.navigate('Register')}
          height={60}
          textStyle={{ fontSize: 24 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 24, textAlign: 'center' },
  navigationButtons: { marginTop: 20 },
});
