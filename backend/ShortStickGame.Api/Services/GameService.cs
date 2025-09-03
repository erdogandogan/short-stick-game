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

        // Tüm katılımcıların hazır olduğundan emin ol
        var notReady = await _db.GameUsers.CountAsync(x => x.GameId == gameId && !x.IsReady, ct);
        if (notReady > 0)
            throw new InvalidOperationException("Tüm katılımcılar hazır olmalıdır");

        // Tüm katılımcıların geçerli kullanıcı olduğundan emin ol (DB kısıtı zaten bunu garanti eder)
        game.IsStarted = true;
        game.StartedDate = DateTime.UtcNow;

        // Çekme sırasını rastgele belirle ve kısa çubuğu önceden tespit et; böylece tüm istemciler senkronize animasyon gösterebilir.
        // Bu sayede başlangıçtan hemen sonra dağıtım animasyonu eşzamanlı olur ve ardından sonuçlar gösterilir.
        var participants = await _db.GameUsers.Where(gu => gu.GameId == gameId).ToListAsync(ct);
        var rnd = new Random();
        var shuffled = participants.OrderBy(_ => rnd.Next()).ToList();
        for (int i = 0; i < shuffled.Count; i++)
        {
            shuffled[i].DrawOrder = i + 1; // 1-based order
        }

        // Rastgele olarak tam bir kişiye kısa çubuk ataması yap
        if (shuffled.Count > 0)
        {
            var shortIndex = rnd.Next(0, shuffled.Count);
            for (int i = 0; i < shuffled.Count; i++)
            {
                var gu = shuffled[i];
                gu.IsShortStick = (i == shortIndex);
                // Hemen finalize etmek için çekilmiş olarak işaretle (istemciler yine de animasyon arayüzünü gösterecek)
                gu.HasDrawn = true;
            }

            // Tüm oyuncular için tutarlı olması adına oyunu hemen tamamla
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

        // Çekme sırasını DrawOrder ile uygula (henüz çekmemiş en küçük DrawOrder'ı bul)
        var next = await _db.GameUsers
            .Where(x => x.GameId == dto.GameId && !x.HasDrawn)
            .OrderBy(x => x.DrawOrder)
            .FirstOrDefaultAsync(ct);
        if (next is not null && next.UserId != dto.UserId)
            throw new InvalidOperationException("Çekme sırası sizde değil");

        // Kısa çubuğun daha önce atanıp atanmadığını belirle
        var alreadyShort = await _db.GameUsers.AnyAsync(x => x.GameId == dto.GameId && x.IsShortStick, ct);

        // Çekme mantığı: oyun genelinde rastgele olarak tam bir kullanıcıya kısa çubuk ata.
        // Henüz atanmadıysa ve bu son çekimse, bu kullanıcıya zorunlu olarak ata.
        var total = await _db.GameUsers.CountAsync(x => x.GameId == dto.GameId, ct);
        var drawnCount = await _db.GameUsers.CountAsync(x => x.GameId == dto.GameId && x.HasDrawn, ct);
        bool isLastDraw = drawnCount == total - 1;

        bool assignShort = false;
        if (!alreadyShort)
        {
            if (isLastDraw)
                assignShort = true;
            else
                assignShort = Random.Shared.Next(0, total - drawnCount) == 0; // her çekimde küçük bir olasılık
        }

        gu.HasDrawn = true;
        if (assignShort)
            gu.IsShortStick = true;

        // Herkes çektiyse oyunu tamamlandı olarak işaretle
        if (drawnCount + 1 == total)
        {
            game.IsCompleted = true;
            game.CompletedDate = DateTime.UtcNow;
            // Tam olarak bir kısa çubuk olduğundan emin ol: rastgelelik nedeniyle hiç ayarlanmamışsa, son çeken kişiye ayarla
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
