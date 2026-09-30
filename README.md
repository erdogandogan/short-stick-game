## Short Stick Game — Kısa Kılavuz

React Native (Expo) frontend + ASP.NET Core (.NET 8) Web API backend.

### Gerekli Araçlar

- .NET 8 SDK
- Node.js + npm
- Android Studio Emülatör veya USB ile Android cihaz (opsiyonel)

---

## Hızlı Başlangıç (Windows/PowerShell)

1. Backend’i çalıştır

```powershell
cd backend/ShortStickGame.Api
$env:Jwt__Secret = "en-az-32-karakterlik-rastgele-bir-deger-yazin"  # zorunlu
# Veritabanı parolası: appsettings.Development.json içindeki YOUR_DB_PASSWORD yerine kendi SA parolanız
dotnet restore
dotnet ef database update  # İlk kezse EF CLI: dotnet tool install --global dotnet-ef
dotnet run                 # HTTP: http://localhost:5189
```

2. Frontend’i başlat (API adresini belirt)

```powershell
cd frontend
npm install

# Gerçek cihaz (USB) + adb reverse
$env:EXPO_PUBLIC_API_BASE_URL = 'http://localhost:5189'

# Android emülatör için alternatif:
# $env:EXPO_PUBLIC_API_BASE_URL = 'http://10.0.2.2:5189'

npm start  # Expo dev server
```

İpucu: Varsayılan taban adresi `frontend/api.js` içindedir; environment ile geçersiz kılabilirsiniz.

---

## Proje Yapısı

- `backend/ShortStickGame.Api/`: .NET 8 Web API + EF Core
- `frontend/`: Expo tabanlı React Native uygulaması

---

## Sık Karşılaşılan Sorunlar (Kısa)

- 10061 bağlantı reddi: Backend çalışıyor mu ve 5189 portunu dinliyor mu? Base URL doğru mu (emülatör: 10.0.2.2)?
- Gerçek cihazda istekler: `adb reverse tcp:5189 tcp:5189` (Android Debug Bridge gerekir).
- Swagger: http://localhost:5189/swagger | Sağlık: http://localhost:5189/api/hello

---

## Notlar

- `Jwt:Secret` repoda boştur; en az 32 karakterlik rastgele bir değeri ortam değişkeni (`Jwt__Secret`) veya `dotnet user-secrets` ile verin. Aksi halde API başlamaz.
- Veritabanı parolasını (`ConnectionStrings__DefaultConnection`) de repoya yazmayın; `appsettings.Development.json` içindeki `YOUR_DB_PASSWORD` yer tutucusunu kendi ortamınızda değiştirin veya ortam değişkeniyle geçersiz kılın.
- Geliştirme dışında HTTPS ve güvenlik ayarlarını gözden geçirin.
