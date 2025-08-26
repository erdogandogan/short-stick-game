using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ShortStickGame.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddGameLifecycleFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<bool>(
                name: "IsShortStick",
                table: "GameUsers",
                type: "bit",
                nullable: false,
                defaultValue: false,
                oldClrType: typeof(bool),
                oldType: "bit");

            migrationBuilder.AlterColumn<bool>(
                name: "HasDrawn",
                table: "GameUsers",
                type: "bit",
                nullable: false,
                defaultValue: false,
                oldClrType: typeof(bool),
                oldType: "bit");

            migrationBuilder.AddColumn<DateTime>(
                name: "CompletedDate",
                table: "Games",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsCompleted",
                table: "Games",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "StartedDate",
                table: "Games",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CompletedDate",
                table: "Games");

            migrationBuilder.DropColumn(
                name: "IsCompleted",
                table: "Games");

            migrationBuilder.DropColumn(
                name: "StartedDate",
                table: "Games");

            migrationBuilder.AlterColumn<bool>(
                name: "IsShortStick",
                table: "GameUsers",
                type: "bit",
                nullable: false,
                oldClrType: typeof(bool),
                oldType: "bit",
                oldDefaultValue: false);

            migrationBuilder.AlterColumn<bool>(
                name: "HasDrawn",
                table: "GameUsers",
                type: "bit",
                nullable: false,
                oldClrType: typeof(bool),
                oldType: "bit",
                oldDefaultValue: false);
        }
    }
}
