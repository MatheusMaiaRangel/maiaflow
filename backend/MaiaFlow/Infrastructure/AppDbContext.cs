using MaiaFlow.Domain.User;
using MaiaFlow.Domain.TaskItem;
using Microsoft.EntityFrameworkCore;

namespace MaiaFlow.Infrastructure
{
    public class AppDbContext : DbContext
    {
        public DbSet<User> users { get; set; }
        public DbSet<TaskItem> tasks { get; set; }

        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.ApplyConfiguration<User>(new Mapping.UserMap());
            modelBuilder.ApplyConfiguration<TaskItem>(new Mapping.TaskMap());
        }
    }
}