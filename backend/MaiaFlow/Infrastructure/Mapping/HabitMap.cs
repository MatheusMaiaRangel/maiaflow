using MaiaFlow.Domain.Habit;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MaiaFlow.Infrastructure.Mapping
{
    public class HabitMap : IEntityTypeConfiguration<Habit>
    {
        public void Configure(EntityTypeBuilder<Habit> builder)
        {
            builder.ToTable("habits");

            builder.HasKey(h => h.Id);
            builder.Property(h => h.Title).IsRequired().HasMaxLength(150);
            builder.Property(h => h.Description).HasMaxLength(500);
            builder.Property(h => h.StartDate).IsRequired();
            builder.Property(h => h.UserId).IsRequired();
            builder.Property(h => h.OccurrencesGeneratedUntil);

            builder.HasOne<Domain.User.User>()
                .WithMany()
                .HasForeignKey(h => h.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasMany(h => h.Rules)
                .WithOne()
                .HasForeignKey(r => r.HabitId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Navigation(h => h.Rules).UsePropertyAccessMode(PropertyAccessMode.Field);
        }
    }
}