namespace ShortStickGame.Api.DTOs;

public record GameListItemDto(
    Guid Id,
    string PenaltyText,
    bool IsStarted,
    bool IsCompleted,
    bool IsGlobal,
    DateTime CreatedDate,
    DateTime? StartedDate,
    DateTime? CompletedDate,
    Guid CreatorUserId,
    int ParticipantCount,
    bool IsOwner
);
