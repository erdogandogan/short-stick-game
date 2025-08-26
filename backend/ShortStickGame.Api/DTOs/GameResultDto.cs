namespace ShortStickGame.Api.DTOs;

public record DrawResultDto(
    Guid UserId,
    string Username,
    bool IsShortStick,
    int DrawOrder
);

public record GameResultDto(
    Guid GameId,
    string PenaltyText,
    bool IsStarted,
    bool IsCompleted,
    Guid? ShortStickUserId,
    string? ShortStickUsername,
    DateTime? StartedAt,
    DateTime? CompletedAt,
    IReadOnlyList<DrawResultDto> Results
);
