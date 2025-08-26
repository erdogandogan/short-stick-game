using System.ComponentModel.DataAnnotations;

namespace ShortStickGame.Api.DTOs;

public class SetReadyDto
{
    [Required]
    public Guid GameId { get; set; }

    [Required]
    public Guid UserId { get; set; }

    public bool IsReady { get; set; }
}
