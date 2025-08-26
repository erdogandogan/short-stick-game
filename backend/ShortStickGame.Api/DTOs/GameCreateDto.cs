using System.ComponentModel.DataAnnotations;

namespace ShortStickGame.Api.DTOs;

public class GameCreateDto
{
    [Required]
    [MaxLength(1024)]
    public string PenaltyText { get; set; } = string.Empty;

    // Optional: if true, game is globally discoverable.
    public bool? IsGlobal { get; set; }

    // Optional: for clients sending a string type. Values like "friends" or "global".
    public string? GameType { get; set; }
}
