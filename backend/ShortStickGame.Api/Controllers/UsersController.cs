using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShortStickGame.Api.Data;
using ShortStickGame.Api.DTOs;
using ShortStickGame.Api.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace ShortStickGame.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IUserService _userService;

    public UsersController(AppDbContext db, IUserService userService)
    {
        _db = db;
        _userService = userService;
    }

    private bool TryGetAuthUserId(out Guid userId)
    {
        var userIdClaim = User.FindFirst(JwtRegisteredClaimNames.Sub) ?? User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim is null || !Guid.TryParse(userIdClaim.Value, out userId))
        {
            userId = Guid.Empty;
            return false;
        }
        return true;
    }

    // GET: /api/users/{id}/profile — Profil bilgisi getirir
    [HttpGet("{id:guid}/profile")]
    [Authorize]
    public async Task<ActionResult<UserProfileDto>> GetProfile([FromRoute] Guid id)
    {
        if (!TryGetAuthUserId(out var authId)) return Unauthorized(new { message = "Geçersiz oturum" });
        if (authId != id) return Forbid();
        try
        {
            var dto = await _userService.GetProfileAsync(id);
            return Ok(dto);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    // GET: /api/users/{id}/stats — Kullanıcının istatistiklerini getirir
    [HttpGet("{id:guid}/stats")]
    [Authorize]
    public async Task<ActionResult<UserStatsDto>> GetStats([FromRoute] Guid id)
    {
        if (!TryGetAuthUserId(out var authId)) return Unauthorized(new { message = "Geçersiz oturum" });
        if (authId != id) return Forbid();
        var dto = await _userService.GetStatsAsync(id);
        return Ok(dto);
    }

    // GET: /api/users/{id}/recent-games — Kullanıcının son oyunlarını listeler
    [HttpGet("{id:guid}/recent-games")]
    [Authorize]
    public async Task<ActionResult<IEnumerable<RecentGameItemDto>>> GetRecent([FromRoute] Guid id)
    {
        if (!TryGetAuthUserId(out var authId)) return Unauthorized(new { message = "Geçersiz oturum" });
        if (authId != id) return Forbid();
        var items = await _userService.GetRecentGamesAsync(id, 5);
        return Ok(items);
    }

    // PUT: /api/users/{id}/update-username — Kullanıcı adını günceller
    [HttpPut("{id:guid}/update-username")]
    [Authorize]
    public async Task<IActionResult> UpdateUsername([FromRoute] Guid id, [FromBody] UpdateUsernameDto dto)
    {
        if (!TryGetAuthUserId(out var authId)) return Unauthorized(new { message = "Geçersiz oturum" });
        if (authId != id) return Forbid();
        try
        {
            await _userService.UpdateUsernameAsync(id, dto.Username);
            return NoContent();
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    // PUT: /api/users/{id}/update-email — E-posta adresini günceller
    [HttpPut("{id:guid}/update-email")]
    [Authorize]
    public async Task<IActionResult> UpdateEmail([FromRoute] Guid id, [FromBody] UpdateEmailDto dto)
    {
        if (!TryGetAuthUserId(out var authId)) return Unauthorized(new { message = "Invalid token" });
        if (authId != id) return Forbid();
        try
        {
            await _userService.UpdateEmailAsync(id, dto.Email);
            return NoContent();
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    // PUT: /api/users/{id}/update-password — Şifreyi günceller
    [HttpPut("{id:guid}/update-password")]
    [Authorize]
    public async Task<IActionResult> UpdatePassword([FromRoute] Guid id, [FromBody] UpdatePasswordDto dto)
    {
        if (!TryGetAuthUserId(out var authId)) return Unauthorized(new { message = "Invalid token" });
        if (authId != id) return Forbid();
        try
        {
            await _userService.UpdatePasswordAsync(id, dto.CurrentPassword, dto.NewPassword);
            return NoContent();
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    // GET: /api/users/{id}/games
    // Kullanıcının sahibi olduğu veya katıldığı oyunları, katılımcılar ve kısa çubuk bilgisiyle birlikte döner
    [HttpGet("{id:guid}/games")]
    [Authorize]
    public async Task<ActionResult<IEnumerable<GameHistoryItemDto>>> GetUserGames([FromRoute] Guid id)
    {
        // Sadece kullanıcının kendi geçmişini almasına izin ver
        if (!TryGetAuthUserId(out var authUserId)) return Unauthorized(new { message = "Geçersiz oturum" });
        if (authUserId != id) return Forbid();

        // Kullanıcının sahibi olduğu veya katılımcı olduğu oyun kimliklerini topla
        var ownerQuery = _db.Games
            .AsNoTracking()
            .Where(g => g.CreatorUserId == id)
            .Select(g => g.Id);

        var participantQuery = _db.GameUsers
            .AsNoTracking()
            .Where(gu => gu.UserId == id)
            .Select(gu => gu.GameId);

        var ids = await ownerQuery
            .Concat(participantQuery)
            .Distinct()
            .ToListAsync();

        if (ids.Count == 0)
            return Ok(Array.Empty<GameHistoryItemDto>());

        // Oyunları temel alanlarıyla birlikte yükle
        var games = await _db.Games
            .AsNoTracking()
            .Where(g => ids.Contains(g.Id))
            .Select(g => new
            {
                g.Id,
                g.IsGlobal,
                g.PenaltyText,
                g.StartedDate,
                g.CompletedDate
            })
            .ToListAsync();

        // Bu oyunların katılımcılarını yükle
        var participants = await _db.GameUsers
            .AsNoTracking()
            .Where(gu => ids.Contains(gu.GameId))
            .Join(
                _db.Users.AsNoTracking(),
                gu => gu.UserId,
                u => u.Id,
                (gu, u) => new
                {
                    gu.GameId,
                    gu.UserId,
                    u.Username,
                    gu.IsShortStick
                }
            )
            .ToListAsync();

        // Bellekte oyun başına gruplayarak geçmiş listesini oluştur
        var list = games
            .OrderByDescending(g => g.CompletedDate ?? g.StartedDate ?? DateTime.MinValue)
            .Select(g =>
            {
                var rows = participants.Where(p => p.GameId == g.Id).ToList();
                var shortRow = rows.FirstOrDefault(p => p.IsShortStick);
                var dto = new GameHistoryItemDto(
                    g.Id,
                    g.IsGlobal,
                    g.PenaltyText,
                    g.StartedDate,
                    g.CompletedDate,
                    shortRow?.UserId,
                    shortRow?.Username,
                    rows.Select(r => new HistoryParticipantDto(r.UserId, r.Username)).ToList()
                );
                return dto;
            })
            .ToList();

        return Ok(list);
    }
}
