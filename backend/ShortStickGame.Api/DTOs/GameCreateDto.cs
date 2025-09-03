using System.ComponentModel.DataAnnotations;

namespace ShortStickGame.Api.DTOs;

public class GameCreateDto
{
    [Required]
    [MaxLength(1024)]
    public string PenaltyText { get; set; } = string.Empty;

    // Opsiyonel: true ise oyun tüm kullanıcılar tarafından keşfedilebilir (global).
    public bool? IsGlobal { get; set; }

    // Opsiyonel: string türü gönderen istemciler için. "friends" veya "global" gibi değerler.
    public string? GameType { get; set; }
}
