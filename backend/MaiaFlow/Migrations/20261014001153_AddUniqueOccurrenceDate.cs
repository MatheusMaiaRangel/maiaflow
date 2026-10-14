using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MaiaFlow.Migrations
{
    /// <inheritdoc />
    public partial class AddUniqueOccurrenceDate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_habit_occurrences_HabitId",
                table: "habit_occurrences");

            migrationBuilder.CreateIndex(
                name: "IX_habit_occurrences_HabitId_Date",
                table: "habit_occurrences",
                columns: new[] { "HabitId", "Date" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_habit_occurrences_HabitId_Date",
                table: "habit_occurrences");

            migrationBuilder.CreateIndex(
                name: "IX_habit_occurrences_HabitId",
                table: "habit_occurrences",
                column: "HabitId");
        }
    }
}
