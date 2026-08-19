namespace MaiaFlow.Application.DTOs.TaskItem
{
    public record CreateTaskDTO(string Title, string? Description, DateTime? DueDate);
}