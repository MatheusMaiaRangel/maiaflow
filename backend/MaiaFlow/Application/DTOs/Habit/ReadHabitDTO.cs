using MaiaFlow.Domain.Habit;

namespace MaiaFlow.Application.DTOs.Habit
{
    public record ReadHabitDTO(
        int Id,
        string Title,
        string? Description,
        DateTime StartDate,
        HabitFrequencyType CurrentFrequencyType,
        int? CurrentIntervalDays,
        WeekDays CurrentDaysOfWeek,
        List<int> CurrentDaysOfMonth);
}