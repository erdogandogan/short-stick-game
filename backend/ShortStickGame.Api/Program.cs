using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using ShortStickGame.Api.Data;
using ShortStickGame.Api.Entities;
using ShortStickGame.Api.Services;

// Uygulama yapıcısı oluşturulur.
var builder = WebApplication.CreateBuilder(args);


// Servisleri ekle
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Short Stick Game API",
        Version = "v1"
    });

    var securityScheme = new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Description = "JWT Bearer token. Example: Bearer {your token}",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Reference = new OpenApiReference
        {
            Type = ReferenceType.SecurityScheme,
            Id = "Bearer"
        }
    };

    c.AddSecurityDefinition("Bearer", securityScheme);
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        { securityScheme, Array.Empty<string>() }
    });
});

// Seçenekler
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));

// Parola karma (hash) hizmeti
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();

// Token hizmeti
builder.Services.AddSingleton<ITokenService, TokenService>();

// Oyun hizmeti
builder.Services.AddScoped<IGameService, GameService>();
// Kullanıcı hizmeti
builder.Services.AddScoped<IUserService, UserService>();
// WebSocket yöneticisi (oyun güncellemelerini yayınlar)
builder.Services.AddSingleton<IGameWebSocketManager, GameWebSocketManager>();

// Kimlik doğrulama
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    // TokenService parametrelerini uygulama aşamasında elde ediyoruz; burada doğrudan yapılandırmadan bağlıyoruz
    var secret = builder.Configuration["Jwt:Secret"] ?? string.Empty;
    var issuer = builder.Configuration["Jwt:Issuer"];
    var audience = builder.Configuration["Jwt:Audience"];
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = issuer,
        ValidAudience = audience,
        IssuerSigningKey = new SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(secret)),
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization();

// Denetleyiciler
builder.Services.AddControllers();

// CORS: geliştirme sırasında Expo web geliştirme sunucusuna izin ver
builder.Services.AddCors(options =>
{
    options.AddPolicy("DevCors", policy =>
        policy
            .AllowAnyOrigin()
            .AllowAnyHeader()
            .AllowAnyMethod());
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Veritabanının oluşturulduğunu ve göçlerin (migration) otomatik uygulandığını garanti et
try
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
    Console.WriteLine("Database migrated successfully.");
}
catch (Exception ex)
{
    Console.WriteLine($"Database migration failed: {ex.Message}");
}

// Geliştirmede Kestrel'in tüm arayüzlerde dinlediğinden emin ol (LAN'daki fiziksel cihazlar API'ye erişebilsin)
// launchSettings.json varsayılan olarak localhost'a bağlar; geliştirme çalışmaları için burada geçersiz kıl
if (app.Environment.IsDevelopment())
{
    var httpUrl = "http://0.0.0.0:5189";
    var httpsUrl = "https://0.0.0.0:7189";
    // ASPNETCORE_URLS ayarlı değilse, varsayılanlarımızı kullan
    var configuredUrls = Environment.GetEnvironmentVariable("ASPNETCORE_URLS");
    if (string.IsNullOrWhiteSpace(configuredUrls))
    {
        app.Urls.Add(httpUrl);
        app.Urls.Add(httpsUrl);
        Console.WriteLine($"Binding URLs (dev): {httpUrl}, {httpsUrl}");
    }
}

app.UseRouting();
// WebSocket'leri etkinleştir
app.UseWebSockets();
if (app.Environment.IsDevelopment())
{
    app.UseCors("DevCors");
}
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Oyun güncellemeleri için basit WebSocket uç noktası
app.Map("/ws", async (HttpContext ctx, IGameWebSocketManager wsManager) =>
{
    if (!ctx.WebSockets.IsWebSocketRequest)
    {
        ctx.Response.StatusCode = StatusCodes.Status400BadRequest;
        await ctx.Response.WriteAsync("WebSocket connections only");
        return;
    }

    await wsManager.HandleClientAsync(ctx);
});

app.MapGet("/api/hello", () => Results.Ok("Hello World"));

// Sağlık durumu/basit kök bilgi
app.MapGet("/", () => new { name = "Short Stick Game API", version = "0.1.0" });

app.Urls.Add("http://0.0.0.0:5000");

app.Run();
