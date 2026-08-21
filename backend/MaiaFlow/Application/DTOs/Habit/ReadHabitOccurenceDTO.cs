using MaiaFlow.Domain.Habit;

namespace MaiaFlow.Application.DTOs.Habit
{
    public record ReadHabitOccurrenceDTO(
        int Id,
        int HabitId,
        string HabitTitle,
        DateTime Date,
        HabitOccurrenceStatus Status);
}