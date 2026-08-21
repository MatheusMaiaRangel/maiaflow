using MaiaFlow.Domain.Habit;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MaiaFlow.Infrastructure.Mapping
{
    public class HabitOccurrenceMap : IEntityTypeConfiguration<HabitOccurrence>
    {
        public void Configure(EntityTypeBuilder<HabitOccurrence> builder)
        {
            builder.ToTable("habit_occurrences");

            builder.HasKey(o => o.Id);
            builder.Property(o => o.HabitId).IsRequired();
            builder.Property(o => o.Date).IsRequired();

            builder.Property(o => o.Status)
                .HasConversion<string>()
                .IsRequired()
                .HasMaxLength(20);

            builder.HasOne<Habit>()
                .WithMany()
                .HasForeignKey(o => o.HabitId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}