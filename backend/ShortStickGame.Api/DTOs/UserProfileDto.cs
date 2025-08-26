namespace ShortStickGame.Api.DTOs;

public record UserProfileDto(
    Guid UserId,
    string Username,
    string Email,
    string? AvatarUrl,
    DateTime? JoinedAt,
    int TotalGames,
    int CompletedGames,
    int CreatedGames,
    int JoinedGames
);
