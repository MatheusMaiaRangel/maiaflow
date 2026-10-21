using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MaiaFlow.Migrations
{
    /// <inheritdoc />
    public partial class AddDashboards : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "dashboards",
                columns: table => new
                {
                    user_id = table.Column<int>(type: "integer", nullable: false),
                    config = table.Column<string>(type: "jsonb", nullable: true),
                    revision = table.Column<int>(type: "integer", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_dashboards", x => x.user_id);
                    table.ForeignKey(
                        name: "FK_dashboards_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "dashboards");
        }
    }
}
