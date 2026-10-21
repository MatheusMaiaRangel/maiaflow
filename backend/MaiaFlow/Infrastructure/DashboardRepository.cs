using MaiaFlow.Domain.Dashboard;
using Microsoft.EntityFrameworkCore;

namespace MaiaFlow.Infrastructure
{
    public class DashboardRepository(AppDbContext context) : IDashboardRepository
    {
        public async Task<Dashboard?> GetByUserIdAsync(int userId)
        {
            return await context.dashboards.AsNoTracking().FirstOrDefaultAsync(d => d.UserId == userId);
        }

        public async Task<bool> TryCreateAsync(int userId, string config, DateTimeOffset now)
        {
            // ON CONFLICT DO NOTHING: of two devices creating the row at once, the second simply gets 0 rows.
            var created = await context.Database.ExecuteSqlAsync($"""
                INSERT INTO dashboards (user_id, config, revision, updated_at)
                VALUES ({userId}, {config}::jsonb, 1, {now})
                ON CONFLICT (user_id) DO NOTHING
                """);
            return created == 1;
        }

        public async Task<bool> TryReplaceAsync(int userId, int expectedRevision, string? config, DateTimeOffset now)
        {
            // A concurrent UPDATE waits for the row lock and then re-checks the WHERE, so only one of them matches.
            var updated = await context.dashboards
                .Where(d => d.UserId == userId && d.Revision == expectedRevision)
                .ExecuteUpdateAsync(set => set
                    .SetProperty(d => d.Config, config)
                    .SetProperty(d => d.Revision, d => d.Revision + 1)
                    .SetProperty(d => d.UpdatedAt, now));
            return updated == 1;
        }

        public async Task ResetAsync(int userId, DateTimeOffset now)
        {
            await context.dashboards
                .Where(d => d.UserId == userId)
                .ExecuteUpdateAsync(set => set
                    .SetProperty(d => d.Config, (string?)null)
                    .SetProperty(d => d.Revision, d => d.Revision + 1)
                    .SetProperty(d => d.UpdatedAt, now));
        }
    }
}
