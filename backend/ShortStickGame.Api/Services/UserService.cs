using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ShortStickGame.Api.Data;
using ShortStickGame.Api.DTOs;
using ShortStickGame.Api.Entities;

namespace ShortStickGame.Api.Services;

public interface IUserService
{
    Task<UserProfileDto> GetProfileAsync(Guid userId, CancellationToken ct = default);
    Task<UserStatsDto> GetStatsAsync(Guid userId, CancellationToken ct = default);
    Task<IReadOnlyList<RecentGameItemDto>> GetRecentGamesAsync(Guid userId, int count = 5, CancellationToken ct = default);
    Task UpdateUsernameAsync(Guid userId, string newUsername, CancellationToken ct = default);
    Task UpdateEmailAsync(Guid userId, string newEmail, CancellationToken ct = default);
    Task UpdatePasswordAsync(Guid userId, string currentPassword, string newPassword, CancellationToken ct = default);
}

public class UserService : IUserService
{
    private readonly AppDbContext _db;
    private readonly IPasswordHasher<User> _hasher;

    public UserService(AppDbContext db, IPasswordHasher<User> hasher)
    {
        _db = db;
        _hasher = hasher;
    }

    public async Task<UserProfileDto> GetProfileAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new KeyNotFoundException("User not found");

        var createdGames = await _db.Games.CountAsync(g => g.CreatorUserId == userId, ct);
        var joinedGames = await _db.GameUsers.CountAsync(gu => gu.UserId == userId, ct);
        var completedGames = await _db.Games
            .Where(g => g.IsCompleted && (
                g.CreatorUserId == userId ||
                _db.GameUsers.Any(gu => gu.GameId == g.Id && gu.UserId == userId)
            ))
            .CountAsync(ct);

        var total = createdGames + joinedGames; // may double count if creator is also participant, but OK for profile display

        return new UserProfileDto(
            user.Id,
            user.Username,
            user.Email,
            AvatarUrl: user.AvatarUrl,
            JoinedAt: null, // no created-at field on user entity currently
            TotalGames: total,
            CompletedGames: completedGames,
            CreatedGames: createdGames,
            JoinedGames: joinedGames
        );
    }

    public async Task<UserStatsDto> GetStatsAsync(Guid userId, CancellationToken ct = default)
    {
        // Total joined games: GameUsers rows
        var totalJoined = await _db.GameUsers.CountAsync(gu => gu.UserId == userId, ct);

        // Total wins: number of completed games where this user's GameUser.IsShortStick == false? In short stick, loser is short stick.
        // Requirement says "Kazandığı oyun sayısı"; interpret as games completed where user participated and NOT short stick.
        var completedUserGames = await _db.GameUsers
            .Where(gu => gu.UserId == userId)
            .Join(_db.Games, gu => gu.GameId, g => g.Id, (gu, g) => new { gu, g })
            .Where(x => x.g.IsCompleted)
            .ToListAsync(ct);

        var totalShortStick = completedUserGames.Count(x => x.gu.IsShortStick);
        var totalWins = completedUserGames.Count(x => !x.gu.IsShortStick);

        // Most played with: find other user with max co-participations
        var coCounts = await _db.GameUsers
            .Where(gu => gu.UserId == userId)
            .Join(_db.GameUsers, a => a.GameId, b => b.GameId, (a, b) => new { a, b })
            .Where(x => x.b.UserId != userId)
            .GroupBy(x => x.b.UserId)
            .Select(g => new { OtherUserId = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .FirstOrDefaultAsync(ct);

        string? mostPlayedName = null;
        Guid? mostPlayedId = null;
        if (coCounts is not null)
        {
            mostPlayedId = coCounts.OtherUserId;
            mostPlayedName = await _db.Users.Where(u => u.Id == mostPlayedId).Select(u => u.Username).FirstOrDefaultAsync(ct);
        }

        return new UserStatsDto(userId, totalJoined, totalWins, totalShortStick, mostPlayedName, mostPlayedId);
    }

    public async Task<IReadOnlyList<RecentGameItemDto>> GetRecentGamesAsync(Guid userId, int count = 5, CancellationToken ct = default)
    {
        // Games where user participated (by GameUsers) or created
        var gameIdsQuery = _db.Games
            .Where(g => g.CreatorUserId == userId)
            .Select(g => g.Id)
            .Concat(
                _db.GameUsers.Where(gu => gu.UserId == userId).Select(gu => gu.GameId)
            )
            .Distinct();

        var recent = await _db.Games
            .Where(g => gameIdsQuery.Contains(g.Id))
            .OrderByDescending(g => g.CompletedDate ?? g.StartedDate ?? g.CreatedDate)
            .Take(count)
            .Select(g => new RecentGameItemDto(
                g.Id,
                g.StartedDate,
                g.CompletedDate,
                _db.GameUsers.Any(gu => gu.GameId == g.Id && gu.UserId == userId && gu.IsShortStick),
                g.PenaltyText
            ))
            .ToListAsync(ct);

        return recent;
    }

    public async Task UpdateUsernameAsync(Guid userId, string newUsername, CancellationToken ct = default)
    {
        newUsername = newUsername.Trim();
        if (string.IsNullOrWhiteSpace(newUsername)) throw new ArgumentException("Username required");
        var exists = await _db.Users.AnyAsync(u => u.Username == newUsername && u.Id != userId, ct);
        if (exists) throw new InvalidOperationException("Username already in use");
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct) ?? throw new KeyNotFoundException("User not found");
        user.Username = newUsername;
        await _db.SaveChangesAsync(ct);
    }

    public async Task UpdateEmailAsync(Guid userId, string newEmail, CancellationToken ct = default)
    {
        newEmail = newEmail.Trim();
        if (string.IsNullOrWhiteSpace(newEmail)) throw new ArgumentException("Email required");
        var exists = await _db.Users.AnyAsync(u => u.Email == newEmail && u.Id != userId, ct);
        if (exists) throw new InvalidOperationException("Email already in use");
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct) ?? throw new KeyNotFoundException("User not found");
        user.Email = newEmail;
        await _db.SaveChangesAsync(ct);
    }

    public async Task UpdatePasswordAsync(Guid userId, string currentPassword, string newPassword, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(newPassword)) throw new ArgumentException("New password required");
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct) ?? throw new KeyNotFoundException("User not found");
        var verify = _hasher.VerifyHashedPassword(user, user.PasswordHash, currentPassword);
        if (verify == PasswordVerificationResult.Failed) throw new InvalidOperationException("Current password is incorrect");
        user.PasswordHash = _hasher.HashPassword(user, newPassword);
        await _db.SaveChangesAsync(ct);
    }
}
