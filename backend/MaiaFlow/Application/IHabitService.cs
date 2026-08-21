using MaiaFlow.Application.DTOs.Habit;

namespace MaiaFlow.Application
{
    public interface IHabitService
    {
        Task<ReadHabitDTO> CreateHabitAsync(int userId, CreateHabitDTO createHabitDto);
        Task<ReadHabitDTO> GetHabitByIdAsync(int userId, int habitId);
        Task<List<ReadHabitDTO>> GetHabitsByUserAsync(int userId);
        Task<ReadHabitDTO?> UpdateHabitDetailsAsync(int userId, int habitId, UpdateHabitDetailsDTO updateDto);
        Task<ReadHabitDTO?> ChangeRecurrenceRuleAsync(int userId, int habitId, ChangeRecurrenceDTO changeDto);
        Task<bool> DeleteHabitAsync(int userId, int habitId);
        Task<List<ReadHabitOccurrenceDTO>> GetCalendarAsync(int userId, DateTime start, DateTime end);
        Task<ReadHabitOccurrenceDTO?> UpdateOccurrenceStatusAsync(int userId, int occurrenceId, UpdateOccurrenceStatusDTO statusDto);
    }
}