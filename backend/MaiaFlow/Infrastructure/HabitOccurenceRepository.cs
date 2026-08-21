using MaiaFlow.Domain.Habit;
using Microsoft.EntityFrameworkCore;

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

        public async Task<HabitOccurrence?> GetByHabitIdAndDateAsync(int habitId, DateTime date)
        {
            return await _dbSet.FirstOrDefaultAsync(o => o.HabitId == habitId && o.Date == date.Date);
        }

        public async Task<List<HabitOccurrence>> GetByUserIdAndDateRangeAsync(int userId, DateTime start, DateTime end)
        {
            return await _dbSet
                .Join(_context.Set<Habit>(), o => o.HabitId, h => h.Id, (o, h) => new { Occurrence = o, h.UserId })
                .Where(x => x.UserId == userId && x.Occurrence.Date >= start.Date && x.Occurrence.Date <= end.Date)
                .Select(x => x.Occurrence)
                .ToListAsync();
        }

        public async Task AddAsync(HabitOccurrence occurrence)
        {
            await _dbSet.AddAsync(occurrence);
            await _context.SaveChangesAsync();
        }

        public async Task AddRangeAsync(List<HabitOccurrence> occurrences)
        {
            if (occurrences.Count == 0) return;
            await _dbSet.AddRangeAsync(occurrences);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateAsync(HabitOccurrence occurrence)
        {
            _dbSet.Update(occurrence);
            await _context.SaveChangesAsync();
        }
    }
}