using Microsoft.EntityFrameworkCore.Migrations;

// NOTE: Placeholder migration to align code-first model with new fields IsReady and AvatarUrl.
namespace ShortStickGame.Api.Migrations
{
    public partial class AddReadyAndAvatar : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsReady",
                table: "GameUsers",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "AvatarUrl",
                table: "Users",
                type: "nvarchar(1024)",
                maxLength: 1024,
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsReady",
                table: "GameUsers");

            migrationBuilder.DropColumn(
                name: "AvatarUrl",
                table: "Users");
        }
    }
}
