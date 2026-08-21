using MaiaFlow.Domain.Habit;

namespace MaiaFlow.Application.DTOs.Habit
{
    public record UpdateHabitDTO(
        string? Title,
        string? Description,
        HabitFrequencyType? FrequencyType,
        int? IntervalDays,
        WeekDays? DaysOfWeek,
        List<int>? DaysOfMonth,
        DateTime? StartDate);
}