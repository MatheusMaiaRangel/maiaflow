using MaiaFlow.Domain.Habit;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MaiaFlow.Infrastructure.Mapping
{
    public class HabitRecurrenceRuleMap : IEntityTypeConfiguration<HabitRecurrenceRule>
    {
        public void Configure(EntityTypeBuilder<HabitRecurrenceRule> builder)
        {
            builder.ToTable("habit_recurrence_rules");

            builder.HasKey(r => r.Id);
            builder.Property(r => r.HabitId).IsRequired();

            builder.Property(r => r.FrequencyType)
                .HasConversion<string>()
                .IsRequired()
                .HasMaxLength(30);

            builder.Property(r => r.IntervalDays);

            builder.Property(r => r.DaysOfWeek)
                .HasConversion<int>()
                .IsRequired();

            var daysOfMonthComparer = new ValueComparer<List<int>>(
                (a, b) => a!.SequenceEqual(b!),
                v => v.Aggregate(0, (hash, d) => HashCode.Combine(hash, d)),
                v => v.ToList());

            builder.Property(r => r.DaysOfMonth)
                .HasConversion(
                    v => string.Join(',', v),
                    v => v == string.Empty
                        ? new List<int>()
                        : v.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(int.Parse).ToList())
                .Metadata.SetValueComparer(daysOfMonthComparer);

            builder.Property(r => r.EffectiveFrom).IsRequired();
            builder.Property(r => r.EffectiveTo);
        }
    }
}