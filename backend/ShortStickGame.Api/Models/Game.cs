namespace ShortStickGame.Api.Models;

// Deprecated legacy placeholder. Do not use in new code.
// Keeping for historical reference; use ShortStickGame.Api.Entities.Game instead.
internal class LegacyGame
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty; // Lobby / match code
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
