## Short Stick Game

React Native (Expo) frontend ve ASP.NET Core (.NET 8) Web API backend.

### Hızlı Başlangıç (Windows/PowerShell)

1. Backend’i derle/çalıştır

```powershell
cd backend/ShortStickGame.Api
dotnet restore
dotnet ef database update   # İlk kezse; gerekirse: dotnet tool install --global dotnet-ef
dotnet run                  # HTTP: http://localhost:5189 (HTTPS: 7189)
```

2. Frontend’i başlat (API adresini bildir)

```powershell
cd frontend
npm install

# USB ile gerçek cihaz + adb reverse
$env:EXPO_PUBLIC_API_BASE_URL = 'http://localhost:5189'

# Android Emülatör için (Android Studio / AOSP):
# $env:EXPO_PUBLIC_API_BASE_URL = 'http://10.0.2.2:5189'

npm start   # Expo dev server (8081)
```

3. Android’de çalıştırma

- USB ile gerçek cihaz: ayrı bir PowerShell penceresinde port yönlendirmesi açın (repo içindeki platform-tools kullanılabilir):

```powershell
./frontend/platform-tools/adb.exe reverse tcp:5189 tcp:5189
```

- Emülatör: `EXPO_PUBLIC_API_BASE_URL` olarak `http://10.0.2.2:5189` kullanın (reverse gerekmez).

### Monorepo Yapısı

- `frontend/`: Expo tabanlı React Native uygulaması
- `backend/ShortStickGame.Api/`: .NET 8 Web API + EF Core (SQL Server)
- `short-stick-game.code-workspace`: VS Code workspace ayarı

---

## Backend (ASP.NET Core Web API)

Özellikler:

- JWT + Refresh Token ile kimlik doğrulama
- Kullanıcı kayıt/giriş/yenileme endpoint’leri
- Sadece Auth’lu erişilebilen test endpoint’i
- EF Core ile SQL Server migration ve veritabanı şeması
- Oyun (Game) ve katılımcı (GameUser) modelleri, Games API (create/join/get)

### Önemli Dosyalar

- `Entities/User.cs`: Guid Id, Username (unique), Email (unique), PasswordHash, RefreshToken, RefreshTokenExpiresAt
- `Entities/Game.cs`: Guid Id, CreatorUserId, PenaltyText, IsStarted, CreatedDate, Participants navigasyonu
- `Entities/GameUser.cs`: Guid Id, GameId, UserId, JoinDate, HasDrawn, IsShortStick, DrawOrder (nullable)
- `Services/TokenService.cs`: JWT üretimi/validasyonu ve refresh token üretimi
- `Controllers/AuthController.cs`: register/login/refresh
- `Controllers/TestController.cs`: `[Authorize]` korumalı test endpoint’i
- `Controllers/GamesController.cs`: oyun oluşturma/katılma/detay endpoint’leri
- `DTOs/GameCreateDto.cs`, `DTOs/GameJoinDto.cs`, `DTOs/GameDetailDto.cs`
- `Data/AppDbContext.cs`: `Users`, `Games`, `GameUsers` DbSet ve ilişkiler (Fluent API)
- `appsettings.json`: `ConnectionStrings` + `Jwt` ayarları

### Kurulum

```powershell
cd backend/ShortStickGame.Api
dotnet restore
dotnet build
```

### Veritabanı ve Migration

appsettings.json içindeki bağlantı dizesini ihtiyacına göre düzenle:

```
"ConnectionStrings": {
	"DefaultConnection": "Server=(localdb)\\mssqllocaldb;Database=ShortStickGameDb;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True"
}
```

Migration ve DB güncelleme:

```powershell
# EF CLI yoksa yükle (tek seferlik)
dotnet tool install --global dotnet-ef

# Yeni modeller için migration oluştur (Game ve GameUser)
dotnet ef migrations add AddGameAndGameUser -p .\backend\ShortStickGame.Api -s .\backend\ShortStickGame.Api -o Data\Migrations

# Veritabanına uygula
dotnet ef database update -p .\backend\ShortStickGame.Api -s .\backend\ShortStickGame.Api
```

Notlar:

- Daha önce `InitialCreate` migration’ı Games tablosunu (int Id, Code) içeriyorsa, yeni entity yapısı (Guid Id, PenaltyText vb.) için oluşturulan migration tabloyu değiştirebilir. Geliştirme ortamında çakışma yaşarsanız veritabanını sıfırlayabilir veya sadece `Games` tablosunu düşürüp yeniden migrate edebilirsiniz.
- Geliştirmede hızlı sıfırlama için alternatifler: veritabanını silip `dotnet ef database update` çalıştırmak ya da `Data/Migrations` klasörünü temizleyip yeni migration üretmek. Canlı ortamda bunu yapmayın.

### Çalıştırma

```powershell
dotnet run --project .\backend\ShortStickGame.Api
```

Swagger (Development) ile test edebilirsin. Port, konsolda gösterilir.

Hızlı sağlık kontrolü:

```powershell
curl http://localhost:5189/api/hello
```

### JWT Ayarları

`appsettings.json` içindeki `Jwt` bölümünü doldur:

```json
"Jwt": {
	"Secret": "CHANGE_ME_TO_A_LONG_RANDOM_SECRET_32+CHARS",
	"Issuer": "ShortStickGame",
	"Audience": "ShortStickGame.Client",
	"AccessTokenMinutes": 30,
	"RefreshTokenDays": 7
}
```

### Auth Endpoint’leri

