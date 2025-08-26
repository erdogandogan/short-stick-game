using System.ComponentModel.DataAnnotations;

namespace ShortStickGame.Api.DTOs;

public class GameJoinDto
{
    [Required]
    public Guid UserId { get; set; }
}
