// Small policy helpers to keep UI logic testable

export function canShowStartButton({ isStarted, creatorUserId, me, participants }) {
  if (!me) return false;
  if (!creatorUserId) return false;
  if (isStarted) return false;
  if (String(creatorUserId) !== String(me)) return false;
  // If participants provided, ensure all are ready
  if (Array.isArray(participants) && participants.length > 0) {
    const allReady = participants.every(p => !!p.isReady);
    if (!allReady) return false;
  }
  return true;
}

export function canShowDrawButton({ isStarted, me, participants, result }) {
  if (!isStarted) return false; // must start first
  if (!me) return false;
  const my = (participants || []).find(p => String(p.userId) === String(me));
  if (!my) return false; // must be participant
  if (my.hasDrawn) return false; // only once
  // If game already has a completed result, no more draws
  if (result?.isCompleted) return false;
  return true;
}
