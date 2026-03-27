using MaiaFlow.Domain.User;
using Microsoft.EntityFrameworkCore;

namespace MaiaFlow.Infrastructure
{
    public class AppDbContext : DbContext
    {
        public DbSet<User> Users { get; set; }

        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.ApplyConfiguration<User>(new Mapping.UserMap());
        }
    }
}