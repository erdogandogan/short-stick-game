namespace ShortStickGame.Api.DTOs;

public record AuthResponseDto(string AccessToken, string RefreshToken, DateTime ExpiresAtUtc);
