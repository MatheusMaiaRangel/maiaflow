using MaiaFlow.Domain.Habit;

namespace MaiaFlow.Application.DTOs.Habit
{
    public record CreateHabitDTO(
        string Title,
        string? Description,
        DateTime StartDate,
        HabitFrequencyType FrequencyType,
        int? IntervalDays,
        int DaysOfWeek,
        List<int>? DaysOfMonth,
        bool LastDayOfMonth = false);
}