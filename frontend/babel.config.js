module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
  // Reanimated eklentisi en sonda olmalı
      'react-native-reanimated/plugin',
    ],
  };
};
