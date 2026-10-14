using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MaiaFlow.Migrations
{
    /// <inheritdoc />
    public partial class AddLastDayOfMonthToRecurrence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "LastDayOfMonth",
                table: "habit_recurrence_rules",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LastDayOfMonth",
                table: "habit_recurrence_rules");
        }
    }
}
