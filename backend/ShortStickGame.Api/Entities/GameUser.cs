using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ShortStickGame.Api.Entities;

public class GameUser
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid GameId { get; set; }

    [ForeignKey(nameof(GameId))]
    public Game? Game { get; set; }

    [Required]
    public Guid UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public User? User { get; set; }

    public DateTime JoinDate { get; set; } = DateTime.UtcNow;

    // Oyun başlamadan önceki hazır olma durumu
    public bool IsReady { get; set; } = false;

    public bool HasDrawn { get; set; } = false;

    public bool IsShortStick { get; set; } = false;

    public int? DrawOrder { get; set; }
}
