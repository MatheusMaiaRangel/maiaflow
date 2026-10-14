using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MaiaFlow.Migrations
{
    /// <inheritdoc />
    public partial class AddUserEmailUniqueIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // E-mails are now stored trimmed and lower-case; fails below if that makes two users collide.
            migrationBuilder.Sql("UPDATE users SET \"Email\" = lower(btrim(\"Email\"))");

            migrationBuilder.CreateIndex(
                name: "IX_users_Email",
                table: "users",
                column: "Email",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_users_Email",
                table: "users");
        }
    }
}
