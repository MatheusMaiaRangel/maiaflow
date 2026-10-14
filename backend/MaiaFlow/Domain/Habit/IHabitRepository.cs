namespace MaiaFlow.Domain.Habit
{
    public interface IHabitRepository
    {
        Task AddAsync(Habit habit);
        Task<Habit?> GetByIdAsync(int id);     
        Task<List<Habit>> GetByUserIdAsync(int userId);
        Task<int> CountByUserIdAsync(int userId);
        Task UpdateAsync(Habit habit);
        Task AdvanceOccurrencesGeneratedUntilAsync(int habitId, DateTime date);
        Task DeleteAsync(Habit habit);
    }
}