- POST `/api/auth/register`

  - Body: `{ "username": "u", "email": "e@mail.com", "password": "P@ssw0rd" }`
  - 200: `{ accessToken, refreshToken, expiresAtUtc }`

- POST `/api/auth/login`

  - Body: `{ "usernameOrEmail": "u", "password": "P@ssw0rd" }`
  - 200: `{ accessToken, refreshToken, expiresAtUtc }`

- POST `/api/auth/refresh`

  - Body: `{ "refreshToken": "..." }`
  - 200: `{ accessToken, refreshToken, expiresAtUtc }`

- GET `/api/test`
  - Header: `Authorization: Bearer <accessToken>`
  - 200: `{ message, time }`

### Games Endpoint’leri

- POST `/api/games/create` (Authorize)

  - Body:
    ```json
    {
      "creatorUserId": "<GUID>",
      "penaltyText": "Kaybeden kahve ısmarlar."
    }
    ```
  - 200: GameDetailDto (aşağıda)

- POST `/api/games/{id}/join` (Authorize)

  - Body:
    ```json
    {
      "userId": "<GUID>"
    }
    ```
  - Hatalar: 404 (Game/User yok), 400 (Game başladı), 409 (Zaten katıldı)

- GET `/api/games/{id}` (Anonymous)
  - 200: GameDetailDto

GameDetailDto örneği:

```json
{
  "id": "9ef4b1a1-3f6c-4b9b-8b6a-ef3d3db3b1b2",
  "creatorUserId": "11111111-1111-1111-1111-111111111111",
  "penaltyText": "Kaybeden kahve ısmarlar.",
  "isStarted": false,
  "createdDate": "2025-08-13T12:00:00Z",
  "participants": [
    {
      "userId": "11111111-1111-1111-1111-111111111111",
      "username": "creator",
      "joinDate": "2025-08-13T12:00:00Z",
      "hasDrawn": false,
      "isShortStick": false,
      "drawOrder": null
    }
  ]
}
```

Test akışı önerisi (Swagger veya Postman):

1. `POST /api/auth/register` ile iki kullanıcı oluştur, token’larını al.
2. Creator token’ı ile `POST /api/games/create` çağır.
3. Diğer kullanıcı token’ı ile `POST /api/games/{id}/join` çağır.
4. `GET /api/games/{id}` ile katılımcıları doğrula.

---

## Frontend (Expo)

```powershell
cd frontend
npm install
npx expo start
```

API tabanı için environment variable kullanın:

```powershell
# USB ile gerçek cihaz + adb reverse
$env:EXPO_PUBLIC_API_BASE_URL = 'http://localhost:5189'

# Android emülatör
$env:EXPO_PUBLIC_API_BASE_URL = 'http://10.0.2.2:5189'

npm start
```

Notlar:

- Frontend `frontend/api.js` dosyasında varsayılan `http://localhost:5189/api` kullanır; ancak cihaz/emülatör farklılıkları için `EXPO_PUBLIC_API_BASE_URL` ile geçersiz kılın.
- Expo geliştirme sunucusu 8081’de çalışır; bu port API ile ilgili değildir.

---

## Notlar

- `Jwt:Secret` için güçlü ve uzun bir değer kullanın.
- Üretimde HTTPS ve güvenli cookie/policy ayarlarını gözden geçirin.
- Swagger’a Bearer auth şeması eklemek isterseniz ekleyebilirim.
- Eski `backend/ShortStickGame.Api/Models/Game.cs` artık kullanılmıyor. Karışıklığı önlemek için silmeniz önerilir.

---

## Bağlantı Sorunları ve Hata Giderme (TCP 10061 / 127.0.0.1)

“Hedef makine etkin olarak reddettiğinden bağlantı kurulamadı. (10061)” hatası, istek atılan portta bir servis dinlemediğini veya yanlış port/ip kullanıldığını gösterir.

Bu proje için beklenen API adresleri:

- HTTP: `http://localhost:5189`
- HTTPS (geliştirme sertifikası): `https://localhost:7189` (mobil cihazlar self-signed sertifikayı reddedebilir; yerelde HTTP kullanın)

Kontrol listesi:

1. Backend gerçekten 5189’u dinliyor mu?

```powershell
netstat -ano | findstr :5189
# LISTENING satırının PID’sini not alın, sonra:
tasklist /FI "PID eq <PID>"
```

2. Frontend doğru base URL’e mi istek atıyor?

- `EXPO_PUBLIC_API_BASE_URL` değerini kontrol edin.
- Android emülatörde `10.0.2.2`, USB gerçek cihazda `localhost` + `adb reverse` kullanın.

3. `5562` portu nereden geliyor?

- Bu repo 5562’yi kullanmaz. Eğer loglarda `127.0.0.1:5562` görünüyorsa, muhtemelen farklı bir servis/ayar veya eski bir konfig referansı vardır. Aşağıdakileri kontrol edin:
  - Frontend `EXPO_PUBLIC_API_BASE_URL` ve `frontend/api.js`
  - Cihaz/Emülatör proxy/VPN
  - Paralel çalışan başka bir uygulama

Hızlı tarama (opsiyonel):

```powershell
netstat -ano | findstr :5562
```

4. Windows Güvenlik Duvarı

- İlk çalıştırmada .NET uygulamasına izin verin veya Windows Güvenlik Duvarı Gelişmiş Ayarları’ndan kural ekleyin.

5. Sağlık kontrolü ve Swagger

```powershell
curl http://localhost:5189/api/hello
# Swagger: http://localhost:5189/swagger
```
