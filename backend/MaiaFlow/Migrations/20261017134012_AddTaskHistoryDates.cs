using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MaiaFlow.Migrations
{
    /// <inheritdoc />
    public partial class AddTaskHistoryDates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "CompletedOn",
                table: "tasks",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "CreatedOn",
                table: "tasks",
                type: "date",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CompletedOn",
                table: "tasks");

            migrationBuilder.DropColumn(
                name: "CreatedOn",
                table: "tasks");
        }
    }
}
