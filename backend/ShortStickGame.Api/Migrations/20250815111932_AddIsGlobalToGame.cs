using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShortStickGame.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddIsGlobalToGame : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsGlobal",
                table: "Games",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsGlobal",
                table: "Games");
        }
    }
}
