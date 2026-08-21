namespace MaiaFlow.Domain.Habit
{
    public interface IHabitOccurrenceRepository
    {
        Task<HabitOccurrence?> GetByIdAsync(int id);
        Task<HabitOccurrence?> GetByHabitIdAndDateAsync(int habitId, DateTime date);
        Task<List<HabitOccurrence>> GetByUserIdAndDateRangeAsync(int userId, DateTime start, DateTime end);
        Task AddAsync(HabitOccurrence occurrence);
        Task AddRangeAsync(List<HabitOccurrence> occurrences);
        Task UpdateAsync(HabitOccurrence occurrence);
    }
}