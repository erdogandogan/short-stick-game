import { useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Video } from 'expo-av';
import { useTheme } from '../context/ThemeContext';
import ThreeDButton from '../components/ThreeDButton';

// Bu projede kurulu ve stabil olan expo-av'in Video bileşenini kullan
const VideoComponent = Video;

export default function StartScreen({ navigation }) {
  const theme = useTheme();
  const [aspectRatio, setAspectRatio] = useState(16 / 9);
  const videoRef = useRef(null);
  const screenHeight = Dimensions.get('window').height;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}> 
  {/* Başlık */}
      <Text style={[styles.title, { color: theme.colors.text }]}>Short Stick Game</Text>

  {/* Üstte video / animasyon */}
      <View style={styles.animationWrapper} pointerEvents="none">
        <View style={[styles.videoFrame, { backgroundColor: theme.colors.background }]}>
          {VideoComponent ? (
            <VideoComponent
              ref={videoRef}
              source={require('../assets/stick_war_animation.mp4')}
              style={[
                styles.video,
                {
                  aspectRatio,
                  maxHeight: screenHeight * 0.45, // videonun yüksekliğini ekranın en fazla %45'iyle sınırla
                },
              ]}
              resizeMode="contain"
              shouldPlay
              isLooping
              useNativeControls={false}
              onLoad={(meta) => {
                try {
                  const naturalSize = meta?.naturalSize ?? meta?.naturalSize?.presentationSize ?? meta?.source?.naturalSize;
                  if (naturalSize && naturalSize.width && naturalSize.height) {
                    setAspectRatio(naturalSize.width / naturalSize.height);
                  }
                } catch (e) {
                  // tespit başarısız olursa varsayılan oranı koru
                }
              }}
            />
          ) : null}
        </View>
      </View>

  {/* Animasyonun altında butonlar */}
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
          text="Kayit Ol"
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
  title: { fontSize: 50, fontWeight: '700', marginBottom: 24, textAlign: 'center' },
  navigationButtons: { marginTop: 20 },
  animationWrapper: { alignItems: 'center', marginBottom: 24 },
  videoFrame: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  video: { width: '100%', backgroundColor: 'transparent' },
});
