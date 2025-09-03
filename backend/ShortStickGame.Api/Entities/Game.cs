using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ShortStickGame.Api.Entities;

public class Game
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid CreatorUserId { get; set; }

    [ForeignKey(nameof(CreatorUserId))]
    public User? CreatorUser { get; set; }

    [Required]
    [MaxLength(1024)]
    public string PenaltyText { get; set; } = string.Empty;

    public bool IsStarted { get; set; } = false;

    public bool IsCompleted { get; set; } = false;

    public DateTime? StartedDate { get; set; }

    public DateTime? CompletedDate { get; set; }

    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

    // True ise, oyun tüm kimliği doğrulanmış kullanıcılara görünür (katılmadan keşfedilebilir)
    public bool IsGlobal { get; set; } = false;

    // Gezinme (ilişkili varlıklar)
    public ICollection<GameUser> Participants { get; set; } = new List<GameUser>();
}
