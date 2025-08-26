// Resolve an avatar image for a user.
// If a remote AvatarUrl is provided, use it. Otherwise, pick one of the
// local monster images deterministically from userId.

const monsters = [
  require('../assets/monster1.png'),
  require('../assets/monster2.png'),
  require('../assets/monster3.png'),
  require('../assets/monster4.png'),
  require('../assets/monster5.png'),
];

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function getAvatarSource(userId, avatarUrl) {
  if (avatarUrl && /^https?:\/\//i.test(String(avatarUrl))) {
    return { uri: String(avatarUrl) };
  }
  const key = String(userId || '0');
  const idx = hashString(key) % monsters.length;
  return monsters[idx];
}
