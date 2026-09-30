# Short Stick Game – DigitalOcean Ubuntu 22.04 Deployment Guide

This guide configures the .NET 8 Web API backend to run on port 5000 and the Expo/React Native frontend to use the Droplet public IP. It also installs SQL Server on Linux, opens firewall ports, and sets up a systemd service.

Assumptions

- Droplet public IP: YOUR_SERVER_IP
- OS: Ubuntu 22.04 (jammy)
- Backend listens on: http://0.0.0.0:5000
- Database: SQL Server 2022 on Linux (same droplet)
- App repo path on server: /srv/short-stick-game (you can choose another)

## 1) Prepare the Droplet

- Update system packages

```bash
sudo apt-get update && sudo apt-get -y upgrade
```

- Install prerequisites

```bash
sudo apt-get install -y curl wget unzip apt-transport-https ca-certificates gnupg lsb-release
```

## 2) Install .NET 8 Runtime & SDK

- Microsoft packages

```bash
wget https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb -O packages-microsoft-prod.deb
sudo dpkg -i packages-microsoft-prod.deb
sudo apt-get update
```

- Install .NET SDK/runtime (SDK useful for EF migrations)

```bash
sudo apt-get install -y dotnet-sdk-8.0 aspnetcore-runtime-8.0
```

Verify:

```bash
dotnet --info
```

## 3) Install SQL Server on Ubuntu

- Add Microsoft repo key and list file

```bash
sudo wget -qO- https://packages.microsoft.com/keys/microsoft.asc | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://packages.microsoft.com/ubuntu/22.04/prod jammy main"
sudo apt-get update
```

- Install SQL Server 2022

```bash
sudo apt-get install -y mssql-server
sudo /opt/mssql/bin/mssql-conf setup
```

Follow prompts to set SA password and edition (Developer for dev/testing).

- Install SQL Server command-line tools (optional but handy)

```bash
sudo apt-get install -y mssql-tools18 unixodbc-dev
# Add to PATH for current user
echo 'export PATH="$PATH:/opt/mssql-tools18/bin"' >> ~/.bashrc
source ~/.bashrc
```

- Test connection (replace password)

```bash
/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P 'YOUR_DB_PASSWORD' -C -Q "SELECT @@VERSION;"
```

## 4) Create DB and user (optional)

The app uses SA by default; you can keep SA or create a dedicated login.

```sql
CREATE DATABASE ShortStickGame;
-- Optional: create a dedicated SQL login
-- CREATE LOGIN shortstick WITH PASSWORD = 'StrongPassword!123';
-- USE ShortStickGame; CREATE USER shortstick FOR LOGIN shortstick; EXEC sp_addrolemember 'db_owner', 'shortstick';
```

Use sqlcmd:

```bash
sqlcmd -S localhost -U sa -P 'YOUR_DB_PASSWORD' -C -Q "CREATE DATABASE ShortStickGame;"
```

## 5) Clone or upload the app

```bash
sudo mkdir -p /srv/short-stick-game
sudo chown "$USER":"$USER" /srv/short-stick-game
cd /srv/short-stick-game
# Option A: git clone
# git clone <your-repo-url> .
# Option B: upload with scp/rsync
```

## 6) Configure backend for Droplet

The repo already includes these settings:

- Program.cs binds to 0.0.0.0:5000 so Kestrel is reachable from outside.
- appsettings.json connection string uses SQL Server with TrustServerCertificate.

Recommended production overrides with environment variables instead of editing files on server:

Set ASP.NET Core URLs and connection string in systemd (next step) or shell:

```bash
export ASPNETCORE_URLS="http://0.0.0.0:5000"
export ConnectionStrings__DefaultConnection="Server=localhost,1433;Database=ShortStickGame;User Id=sa;Password=YOUR_DB_PASSWORD;TrustServerCertificate=True;"
export Jwt__Secret="REPLACE_WITH_LONG_RANDOM_32_PLUS_CHARS"
```

Run migrations once (optional; app also runs Migrate on startup):

```bash
cd backend/ShortStickGame.Api
DOTNET_ENVIRONMENT=Production dotnet ef database update
```

If EF Tools not present, run `dotnet tool install --global dotnet-ef` and ensure PATH contains `~/.dotnet/tools`.

## 7) Run as a systemd service

Create service file:

