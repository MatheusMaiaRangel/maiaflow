using MaiaFlow.Domain.Habit;

namespace MaiaFlow.Application.DTOs.Habit
{
    public record ChangeRecurrenceDTO(
        HabitFrequencyType FrequencyType,
        int? IntervalDays,
        WeekDays DaysOfWeek,
        List<int>? DaysOfMonth,
        DateTime? EffectiveFrom);
}