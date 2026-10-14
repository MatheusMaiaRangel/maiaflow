using MaiaFlow.Application;
using MaiaFlow.Application.DTOs.TaskItem;
using MaiaFlow.Domain.Exceptions;
using MaiaFlow.Domain.TaskItem;

namespace MaiaFlow.Infrastructure
{
    public class TaskService(ITaskRepository repository) : ITaskService
    {
        public async Task<ReadTaskDTO> CreateTaskAsync(int userId, CreateTaskDTO createTaskDto)
        {
            var task = TaskItem.Create(createTaskDto.Title, createTaskDto.Description, createTaskDto.DueDate, userId);

            await repository.AddAsync(task);

            return ToDto(task);
        }

        public async Task<ReadTaskDTO> GetTaskByIdAsync(int userId, int taskId)
        {
            var task = await GetOwnedTaskAsync(userId, taskId);
            return ToDto(task);
        }

        public async Task<List<ReadTaskDTO>> GetTasksByUserAsync(int userId)
        {
            var tasks = await repository.GetByUserIdAsync(userId);
            return tasks.Select(ToDto).ToList();
        }

        public async Task<ReadTaskDTO> UpdateTaskAsync(int userId, int taskId, UpdateTaskDTO updateTaskDto)
        {
            var task = await GetOwnedTaskAsync(userId, taskId);

            var title = updateTaskDto.Title ?? task.Title;
            var description = updateTaskDto.Description.Resolve(task.Description);
            var dueDate = updateTaskDto.DueDate.Resolve(task.DueDate);

            task.Update(title, description, dueDate);

            await repository.UpdateAsync(task);

            return ToDto(task);
        }

        public async Task<ReadTaskDTO> UpdateTaskStatusAsync(int userId, int taskId, UpdateTaskStatusDTO updateStatusDto)
        {
            var task = await GetOwnedTaskAsync(userId, taskId);

            switch (updateStatusDto.Status)
            {
                case TaskItemStatus.Completed:
                    task.MarkAsCompleted();
                    break;
                case TaskItemStatus.NotCompleted:
                    task.MarkAsNotCompleted();
                    break;
                case TaskItemStatus.Pending:
                    task.MarkAsPending();
                    break;
            }

            await repository.UpdateAsync(task);

            return ToDto(task);
        }

        public async Task DeleteTaskAsync(int userId, int taskId)
        {
            var task = await GetOwnedTaskAsync(userId, taskId);
            await repository.DeleteAsync(task);
        }

        private async Task<TaskItem> GetOwnedTaskAsync(int userId, int taskId)
        {
            var task = await repository.GetByIdAsync(taskId);
            if (task == null || task.UserId != userId)
                throw new NotFoundException("Tarefa não encontrada.");

            return task;
        }

        private static ReadTaskDTO ToDto(TaskItem task)
        {
            return new ReadTaskDTO(task.Id, task.Title, task.Description, task.DueDate, task.Status);
        }
    }
}