```bash
sudo tee /etc/systemd/system/shortstick-api.service > /dev/null <<'UNIT'
[Unit]
Description=Short Stick Game API
After=network.target mssql-server.service

[Service]
WorkingDirectory=/srv/short-stick-game/backend/ShortStickGame.Api
ExecStart=/usr/bin/dotnet /srv/short-stick-game/backend/ShortStickGame.Api/bin/Release/net8.0/ShortStickGame.Api.dll
Restart=always
RestartSec=5
KillSignal=SIGINT
SyslogIdentifier=shortstick-api
User=www-data
Environment=DOTNET_ENVIRONMENT=Production
Environment=ASPNETCORE_URLS=http://0.0.0.0:5000
Environment=ConnectionStrings__DefaultConnection=Server=localhost,1433;Database=ShortStickGame;User Id=sa;Password=YOUR_DB_PASSWORD;TrustServerCertificate=True;
Environment=Jwt__Secret=REPLACE_WITH_LONG_RANDOM_32_PLUS_CHARS

[Install]
WantedBy=multi-user.target
UNIT
```

Publish and start:

```bash
cd /srv/short-stick-game/backend/ShortStickGame.Api
dotnet publish -c Release
sudo systemctl daemon-reload
sudo systemctl enable shortstick-api
sudo systemctl start shortstick-api
sudo systemctl status shortstick-api --no-pager -l
```

Logs:

```bash
journalctl -u shortstick-api -f --no-pager
```

Quick health checks:

```bash
curl http://127.0.0.1:5000/
curl http://127.0.0.1:5000/api/hello
```

## 8) UFW firewall and Droplet networking

- Enable UFW and allow required ports:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 5000/tcp   # backend HTTP
# If you expose SQL Server remotely (not recommended), then: sudo ufw allow 1433/tcp
sudo ufw enable
sudo ufw status
```

- In DigitalOcean control panel, also open port 5000 in the Droplet firewall rules if you use a DO Cloud Firewall.

- Ensure the app binds to 0.0.0.0:5000 (Program.cs or ASPNETCORE_URLS) so external devices can connect.

## 9) Frontend (Expo/React Native) configuration

- Set `EXPO_PUBLIC_API_BASE_URL` (e.g. `http://YOUR_SERVER_IP:5000`) as an environment variable or EAS env/secret. It is inlined at build-time by Expo.
- `frontend/api.js` automatically appends `/api` and normalizes HTTP for native devices.
- Android emulator/USB localhost rules (10.0.2.2 / adb reverse) are no longer needed because we now point to the Droplet IP.

Run locally with Expo:

```bash
cd frontend
# Optionally override on the fly for local dev
# On PowerShell (Windows):
# $env:EXPO_PUBLIC_API_BASE_URL="http://YOUR_SERVER_IP:5000"; npx expo start --tunnel
npx expo start --tunnel
```

When building with EAS, provide EXPO_PUBLIC_API_BASE_URL via EAS environment variables/secrets.

## 10) CORS and WebSockets

- Program.cs enables permissive CORS in Development. For Production, either keep it open (AllowAnyOrigin) or restrict to your client origins.
- WebSocket endpoint is `/ws`. The frontend derives ws://… from the HTTP base automatically; no change needed.

To lock down CORS in production:

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("ProdCors", policy =>
        policy.WithOrigins("https://yourapp.example", "http://yourapp.example")
              .AllowAnyHeader()
              .AllowAnyMethod());
});
// app.UseCors("ProdCors");
```

## 11) Optional: Reverse proxy (Nginx)

If you prefer standard ports and TLS:

- Set up Nginx to proxy 80/443 to Kestrel 5000.
- Obtain certificates with Certbot.
- Update CORS and EXPO_PUBLIC_API_BASE_URL to your domain with https.

Minimal Nginx server block:

```nginx
server {
    listen 80;
    server_name your.domain;
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection keep-alive;
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 12) Troubleshooting

- Connection refused from phone: check UFW, DO firewall, and that service is bound to 0.0.0.0:5000.
- 401 errors on refresh: ensure Jwt\_\_Secret in systemd matches appsettings or is set and long enough.
- EF migrations failing: confirm SQL Server is running and connection string is correct; check `/var/opt/mssql/log/errorlog`.
- Self-signed HTTPS issues on device: use HTTP (port 5000) or terminate TLS at Nginx with a valid certificate.

## 13) Summary of key values

- Backend URL: http://YOUR_SERVER_IP:5000
- Connection string: Server=localhost,1433;Database=ShortStickGame;User Id=sa;Password=YOUR_DB_PASSWORD;TrustServerCertificate=True;
- Expo base URL: EXPO_PUBLIC_API_BASE_URL=http://YOUR_SERVER_IP:5000
- WebSocket: ws://YOUR_SERVER_IP:5000/ws
