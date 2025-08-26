using Microsoft.EntityFrameworkCore;
using ShortStickGame.Api.Data;
using ShortStickGame.Api.DTOs;
using ShortStickGame.Api.Entities;

namespace ShortStickGame.Api.Services;

public interface IGameService
{
    Task<GameDetailDto> StartGameAsync(Guid gameId, CancellationToken ct = default);
    Task<DrawResultDto> DrawAsync(DrawDto dto, CancellationToken ct = default);
    Task<GameResultDto> GetResultAsync(Guid gameId, CancellationToken ct = default);
}

public class GameService : IGameService
{
    private readonly AppDbContext _db;

    public GameService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<GameDetailDto> StartGameAsync(Guid gameId, CancellationToken ct = default)
    {
        var game = await _db.Games.Include(g => g.Participants).FirstOrDefaultAsync(g => g.Id == gameId, ct);
        if (game is null)
            throw new KeyNotFoundException("Oyun bulunamadı");

        if (game.IsStarted)
            throw new InvalidOperationException("Oyun zaten başlatıldı");

        if (game.Participants.Count < 2)
            throw new InvalidOperationException("Başlatmak için en az 2 katılımcı gerekli");

        // Ensure all participants are ready
        var notReady = await _db.GameUsers.CountAsync(x => x.GameId == gameId && !x.IsReady, ct);
        if (notReady > 0)
            throw new InvalidOperationException("Tüm katılımcılar hazır olmalıdır");

        // Ensure all participants are valid users (DB constraint already ensures this)
        game.IsStarted = true;
        game.StartedDate = DateTime.UtcNow;

        // Initialize draw order random sequence and pre-determine short stick to synchronize all clients.
        // This ensures that right after start, every client can animate distribution in sync and then show results.
        var participants = await _db.GameUsers.Where(gu => gu.GameId == gameId).ToListAsync(ct);
        var rnd = new Random();
        var shuffled = participants.OrderBy(_ => rnd.Next()).ToList();
        for (int i = 0; i < shuffled.Count; i++)
        {
            shuffled[i].DrawOrder = i + 1; // 1-based order
        }

        // Randomly assign exactly one short stick holder
        if (shuffled.Count > 0)
        {
            var shortIndex = rnd.Next(0, shuffled.Count);
            for (int i = 0; i < shuffled.Count; i++)
            {
                var gu = shuffled[i];
                gu.IsShortStick = (i == shortIndex);
                // Mark as drawn to finalize immediately (clients will still show animation UI)
                gu.HasDrawn = true;
            }

            // Complete the game immediately so result is consistent for all players
            game.IsCompleted = true;
            game.CompletedDate = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);

        return await BuildDetailDto(gameId, ct);
    }

    public async Task<DrawResultDto> DrawAsync(DrawDto dto, CancellationToken ct = default)
    {
        var game = await _db.Games.FirstOrDefaultAsync(g => g.Id == dto.GameId, ct);
    if (game is null) throw new KeyNotFoundException("Oyun bulunamadı");
    if (!game.IsStarted) throw new InvalidOperationException("Oyun başlatılmadı");
    if (game.IsCompleted) throw new InvalidOperationException("Oyun zaten tamamlandı");

        var gu = await _db.GameUsers.Include(x => x.User)
            .FirstOrDefaultAsync(x => x.GameId == dto.GameId && x.UserId == dto.UserId, ct);
    if (gu is null) throw new KeyNotFoundException("Kullanıcı bu oyunun bir parçası değil");
    if (gu.HasDrawn) throw new InvalidOperationException("Kullanıcı zaten çekti");

        // Enforce turn by DrawOrder (find smallest DrawOrder not yet drawn)
        var next = await _db.GameUsers
            .Where(x => x.GameId == dto.GameId && !x.HasDrawn)
            .OrderBy(x => x.DrawOrder)
            .FirstOrDefaultAsync(ct);
        if (next is not null && next.UserId != dto.UserId)
            throw new InvalidOperationException("Çekme sırası sizde değil");

        // Determine if short stick already assigned
        var alreadyShort = await _db.GameUsers.AnyAsync(x => x.GameId == dto.GameId && x.IsShortStick, ct);

        // Draw logic: assign short stick randomly to exactly one user across the game.
        // If not yet assigned and this is the last draw remaining, force assign to this user.
        var total = await _db.GameUsers.CountAsync(x => x.GameId == dto.GameId, ct);
        var drawnCount = await _db.GameUsers.CountAsync(x => x.GameId == dto.GameId && x.HasDrawn, ct);
        bool isLastDraw = drawnCount == total - 1;

        bool assignShort = false;
        if (!alreadyShort)
        {
            if (isLastDraw)
                assignShort = true;
            else
                assignShort = Random.Shared.Next(0, total - drawnCount) == 0; // small chance per draw
        }

        gu.HasDrawn = true;
        if (assignShort)
            gu.IsShortStick = true;

        // If all drawn, mark game completed
        if (drawnCount + 1 == total)
        {
            game.IsCompleted = true;
            game.CompletedDate = DateTime.UtcNow;
            // Ensure exactly one short stick: if none set due to randomness, set the last drawer
            if (!await _db.GameUsers.AnyAsync(x => x.GameId == dto.GameId && x.IsShortStick, ct))
            {
                gu.IsShortStick = true;
            }
        }

        await _db.SaveChangesAsync(ct);

        return new DrawResultDto(
            gu.UserId,
            gu.User?.Username ?? string.Empty,
            gu.IsShortStick,
            gu.DrawOrder ?? 0
        );
    }

    public async Task<GameResultDto> GetResultAsync(Guid gameId, CancellationToken ct = default)
    {
        var game = await _db.Games.FirstOrDefaultAsync(g => g.Id == gameId, ct);
    if (game is null) throw new KeyNotFoundException("Oyun bulunamadı");

        var rows = await _db.GameUsers
            .Where(x => x.GameId == gameId)
            .Join(_db.Users, gu => gu.UserId, u => u.Id, (gu, u) => new { gu, u })
            .OrderBy(x => x.gu.DrawOrder)
            .Select(x => new DrawResultDto(x.gu.UserId, x.u.Username, x.gu.IsShortStick, x.gu.DrawOrder ?? 0))
            .ToListAsync(ct);

        var shortRow = rows.FirstOrDefault(r => r.IsShortStick);

        return new GameResultDto(
            game.Id,
            game.PenaltyText,
            game.IsStarted,
            game.IsCompleted,
            shortRow?.UserId,
            shortRow?.Username,
            game.StartedDate,
            game.CompletedDate,
            rows
        );
    }

    private async Task<GameDetailDto> BuildDetailDto(Guid gameId, CancellationToken ct)
    {
        var game = await _db.Games.AsNoTracking().FirstAsync(g => g.Id == gameId, ct);
        var participants = await _db.GameUsers
            .AsNoTracking()
            .Where(gu => gu.GameId == gameId)
            .Join(
                _db.Users.AsNoTracking(),
                gu => gu.UserId,
                u => u.Id,
                (gu, u) => new { gu, u }
            )
            .OrderBy(x => x.gu.DrawOrder == null)
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
            .ToListAsync(ct);

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
}
