using MaiaFlow.Domain.Habit;
using Microsoft.EntityFrameworkCore;

namespace MaiaFlow.Infrastructure
{
    public class HabitRepository : IHabitRepository
    {
        private readonly AppDbContext _context;
        private readonly DbSet<Habit> _dbSet;

        public HabitRepository(AppDbContext context)
        {
            _context = context;
            _dbSet = _context.Set<Habit>();
        }

        public async Task AddAsync(Habit habit)
        {
            await _dbSet.AddAsync(habit);
            await _context.SaveChangesAsync();
        }

        public async Task<Habit?> GetByIdAsync(int id)
        {
            return await _dbSet.Include(h => h.Rules).FirstOrDefaultAsync(h => h.Id == id);
        }

        // Touches only the cursor, never the rules, so a concurrent recurrence change is not overwritten,
        // and the cursor can only move forward.
        public async Task AdvanceOccurrencesGeneratedUntilAsync(int habitId, DateTime date)
        {
            var day = date.Date;
            await _dbSet
                .Where(h => h.Id == habitId && (h.OccurrencesGeneratedUntil == null || h.OccurrencesGeneratedUntil < day))
                .ExecuteUpdateAsync(s => s.SetProperty(h => h.OccurrencesGeneratedUntil, day));
        }

        public async Task<int> CountByUserIdAsync(int userId)
        {
            return await _dbSet.CountAsync(h => h.UserId == userId);
        }

        public async Task<List<Habit>> GetByUserIdAsync(int userId)
        {
            return await _dbSet.Include(h => h.Rules).Where(h => h.UserId == userId).ToListAsync();
        }

        public async Task UpdateAsync(Habit habit)
        {
            _dbSet.Update(habit);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteAsync(Habit habit)
        {
            _dbSet.Remove(habit);
            await _context.SaveChangesAsync();
        }
    }
}