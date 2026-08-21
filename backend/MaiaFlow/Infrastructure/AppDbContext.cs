using MaiaFlow.Domain.User;
using MaiaFlow.Domain.TaskItem;
using MaiaFlow.Domain.Habit;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace MaiaFlow.Infrastructure
{
    public class AppDbContext : DbContext
    {
        public DbSet<User> users { get; set; }
        public DbSet<TaskItem> tasks { get; set; }
        public DbSet<Habit> habits { get; set; }
        public DbSet<HabitRecurrenceRule> habit_recurrence_rules { get; set; }
        public DbSet<HabitOccurrence> habit_occurrences { get; set; }

        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }


        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.ApplyConfiguration<User>(new Mapping.UserMap());
            modelBuilder.ApplyConfiguration<TaskItem>(new Mapping.TaskMap());
            modelBuilder.ApplyConfiguration<Habit>(new Mapping.HabitMap());
            modelBuilder.ApplyConfiguration<HabitRecurrenceRule>(new Mapping.HabitRecurrenceRuleMap());
            modelBuilder.ApplyConfiguration<HabitOccurrence>(new Mapping.HabitOccurrenceMap());

            // Postgres "timestamp without time zone" não aceita nenhum Kind marcado no DateTime.
            // Esses conversores forçam Kind = Unspecified tanto ao salvar quanto ao ler,
            // independente de a data ter vindo do JSON (Unspecified) ou de DateTime.UtcNow (Utc).
            var dateTimeConverter = new ValueConverter<DateTime, DateTime>(
                v => DateTime.SpecifyKind(v, DateTimeKind.Unspecified),
                v => DateTime.SpecifyKind(v, DateTimeKind.Unspecified));

            var nullableDateTimeConverter = new ValueConverter<DateTime?, DateTime?>(
                v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Unspecified) : v,
                v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Unspecified) : v);

            foreach (var entityType in modelBuilder.Model.GetEntityTypes())
            {
                foreach (var property in entityType.GetProperties())
                {
                    if (property.ClrType == typeof(DateTime))
                    {
                        property.SetColumnType("timestamp without time zone");
                        property.SetValueConverter(dateTimeConverter);
                    }
                    else if (property.ClrType == typeof(DateTime?))
                    {
                        property.SetColumnType("timestamp without time zone");
                        property.SetValueConverter(nullableDateTimeConverter);
                    }
                }
            }
        }
    }
}