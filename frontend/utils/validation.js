// Ekranlar ve testler tarafından kullanılan basit doğrulama yardımcıları

export function isGuid(str) {
  if (!str || typeof str !== 'string') return false;
  const s = str.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export function canCreateGame({ penaltyText, gameType }) {
  if (!penaltyText || !penaltyText.trim()) {
    return { ok: false, error: 'Ceza metni boş olamaz' };
  }
  if (!gameType) {
    return { ok: false, error: 'Lütfen bir oyun türü seçin' };
  }
  return { ok: true };
}

export function canJoin({ code }) {
  if (!code || !code.trim()) {
    return { ok: false, error: 'Kod boş olamaz' };
  }
  if (!isGuid(code)) {
    return { ok: false, error: 'Geçerli bir GameId giriniz (GUID formatında). Davet kodu desteği yakında eklenecek.' };
  }
  return { ok: true };
}
