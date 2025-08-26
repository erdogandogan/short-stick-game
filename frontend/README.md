# Frontend Create/Join Screens

This app includes CreateGameScreen and JoinGameScreen wired to the ASP.NET Core API.

Key points:

- CreateGameScreen validates `penaltyText` and a local `gameType` selection (kept client-side; backend currently ignores it).
- JoinGameScreen accepts a GameId (GUID). Invite code support can be added later.
- Both screens send JWT automatically via axios interceptor.
- On success, they navigate to `GameDetail`.

Environment:

- Set API base URL if needed:

```powershell
$env:EXPO_PUBLIC_API_BASE_URL="http://<LAN-IP>:5189"; npm run android
```

Manual checks:

1. Invalid create (empty fields) -> Alert appears, button disabled while loading.
2. Join with invalid GUID -> Alert appears.
3. Token removed -> protected calls fail; you should be redirected to Login upon 401 during list load.
   Short Stick Game - Frontend (Expo React Native)

Run on Android device via USB:

1. Start backend (ASP.NET Core) on Windows so it listens on http://localhost:5189
2. Connect device with USB and enable USB debugging (Developer options)
3. In another shell, set up port reverse so device can reach localhost:

   adb reverse tcp:5189 tcp:5189

4. Start Expo and launch on Android:

   npm start

   # then press 'a' for Android or run: npm run android

Notes

- Cleartext HTTP is allowed on Android for development (usesCleartextTraffic: true)
- You can override API base URL with EXPO_PUBLIC_API_BASE_URL env var

Examples (PowerShell):

```powershell
# Real device over USB (with adb reverse):
$env:EXPO_PUBLIC_API_BASE_URL = 'http://localhost:5189'

# Android Emulator (Android Studio):
$env:EXPO_PUBLIC_API_BASE_URL = 'http://10.0.2.2:5189'

npm start
```

Troubleshooting (Windows):

```powershell
# Check backend listening on 5189
netstat -ano | findstr :5189
tasklist /FI "PID eq <PID>"

# Optional: check if something uses 5562 (this project doesn't)
netstat -ano | findstr :5562

# Quick health check
curl http://localhost:5189/api/hello
```
