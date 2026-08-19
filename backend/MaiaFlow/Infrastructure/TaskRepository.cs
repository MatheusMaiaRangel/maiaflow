using MaiaFlow.Domain.TaskItem;
using Microsoft.EntityFrameworkCore;

namespace MaiaFlow.Infrastructure
{
    public class TaskRepository : ITaskRepository
    {
        private readonly AppDbContext _context;
        private readonly DbSet<TaskItem> _dbSet;

        public TaskRepository(AppDbContext context)
        {
            _context = context;
            _dbSet = _context.Set<TaskItem>();
        }

        public async Task AddAsync(TaskItem task)
        {
            await _dbSet.AddAsync(task);
            await _context.SaveChangesAsync();
        }

        public async Task<TaskItem?> GetByIdAsync(int id)
        {
            return await _dbSet.FindAsync(id);
        }

        public async Task<List<TaskItem>> GetByUserIdAsync(int userId)
        {
            return await _dbSet.Where(t => t.UserId == userId).ToListAsync();
        }

        public async Task UpdateAsync(TaskItem task)
        {
            _dbSet.Update(task);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteAsync(TaskItem task)
        {
            _dbSet.Remove(task);
            await _context.SaveChangesAsync();
        }
    }
}