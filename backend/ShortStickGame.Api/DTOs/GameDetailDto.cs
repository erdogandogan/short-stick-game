namespace ShortStickGame.Api.DTOs;

public record GameParticipantDto(
    Guid UserId,
    string Username,
    string? AvatarUrl,
    DateTime JoinDate,
    bool IsReady,
    bool HasDrawn,
    bool IsShortStick,
    int? DrawOrder
);

public record GameDetailDto(
    Guid Id,
    Guid CreatorUserId,
    string PenaltyText,
    bool IsStarted,
    bool IsGlobal,
    DateTime CreatedDate,
    IReadOnlyList<GameParticipantDto> Participants
);
