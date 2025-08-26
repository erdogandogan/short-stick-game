using System.ComponentModel.DataAnnotations;

namespace ShortStickGame.Api.DTOs;

public class DrawDto
{
    [Required]
    public Guid GameId { get; set; }

    [Required]
    public Guid UserId { get; set; }
}
