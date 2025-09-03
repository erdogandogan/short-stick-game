// UI mantığını test edilebilir tutmak için küçük politika yardımcıları

export function canShowStartButton({ isStarted, creatorUserId, me, participants }) {
  if (!me) return false;
  if (!creatorUserId) return false;
  if (isStarted) return false;
  if (String(creatorUserId) !== String(me)) return false;
  // Katılımcılar sağlandıysa herkesin hazır olduğundan emin ol
  if (Array.isArray(participants) && participants.length > 0) {
    const allReady = participants.every(p => !!p.isReady);
    if (!allReady) return false;
  }
  return true;
}

export function canShowDrawButton({ isStarted, me, participants, result }) {
  if (!isStarted) return false; // önce başlamalı
  if (!me) return false;
  const my = (participants || []).find(p => String(p.userId) === String(me));
  if (!my) return false; // katılımcı olmalı
  if (my.hasDrawn) return false; // sadece bir kez
  // Oyun zaten tamamlandıysa artık çekilemez
  if (result?.isCompleted) return false;
  return true;
}
