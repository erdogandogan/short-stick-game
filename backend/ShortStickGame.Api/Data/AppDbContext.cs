using Microsoft.EntityFrameworkCore;
using ShortStickGame.Api.Entities;
using UserEntity = ShortStickGame.Api.Entities.User;

namespace ShortStickGame.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<UserEntity> Users => Set<UserEntity>();
    public DbSet<Game> Games => Set<Game>();
    public DbSet<GameUser> GameUsers => Set<GameUser>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<UserEntity>(e =>
            {
                e.HasKey(p => p.Id);
                e.Property(p => p.Id).ValueGeneratedNever();
                e.Property(p => p.Username).IsRequired().HasMaxLength(64);
                e.Property(p => p.Email).IsRequired().HasMaxLength(256);
                e.Property(p => p.PasswordHash).IsRequired();
                e.Property(p => p.AvatarUrl).HasMaxLength(1024);
                e.HasIndex(p => p.Username).IsUnique();
                e.HasIndex(p => p.Email).IsUnique();
            });
        modelBuilder.Entity<Game>(e =>
        {
            e.HasKey(p => p.Id);
            e.Property(p => p.Id).ValueGeneratedNever();
            e.Property(p => p.PenaltyText).IsRequired().HasMaxLength(1024);
            e.Property(p => p.IsStarted).HasDefaultValue(false);
            e.Property(p => p.IsCompleted).HasDefaultValue(false);
            e.Property(p => p.CreatedDate).HasDefaultValueSql("GETUTCDATE()");
            e.Property(p => p.StartedDate).HasColumnType("datetime2");
            e.Property(p => p.CompletedDate).HasColumnType("datetime2");

            e.HasOne(p => p.CreatorUser)
                .WithMany()
                .HasForeignKey(p => p.CreatorUserId)
                .OnDelete(DeleteBehavior.Restrict); // silinirse oyun silinmez

            e.HasMany(p => p.Participants)
                .WithOne(pu => pu.Game!)
                .HasForeignKey(pu => pu.GameId)
                .OnDelete(DeleteBehavior.Cascade); // oyun silinirse katılımcılar da silinir
        });

        modelBuilder.Entity<GameUser>(e =>
        {
            e.HasKey(p => p.Id);
            e.Property(p => p.Id).ValueGeneratedNever();
            e.Property(p => p.JoinDate).HasDefaultValueSql("GETUTCDATE()");
            e.Property(p => p.IsReady).HasDefaultValue(false);
            e.HasOne(p => p.User)
                .WithMany()
                .HasForeignKey(p => p.UserId)
                .OnDelete(DeleteBehavior.Cascade); // kullanıcı silinirse katılım da silinir
            e.HasIndex(p => new { p.GameId, p.UserId }).IsUnique(); // her oyun için kullanıcı katılımı benzersiz olmalı
            e.Property(p => p.HasDrawn).HasDefaultValue(false);
            e.Property(p => p.IsShortStick).HasDefaultValue(false);
        });
    }
}
