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

// Add services
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

// Options
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));

// Password hasher
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();

// Token service
builder.Services.AddSingleton<ITokenService, TokenService>();

// Game service
builder.Services.AddScoped<IGameService, GameService>();
// User service
builder.Services.AddScoped<IUserService, UserService>();
// WebSocket manager (broadcast game updates)
builder.Services.AddSingleton<IGameWebSocketManager, GameWebSocketManager>();

// Auth
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    // We resolve TokenService later in app to get parameters; here bind directly from configuration
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

// Controllers
builder.Services.AddControllers();

// CORS: allow Expo web dev server during development
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

// Ensure database is created and migrations are applied automatically
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

// Ensure Kestrel listens on all interfaces so physical devices on LAN can reach the API in dev
// launchSettings.json binds to localhost by default; override here for dev runs
if (app.Environment.IsDevelopment())
{
    var httpUrl = "http://0.0.0.0:5189";
    var httpsUrl = "https://0.0.0.0:7189";
    // If ASPNETCORE_URLS isn't set, use our defaults
    var configuredUrls = Environment.GetEnvironmentVariable("ASPNETCORE_URLS");
    if (string.IsNullOrWhiteSpace(configuredUrls))
    {
        app.Urls.Add(httpUrl);
        app.Urls.Add(httpsUrl);
        Console.WriteLine($"Binding URLs (dev): {httpUrl}, {httpsUrl}");
    }
}

app.UseRouting();
// Enable WebSockets
app.UseWebSockets();
if (app.Environment.IsDevelopment())
{
    app.UseCors("DevCors");
}
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Simple WebSocket endpoint for game updates
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

// Health/simple root info
app.MapGet("/", () => new { name = "Short Stick Game API", version = "0.1.0" });

app.Run();
