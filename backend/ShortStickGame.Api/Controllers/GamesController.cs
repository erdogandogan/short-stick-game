using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShortStickGame.Api.Data;
using ShortStickGame.Api.DTOs;
using ShortStickGame.Api.Entities;
using ShortStickGame.Api.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace ShortStickGame.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class GamesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IGameService _gameService; // start, draw, result işlemleri
    private readonly IGameWebSocketManager _ws;

    public GamesController(AppDbContext db, IGameService gameService, IGameWebSocketManager ws)
    {
        _db = db;
        _gameService = gameService;
        _ws = ws;
    }

    // Sadece oyunun sahibi silebilir; GameUsers kayıtları cascade ile silinir
    // DELETE: /api/games/{id}
    [HttpDelete("{id:guid}")]
    [Authorize]
    public async Task<IActionResult> Delete([FromRoute] Guid id)
    {
        var userIdClaim = User.FindFirst(JwtRegisteredClaimNames.Sub) ?? User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim is null || !Guid.TryParse(userIdClaim.Value, out var userId))
            return Unauthorized(new { message = "Geçersiz oturum" });

        var game = await _db.Games.FirstOrDefaultAsync(g => g.Id == id);
        if (game is null)
            return NotFound(new { message = "Oyun bulunamadı" });

        if (game.CreatorUserId != userId)
            return Forbid();

        _db.Games.Remove(game);
        await _db.SaveChangesAsync();
        await _ws.BroadcastAsync(id, "game-deleted", new { gameId = id });
        return NoContent();
    }

    // Mevcut kullanıcının sahibi olduğu veya katıldığı oyunların listesini döner
    // GET: /api/games
    [HttpGet]
    [Authorize]
    public async Task<ActionResult<IEnumerable<ShortStickGame.Api.DTOs.GameListItemDto>>> GetMyGames()
    {
        var userIdClaim = User.FindFirst(JwtRegisteredClaimNames.Sub) ?? User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim is null || !Guid.TryParse(userIdClaim.Value, out var userId))
            return Unauthorized(new { message = "Geçersiz oturum" });

        // 1) Owner games (EF-translatable)
        var ownerRows = await _db.Games
            .AsNoTracking()
            .Where(g => g.CreatorUserId == userId)
            .Select(g => new
            {
                g.Id,
                g.PenaltyText,
                g.IsStarted,
                g.IsCompleted,
                g.IsGlobal,
                g.CreatedDate,
                g.StartedDate,
                g.CompletedDate,
                g.CreatorUserId,
                ParticipantCount = _db.GameUsers.Count(gu => gu.GameId == g.Id),
                IsOwner = true
            })
            .ToListAsync();

        // 2) Participant games (EF-translatable)
        var participantRows = await _db.GameUsers
            .AsNoTracking()
            .Where(gu => gu.UserId == userId)
            .Join(
                _db.Games.AsNoTracking(),
                gu => gu.GameId,
                g => g.Id,
                (gu, g) => new
                {
                    g.Id,
                    g.PenaltyText,
                    g.IsStarted,
                    g.IsCompleted,
                    g.IsGlobal,
                    g.CreatedDate,
                    g.StartedDate,
                    g.CompletedDate,
                    g.CreatorUserId,
                    ParticipantCount = _db.GameUsers.Count(x => x.GameId == g.Id),
                    IsOwner = g.CreatorUserId == userId
                }
            )
            .ToListAsync();

        // 3) Public/global games visible to everyone (regardless of ownership/participation)
        var globalRows = await _db.Games
            .AsNoTracking()
            .Where(g => g.IsGlobal)
            .Select(g => new
            {
                g.Id,
                g.PenaltyText,
                g.IsStarted,
                g.IsCompleted,
                g.IsGlobal,
                g.CreatedDate,
                g.StartedDate,
                g.CompletedDate,
                g.CreatorUserId,
                ParticipantCount = _db.GameUsers.Count(gu => gu.GameId == g.Id),
                IsOwner = g.CreatorUserId == userId // sadece kullanıcı sahipse true; aksi halde false
            })
            .ToListAsync();

        // 4) Bellekte birleştir: globalleri de dahil et, kopya varsa sahibi olanı tercih et
        var combined = ownerRows
            .Concat(participantRows)
            .Concat(globalRows)
            .GroupBy(x => x.Id)
            .Select(g => g.OrderByDescending(x => x.IsOwner).First())
            .OrderByDescending(x => x.CreatedDate)
            .ToList();

        var list = combined.Select(x => new ShortStickGame.Api.DTOs.GameListItemDto(
            x.Id,
            x.PenaltyText,
            x.IsStarted,
            x.IsCompleted,
            x.IsGlobal,
            x.CreatedDate,
            x.StartedDate,
            x.CompletedDate,
            x.CreatorUserId,
            x.ParticipantCount,
            x.IsOwner
        )).ToList();

        return Ok(list);
    }

    // JWT'den kullanıcı ID alınır
    // Yeni bir oyun ve oyun sahibi eklenir
    // Oyun ve katılımcılarla birlikte detay DTO'su döner
    // POST: /api/games/create
    [HttpPost("create")]
    [Authorize]
    public async Task<ActionResult<GameDetailDto>> Create([FromBody] GameCreateDto dto)
    {
        // Kullanıcı kimliğini JWT'den al (sub veya nameidentifier)
        var userIdClaim = User.FindFirst(JwtRegisteredClaimNames.Sub) ?? User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim is null || !Guid.TryParse(userIdClaim.Value, out var userId))
            return Unauthorized(new { message = "Geçersiz oturum" });

        // Basit doğrulama: oluşturucu kullanıcının var olduğundan emin ol
        var creatorExists = await _db.Users.AnyAsync(u => u.Id == userId);
        if (!creatorExists)
            return NotFound(new { message = "Oluşturucu kullanıcı bulunamadı" });

        var game = new Game
        {
            CreatorUserId = userId,
            PenaltyText = dto.PenaltyText.Trim(),
            IsStarted = false,
            IsGlobal = dto.IsGlobal ?? (string.Equals(dto.GameType, "global", StringComparison.OrdinalIgnoreCase)),
            CreatedDate = DateTime.UtcNow
        };

        _db.Games.Add(game);
        // Oluşturucuyu varsayılan olarak katılımcı olarak ekle
        _db.GameUsers.Add(new GameUser
        {
            GameId = game.Id,
            UserId = userId,
            JoinDate = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        return Ok(await BuildDetailDto(game.Id));
    }

    // Kullanıcı belirli bir oyuna katılabilir
    // Kontroller: oyun var mı, başladı mı, kullanıcı daha önce katıldı mı
    // Başarılı olursa GameUsers tablosuna eklenir ve güncel oyun detayları döner
    // POST: /api/games/{id}/join
    [HttpPost("{id:guid}/join")]
    [Authorize]
    public async Task<ActionResult<GameDetailDto>> Join([FromRoute] Guid id, [FromBody] GameJoinDto dto)
    {
        var game = await _db.Games.FirstOrDefaultAsync(g => g.Id == id);
        if (game is null)
            return NotFound(new { message = "Oyun bulunamadı" });

        if (game.IsStarted)
            return BadRequest(new { message = "Oyun zaten başlatıldı" });

        var userExists = await _db.Users.AnyAsync(u => u.Id == dto.UserId);
        if (!userExists)
            return NotFound(new { message = "Kullanıcı bulunamadı" });

        var alreadyJoined = await _db.GameUsers.AnyAsync(gu => gu.GameId == id && gu.UserId == dto.UserId);
        if (alreadyJoined)
            return Conflict(new { message = "Bu oyuna zaten katıldınız" });

        _db.GameUsers.Add(new GameUser
        {
            GameId = id,
            UserId = dto.UserId,
            JoinDate = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        var detailAfterJoin = await BuildDetailDto(id);
        await _ws.BroadcastAsync(id, "game-updated", detailAfterJoin);
        return Ok(detailAfterJoin);
    }

    // Oyun bilgilerini ve katılımcı listesini döner
    // GET: /api/games/{id}
    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    public async Task<ActionResult<GameDetailDto>> Get([FromRoute] Guid id)
    {
        var exists = await _db.Games.AnyAsync(g => g.Id == id);
        if (!exists)
            return NotFound(new { message = "Game not found" });

        var dto = await BuildDetailDto(id);
        return Ok(dto);
    }

    // Tüm kimliği doğrulanmış kullanıcılar tarafından görülebilen herkese açık/global oyunlar
    // GET: /api/games/global
    [HttpGet("global")]
    [Authorize]
    public async Task<ActionResult<IEnumerable<GameListItemDto>>> GetGlobalGames()
    {
        var rows = await _db.Games
            .AsNoTracking()
            .Where(g => g.IsGlobal)
            .Select(g => new
            {
                g.Id,
                g.PenaltyText,
                g.IsStarted,
                g.IsCompleted,
                g.IsGlobal,
                g.CreatedDate,
                g.StartedDate,
                g.CompletedDate,
                g.CreatorUserId,
                ParticipantCount = _db.GameUsers.Count(gu => gu.GameId == g.Id)
            })
            .OrderByDescending(x => x.CreatedDate)
            .ToListAsync();

        var list = rows.Select(x => new GameListItemDto(
            x.Id,
            x.PenaltyText,
            x.IsStarted,
            x.IsCompleted,
            x.IsGlobal,
            x.CreatedDate,
            x.StartedDate,
            x.CompletedDate,
            x.CreatorUserId,
            x.ParticipantCount,
            IsOwner: false
        )).ToList();

        return Ok(list);
    }

    // Oyunun tüm detaylarını ve katılımcı bilgilerini derler
    private async Task<GameDetailDto> BuildDetailDto(Guid gameId)
    {
        var game = await _db.Games.AsNoTracking().FirstAsync(g => g.Id == gameId);
        var participants = await _db.GameUsers
            .AsNoTracking()
            .Where(gu => gu.GameId == gameId)
            .Join(
                _db.Users.AsNoTracking(),
                gu => gu.UserId,
                u => u.Id,
                (gu, u) => new { gu, u }
            )
            // Varlık alanlarına göre sırala (EF tarafından çevrilebilir), ardından projeksiyon uygula
            .OrderBy(x => x.gu.DrawOrder == null) // null'lar en sonda
            .ThenBy(x => x.gu.DrawOrder)
            .ThenBy(x => x.u.Username)
            .Select(x => new GameParticipantDto(
                x.gu.UserId,
                x.u.Username,
                x.u.AvatarUrl,
                x.gu.JoinDate,
                x.gu.IsReady,
                x.gu.HasDrawn,
                x.gu.IsShortStick,
                x.gu.DrawOrder
            ))
            .ToListAsync();

        return new GameDetailDto(
            game.Id,
            game.CreatorUserId,
            game.PenaltyText,
            game.IsStarted,
            game.IsGlobal,
            game.CreatedDate,
            participants
        );
    }

    // POST: /api/games/{id}/ready
    // Body: { UserId: guid, IsReady: bool }
    [HttpPost("{id:guid}/ready")]
    [Authorize]
    public async Task<ActionResult<GameDetailDto>> SetReady([FromRoute] Guid id, [FromBody] SetReadyDto dto)
    {
        if (dto.GameId != id) return BadRequest(new { message = "Oyun kimliği eşleşmiyor" });
        var game = await _db.Games.FirstOrDefaultAsync(g => g.Id == id);
        if (game is null) return NotFound(new { message = "Oyun bulunamadı" });
        if (game.IsStarted) return BadRequest(new { message = "Oyun zaten başlatıldı" });

        var gu = await _db.GameUsers.FirstOrDefaultAsync(x => x.GameId == id && x.UserId == dto.UserId);
        if (gu is null) return NotFound(new { message = "Kullanıcı bu oyunun bir parçası değil" });

        gu.IsReady = dto.IsReady;
        await _db.SaveChangesAsync();

        var detailAfterReady = await BuildDetailDto(id);
        await _ws.BroadcastAsync(id, "game-updated", detailAfterReady);
        return Ok(detailAfterReady);
    }

    // Oyun sahibinin oyunu başlatmasını sağlar
    // GameService.StartGameAsync metodu ile oyunu başlatır
    // POST: /api/games/{id}/start
    [HttpPost("{id:guid}/start")]
    [Authorize]
    public async Task<ActionResult<GameDetailDto>> Start([FromRoute] Guid id)
    {
        try
        {
            // Sadece oyun sahibi başlatabilir
            var userIdClaim = User.FindFirst(JwtRegisteredClaimNames.Sub) ?? User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim is null || !Guid.TryParse(userIdClaim.Value, out var userId))
                return Unauthorized(new { message = "Invalid token" });
            var game = await _db.Games.AsNoTracking().FirstOrDefaultAsync(g => g.Id == id);
            if (game is null) return NotFound(new { message = "Game not found" });
            if (game.CreatorUserId != userId) return Forbid();

            var dto = await _gameService.StartGameAsync(id);
            await _ws.BroadcastAsync(id, "game-started", dto);
            // Tüm istemciler kişisel modalları tutarlı şekilde gösterebilsin diye sonuç özetini hemen yayınla
            try
            {
                var summary = await _gameService.GetResultAsync(id);
                if (summary is not null)
                {
                    await _ws.BroadcastAsync(id, "game-completed", summary);
                }
            }
            catch { }
            return Ok(dto);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // Kullanıcı çubuk çeker
    // DTO ile GameId ve UserId gönderilir
    // GameService.DrawAsync(dto) ile çubuk çekme yapılır ve sonuç döner
    // POST: /api/games/{id}/draw
    [HttpPost("{id:guid}/draw")]
    [Authorize]
    public async Task<ActionResult<DrawResultDto>> Draw([FromRoute] Guid id, [FromBody] DrawDto dto)
    {
        if (dto.GameId != id) return BadRequest(new { message = "Mismatched game id" });
        // Sadece kimliği doğrulanmış kullanıcı kendisi için çekim yapabilir
        var userIdClaim = User.FindFirst(JwtRegisteredClaimNames.Sub) ?? User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim is null || !Guid.TryParse(userIdClaim.Value, out var authUserId))
            return Unauthorized(new { message = "Invalid token" });
        if (authUserId != dto.UserId) return Forbid();
        try
        {
            var result = await _gameService.DrawAsync(dto);
            await _ws.BroadcastAsync(id, "drawn", result);
            try
            {
                var summary = await _gameService.GetResultAsync(id);
                if (summary.IsCompleted)
                {
                    await _ws.BroadcastAsync(id, "game-completed", summary);
                }
            }
            catch { }
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // Oyun sonucunu döner
    // GET: /api/games/{id}/result
    [HttpGet("{id:guid}/result")]
    [AllowAnonymous]
    public async Task<ActionResult<GameResultDto>> Result([FromRoute] Guid id)
    {
        try
        {
            var result = await _gameService.GetResultAsync(id);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    // Oyun durumu (ilerleme + kimin sırası)
    // GET: /api/games/{id}/state
    [HttpGet("{id:guid}/state")]
    [AllowAnonymous]
    public async Task<ActionResult<GameStateDto>> State([FromRoute] Guid id)
    {
        var game = await _db.Games.AsNoTracking().FirstOrDefaultAsync(g => g.Id == id);
        if (game is null) return NotFound(new { message = "Game not found" });

        // sonraki sıra = henüz çekilmemiş en küçük DrawOrder
        var next = await _db.GameUsers
            .AsNoTracking()
            .Where(x => x.GameId == id && !x.HasDrawn)
            .OrderBy(x => x.DrawOrder)
            .Select(x => new { x.DrawOrder, x.UserId })
            .FirstOrDefaultAsync();

        var dto = new GameStateDto(
            game.Id,
            game.IsStarted,
            game.IsCompleted,
            next?.DrawOrder,
            next?.UserId
        );
        return Ok(dto);
    }
}
