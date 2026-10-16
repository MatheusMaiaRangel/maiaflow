using MaiaFlow.Domain.Habit;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using NpgsqlTypes;

namespace MaiaFlow.Infrastructure
{
    public class HabitOccurrenceRepository : IHabitOccurrenceRepository
    {
        private readonly AppDbContext _context;
        private readonly DbSet<HabitOccurrence> _dbSet;

        public HabitOccurrenceRepository(AppDbContext context)
        {
            _context = context;
            _dbSet = _context.Set<HabitOccurrence>();
        }

        public async Task<HabitOccurrence?> GetByIdAsync(int id)
        {
            return await _dbSet.FindAsync(id);
        }

        public async Task<List<HabitOccurrence>> GetByUserIdAndDateRangeAsync(int userId, DateTime start, DateTime end)
        {
            return await _dbSet.AsNoTracking()
                .Join(_context.Set<Habit>(), o => o.HabitId, h => h.Id, (o, h) => new { Occurrence = o, h.UserId })
                .Where(x => x.UserId == userId && x.Occurrence.Date >= start.Date && x.Occurrence.Date <= end.Date)
                .Select(x => x.Occurrence)
                .OrderBy(o => o.Date).ThenBy(o => o.HabitId)
                .ToListAsync();
        }

        // Concurrent calendar requests may generate the same days. ON CONFLICT DO NOTHING (backed by the
        // unique index on HabitId + Date) keeps the first insert and silently skips the duplicates.
        public async Task AddRangeAsync(List<HabitOccurrence> occurrences)
        {
            foreach (var group in occurrences.GroupBy(o => o.HabitId))
            {
                var habitId = group.Key;
                var dates = group.Select(o => o.Date).Distinct().ToArray();
                var pending = nameof(HabitOccurrenceStatus.Pending);
                // timestamp[] must be declared explicitly: Npgsql would infer timestamptz and reject
                // DateTime values with Kind=Unspecified (see AppDbContext).
                await _context.Database.ExecuteSqlRawAsync("""
                    INSERT INTO habit_occurrences ("HabitId", "Date", "Status")
                    SELECT @habitId, d, @status FROM unnest(@dates) AS d
                    ON CONFLICT ("HabitId", "Date") DO NOTHING
                    """,
                    new NpgsqlParameter("habitId", habitId),
                    new NpgsqlParameter("status", pending),
                    new NpgsqlParameter("dates", NpgsqlDbType.Array | NpgsqlDbType.Timestamp) { Value = dates });
            }
        }

        public async Task UpdateAsync(HabitOccurrence occurrence)
        {
            _dbSet.Update(occurrence);
            await _context.SaveChangesAsync();
        }
    }
}