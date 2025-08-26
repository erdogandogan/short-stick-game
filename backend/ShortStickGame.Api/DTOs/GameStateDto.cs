namespace ShortStickGame.Api.DTOs;

public record GameStateDto(
    Guid GameId,
    bool IsStarted,
    bool IsCompleted,
    int? NextOrder,
    Guid? NextUserId
);
