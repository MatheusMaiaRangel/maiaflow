using MaiaFlow.Application.DTOs.TaskItem;

namespace MaiaFlow.Application
{
    public interface ITaskService
    {
        Task<ReadTaskDTO> CreateTaskAsync(int userId, CreateTaskDTO createTaskDto);
        Task<ReadTaskDTO> GetTaskByIdAsync(int userId, int taskId);
        Task<List<ReadTaskDTO>> GetTasksByUserAsync(int userId);
        Task<ReadTaskDTO?> UpdateTaskAsync(int userId, int taskId, UpdateTaskDTO updateTaskDto);
        Task<ReadTaskDTO?> UpdateTaskStatusAsync(int userId, int taskId, UpdateTaskStatusDTO updateStatusDto);
        Task<bool> DeleteTaskAsync(int userId, int taskId);
    }
}