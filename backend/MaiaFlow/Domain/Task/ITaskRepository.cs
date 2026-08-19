namespace MaiaFlow.Domain.TaskItem
{
    public interface ITaskRepository
    {
        Task AddAsync(TaskItem task);
        Task<TaskItem?> GetByIdAsync(int id);
        Task<List<TaskItem>> GetByUserIdAsync(int userId);
        Task UpdateAsync(TaskItem task);
        Task DeleteAsync(TaskItem task);
    }
}