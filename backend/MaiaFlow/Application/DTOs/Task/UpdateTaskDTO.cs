namespace MaiaFlow.Application.DTOs.TaskItem
{
    public record UpdateTaskDTO(string? Title, string? Description, DateTime? DueDate);
}