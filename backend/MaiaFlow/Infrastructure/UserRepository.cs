using MaiaFlow.Domain.User;
using Microsoft.EntityFrameworkCore;

namespace MaiaFlow.Infrastructure
{
    public class UserRepository : IUserRepository
    {
        private readonly AppDbContext _context;
        private readonly DbSet<User> _dbSet;

        public UserRepository(AppDbContext context)
        {
            _context = context;
            _dbSet = _context.Set<User>();
        }

        public async Task AddAsync(User user)
        {
            await _dbSet.AddAsync(user);
            await _context.SaveChangesAsync();
        }
    }
}