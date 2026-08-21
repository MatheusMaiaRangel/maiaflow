namespace MaiaFlow.Domain.Habit
{
    public interface IHabitRepository
    {
        Task AddAsync(Habit habit);
        Task<Habit?> GetByIdAsync(int id);     
        Task<List<Habit>> GetByUserIdAsync(int userId); 
        Task UpdateAsync(Habit habit);
        Task DeleteAsync(Habit habit);
    }
}