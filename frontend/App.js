import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React from 'react';
import { NavigationContainer, DefaultTheme as NavDefaultTheme } from '@react-navigation/native';
import { ActivityIndicator, View, Text, TextInput, StyleSheet } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { LilitaOne_400Regular } from '@expo-google-fonts/lilita-one';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import HomeScreen from './screens/HomeScreen';
import CreateGameScreen from './screens/CreateGameScreen';
import JoinGameScreen from './screens/JoinGameScreen';
import GameDetailScreen from './screens/GameDetailScreen';
import ResultScreen from './screens/ResultScreen';
import GamePlayScreen from './screens/GamePlayScreen';
import StartScreen from './screens/StartScreen';
import GameHistoryScreen from './screens/GameHistoryScreen';
import GameHistoryDetailScreen from './screens/GameHistoryDetailScreen';
import UserProfileScreen from './screens/UserProfileScreen';
import UserGameHistoryScreen from './screens/UserGameHistoryScreen';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
const Stack = createNativeStackNavigator();

function AuthStack() {
  const insets = useSafeAreaInsets();
  
  return (
    <Stack.Navigator screenOptions={{
      headerTitleStyle: { fontFamily: 'LilitaOne_400Regular' },
      contentStyle: { paddingTop: insets.top, paddingBottom: insets.bottom }
    }}>
      <Stack.Screen name="Test" component={StartScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function AppStack() {
  const insets = useSafeAreaInsets();
  return (
    <Stack.Navigator screenOptions={{
      headerTitleStyle: { fontFamily: 'LilitaOne_400Regular' },
      contentStyle: { paddingTop: insets.top, paddingBottom: insets.bottom }
    }}>
  <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
  <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ headerShown: false }} />
  <Stack.Screen name="UserGameHistory" component={UserGameHistoryScreen} options={{ headerShown: false }} />
  <Stack.Screen name="GameHistory" component={GameHistoryScreen} options={{ headerShown: false }} />
  <Stack.Screen name="GameHistoryDetail" component={GameHistoryDetailScreen} options={{ headerShown: false }} />
  <Stack.Screen name="CreateGame" component={CreateGameScreen} options={{ headerShown: false }} />
  <Stack.Screen name="JoinGame" component={JoinGameScreen} options={{ headerShown: false }} />
  <Stack.Screen name="GameDetail" component={GameDetailScreen} options={{ headerShown: false }} />
  <Stack.Screen name="GamePlay" component={GamePlayScreen} options={{ headerShown: false }} />
  <Stack.Screen name="Result" component={ResultScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  return user ? <AppStack /> : <AuthStack />;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    LilitaOne_400Regular,
  });

  // Geliştirme zamanı teşhis: herhangi bir ekran tanımsız/geçersiz React bileşeni ise logla
  React.useEffect(() => {
    const screens = {
      StartScreen,
      LoginScreen,
      RegisterScreen,
      HomeScreen,
      CreateGameScreen,
      JoinGameScreen,
      GameDetailScreen,
      ResultScreen,
      GamePlayScreen,
      GameHistoryScreen,
      GameHistoryDetailScreen,
      UserProfileScreen,
      UserGameHistoryScreen,
    };
    const invalid = Object.entries(screens)
      .filter(([_, Cmp]) => !Cmp || (typeof Cmp !== 'function' && typeof Cmp !== 'object'))
      .map(([name]) => name);
    if (invalid.length) {
      console.error('The following screens are invalid or undefined:', invalid);
    }
  }, []);

  React.useEffect(() => {
    if (!fontsLoaded) return;
  // TextInput için varsayılan fontu defaultProps ile uygula (güvenli)
    if (!TextInput.defaultProps) TextInput.defaultProps = {};
    TextInput.defaultProps.style = [TextInput.defaultProps.style, { fontFamily: 'LilitaOne_400Regular' }];

  // Text bileşenini Lilita One kullanmaya zorla ve Android'in sistem fontuna düşmesini önlemek için fontWeight'i temizle
    if (!globalThis.__LILITA_TEXT_PATCHED__) {
      globalThis.__LILITA_TEXT_PATCHED__ = true;
      const originalRender = Text.render;
      Text.render = function (...args) {
        const element = originalRender ? originalRender.call(this, ...args) : null;
        if (!element) return element;
        const originalStyle = element.props?.style;
        const flat = StyleSheet.flatten(originalStyle) || {};
  // Android'de özel fontu bozabilecek fontFamily/fontWeight alanlarını temizle
        delete flat.fontFamily;
        delete flat.fontWeight;
        const newStyle = [{ fontFamily: 'LilitaOne_400Regular' }, flat];
        return React.cloneElement(element, { style: newStyle });
      };
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <ThemedNavigation>
                <RootNavigator />
              </ThemedNavigation>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ThemedNavigation({ children }) {
  const theme = useTheme();
  const navTheme = {
    ...NavDefaultTheme,
    colors: {
      ...NavDefaultTheme.colors,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.textPrimary,
      border: theme.colors.cardBorder,
      primary: theme.colors.primary,
    },
  };
  return <NavigationContainer theme={navTheme}>{children}</NavigationContainer>;
}
