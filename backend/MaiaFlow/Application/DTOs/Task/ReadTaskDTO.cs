using MaiaFlow.Domain.TaskItem;

namespace MaiaFlow.Application.DTOs.TaskItem
{
    public record ReadTaskDTO(int Id, string Title, string? Description, DateTime? DueDate, TaskItemStatus Status);
}