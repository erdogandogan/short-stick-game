namespace ShortStickGame.Api.Entities;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;

    // Profil resmi için isteğe bağlı avatar URL'si
    public string? AvatarUrl { get; set; }

    // Yenileme (refresh) token yönetimi
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiresAt { get; set; }
}
