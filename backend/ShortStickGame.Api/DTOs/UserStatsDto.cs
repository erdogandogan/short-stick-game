namespace ShortStickGame.Api.DTOs;

public record UserStatsDto(
    Guid UserId,
    int TotalJoinedGames,
    int TotalWins,
    int TotalShortStick,
    string? MostPlayedWithUsername,
    Guid? MostPlayedWithUserId
);
