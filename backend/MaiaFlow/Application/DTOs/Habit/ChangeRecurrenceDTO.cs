using MaiaFlow.Domain.Habit;

namespace MaiaFlow.Application.DTOs.Habit
{
    public record ChangeRecurrenceDTO(
        HabitFrequencyType FrequencyType,
        int? IntervalDays,
        int DaysOfWeek,
        List<int>? DaysOfMonth,
        DateTime? EffectiveFrom,
        bool LastDayOfMonth = false);
}