namespace ShortStickGame.Api.DTOs;

public record HistoryParticipantDto(
    Guid UserId,
    string Username
);

public record GameHistoryItemDto(
    Guid GameId,
    bool IsGlobal,
    string PenaltyText,
    DateTime? StartedAt,
    DateTime? CompletedAt,
    Guid? ShortStickUserId,
    string? ShortStickUsername,
    IReadOnlyList<HistoryParticipantDto> Participants
);
