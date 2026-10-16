namespace MaiaFlow.Domain.Habit
{
    public interface IHabitOccurrenceRepository
    {
        Task<HabitOccurrence?> GetByIdAsync(int id);
        Task<List<HabitOccurrence>> GetByUserIdAndDateRangeAsync(int userId, DateTime start, DateTime end);
        Task AddRangeAsync(List<HabitOccurrence> occurrences);
        Task UpdateAsync(HabitOccurrence occurrence);
    }
}