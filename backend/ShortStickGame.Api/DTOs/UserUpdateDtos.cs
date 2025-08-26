namespace ShortStickGame.Api.DTOs;

public record UpdateUsernameDto(string Username);
public record UpdateEmailDto(string Email);
public record UpdatePasswordDto(string CurrentPassword, string NewPassword);
