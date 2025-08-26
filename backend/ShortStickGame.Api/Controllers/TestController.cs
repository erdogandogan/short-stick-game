using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShortStickGame.Api.Data;

namespace ShortStickGame.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TestController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _env;

    public TestController(AppDbContext db, IWebHostEnvironment env)
    {
        _db = db;
        _env = env;
    }

    [HttpGet]
    [Authorize]
    public IActionResult Get()
    {
        return Ok(new { message = "You are authorized!", time = DateTime.UtcNow });
    }

    // Dev helper: shows which DB is in use and a few users. Keep anonymous for quick checks only in Development.
    [HttpGet("db-info")]
    [AllowAnonymous]
    public async Task<IActionResult> DbInfo()
    {
        if (!_env.IsDevelopment())
            return NotFound();

        var conn = _db.Database.GetDbConnection();
        var applied = await _db.Database.GetAppliedMigrationsAsync();
        var pending = await _db.Database.GetPendingMigrationsAsync();
        var users = await _db.Users
            .AsNoTracking()
            .Select(u => new { u.Id, u.Username, u.Email })
            .OrderBy(u => u.Username)
            .Take(10)
            .ToListAsync();

        return Ok(new
        {
            environment = _env.EnvironmentName,
            dataSource = conn.DataSource,
            database = conn.Database,
            userCount = await _db.Users.CountAsync(),
            users,
            appliedMigrations = applied,
            pendingMigrations = pending
        });
    }
}
