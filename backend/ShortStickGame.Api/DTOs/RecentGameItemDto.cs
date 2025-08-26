namespace ShortStickGame.Api.DTOs;

public record RecentGameItemDto(
    Guid GameId,
    DateTime? StartedAt,
    DateTime? CompletedAt,
    bool IsShortStick,
    string? PenaltyText
);
