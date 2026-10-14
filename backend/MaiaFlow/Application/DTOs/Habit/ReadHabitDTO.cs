using MaiaFlow.Domain.Habit;

namespace MaiaFlow.Application.DTOs.Habit
{
    public record ReadHabitDTO(
        int Id,
        string Title,
        string? Description,
        DateTime StartDate,
        DateTime CurrentEffectiveFrom,
        HabitFrequencyType CurrentFrequencyType,
        int? CurrentIntervalDays,
        int CurrentDaysOfWeek,
        List<int> CurrentDaysOfMonth);
}