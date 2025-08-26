using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShortStickGame.Api.Data;
using ShortStickGame.Api.DTOs;
using ShortStickGame.Api.Entities;
using ShortStickGame.Api.Services;

namespace ShortStickGame.Api.Controllers;

// Bu controller kullanıcı kaydı, giriş ve refresh token ile yeni token alma işlemlerini yönetir.

// [ApiController] -> model binding ve model validation işlemlerini otomatik olarak yapar.
// Route("api/[controller]") -> controller için varsayılan route'u ayarlar. (api/auth)
[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IPasswordHasher<User> _hasher;
    private readonly ITokenService _tokenService;

    public AuthController(AppDbContext db, IPasswordHasher<User> hasher, ITokenService tokenService)
    {
        _db = db;
        _hasher = hasher;
        _tokenService = tokenService;
    }

    // Kullanıcı kaydı için endpoint
    // POST api/auth/register
    // Kullanıcı kaydı için gerekli bilgileri alır ve yeni bir kullanıcı oluşturur.
    // - Yeni user nesnesi oluşturur
    // - Şifreyi hash'ler
    // - Veritabanına ekler
    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponseDto>> Register([FromBody] UserRegisterDto dto)
    {
        // Normalize inputs: trim and lower-case email for comparisons/storage
        var username = dto.Username.Trim();
        var email = dto.Email.Trim().ToLowerInvariant();

        var exists = await _db.Users.AnyAsync(u => u.Username == username || u.Email == email);
        if (exists)
            return Conflict(new { message = "Kullanıcı adı veya e-posta zaten kullanımda" });

        var user = new User
        {
            Username = username,
            Email = email
        };
        user.PasswordHash = _hasher.HashPassword(user, dto.Password);

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        // Access token ve refresh token üretir
        // Refresh token'ı kullanıcıya kaydeder, son kullanma tarihini yazar
        var (access, exp) = _tokenService.CreateAccessToken(user);
        var (refresh, refreshExp) = _tokenService.CreateRefreshToken();
        user.RefreshToken = refresh;
        user.RefreshTokenExpiresAt = refreshExp;
        await _db.SaveChangesAsync();

        // 200 OK ile token bilgilerini döner
        return Ok(new AuthResponseDto(access, refresh, exp));
    }

    // Kullanıcı girişi için endpoint
    // POST api/auth/login
    // Kullanıcı adı veya e-posta ile giriş yapmayı dener.
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponseDto>> Login([FromBody] UserLoginDto dto)
    {
        var input = (dto.UsernameOrEmail ?? string.Empty).Trim();
        var inputEmail = input.Contains('@') ? input.ToLowerInvariant() : null;
        var user = await _db.Users.FirstOrDefaultAsync(u =>
            u.Username == input || (inputEmail != null && u.Email == inputEmail));
        if (user is null)
            return Unauthorized(new { message = "Geçersiz kullanıcı bilgileri" });

        var result = _hasher.VerifyHashedPassword(user, user.PasswordHash, dto.Password);
        if (result == PasswordVerificationResult.Failed)
            return Unauthorized(new { message = "Geçersiz kullanıcı bilgileri" });

        // Access token ve refresh token üretir.
        // Refresh token'ı ve süresini kullanıcıya kaydeder.
        var (access, exp) = _tokenService.CreateAccessToken(user);
        var (refresh, refreshExp) = _tokenService.CreateRefreshToken();
        user.RefreshToken = refresh;
        user.RefreshTokenExpiresAt = refreshExp;
        await _db.SaveChangesAsync();

        // Token bilgilerini döner.
        return Ok(new AuthResponseDto(access, refresh, exp));
    }

    public record RefreshRequest(string RefreshToken);

    // Refresh token boş mu kontrol eder.
    // Veritabanında bu token'a sahip kullanıcıyı arar.
    // - Yeni bir access token ve refresh token oluşturur.
    // - Refresh token'ı günceller.
    // - Token bilgilerini döner.
    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponseDto>> Refresh([FromBody] RefreshRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
            return BadRequest(new { message = "Yenileme belirteci (refresh token) gerekli" });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.RefreshToken == request.RefreshToken);
        if (user is null || user.RefreshTokenExpiresAt is null || user.RefreshTokenExpiresAt < DateTime.UtcNow)
            return Unauthorized(new { message = "Geçersiz veya süresi dolmuş yenileme belirteci" });

        var (access, exp) = _tokenService.CreateAccessToken(user);
        var (refresh, refreshExp) = _tokenService.CreateRefreshToken();
        user.RefreshToken = refresh;
        user.RefreshTokenExpiresAt = refreshExp;
        await _db.SaveChangesAsync();

        return Ok(new AuthResponseDto(access, refresh, exp));
    }
}
