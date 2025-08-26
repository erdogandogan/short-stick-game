using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using ShortStickGame.Api.Entities;

namespace ShortStickGame.Api.Services;

// Bu sınıf uygulama için JWT erişim tokenı (access token) ve refresh token oluşturur.
// Ayrıca token doğrulama işlemleri için gereken TokenValidationParameters'ı sağlar.

// 1. kullanıcı giriş yapar
// 2. sunucu CreateAccessToken(user) ve CreateRefreshToken() çağırır
// 3. erişim tokenı client'a gönderilir. refresh token güvenli yerde saklanır
// 4. erişim tokenı süresi dolduğunda client refresh token ile yeni erişim tokenı ister,
//    sunucu refresh token'ı doğrular, yeni token üretir
public class JwtOptions
{
    public string Secret { get; set; } = string.Empty;
    public string Issuer { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;
    public int AccessTokenMinutes { get; set; } = 30;
    public int RefreshTokenDays { get; set; } = 7;
}

public interface ITokenService
{
    (string token, DateTime expiresAt) CreateAccessToken(User user);
    (string token, DateTime expiresAt) CreateRefreshToken();
    TokenValidationParameters GetValidationParameters();
}

public class TokenService : ITokenService
{
    private readonly JwtOptions _options;
    private readonly byte[] _keyBytes;

    public TokenService(IOptions<JwtOptions> options)
    {
        _options = options.Value;
        _keyBytes = Encoding.UTF8.GetBytes(_options.Secret); // -> Secret metnini byte dizisine çevirir
    }

    // Bu metot, kullanıcının bilgilerini (claim) içeren, imzalı ve belirli bir süresi olan JWT üretir.
    public (string token, DateTime expiresAt) CreateAccessToken(User user)
    {
        var expires = DateTime.UtcNow.AddMinutes(_options.AccessTokenMinutes);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.UniqueName, user.Username),
            new(JwtRegisteredClaimNames.Email, user.Email)
        };

        var creds = new SigningCredentials(new SymmetricSecurityKey(_keyBytes), SecurityAlgorithms.HmacSha256);
        var jwt = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expires,
            signingCredentials: creds
        );

        var token = new JwtSecurityTokenHandler().WriteToken(jwt);
        return (token, expires);
    }

    // Refresh token genelde sunucuda veritabanına (veya hashed olarak) kaydedilir.
    // Erişim tokenı süresi dolduğunda yeni erişim tokenı almak için kullanılır
    public (string token, DateTime expiresAt) CreateRefreshToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(64);
        var token = Convert.ToBase64String(bytes);
        var expires = DateTime.UtcNow.AddDays(_options.RefreshTokenDays);
        return (token, expires);
    }

    public TokenValidationParameters GetValidationParameters()
    {
        return new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = _options.Issuer,
            ValidAudience = _options.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(_keyBytes),
            ClockSkew = TimeSpan.Zero
        };
    }
}
