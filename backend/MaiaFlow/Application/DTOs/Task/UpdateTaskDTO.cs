namespace MaiaFlow.Application.DTOs.TaskItem
{
    /// <param name="Title">New title. Omit to keep the current one (a title cannot be cleared).</param>
    /// <param name="Description">New description. Omit to keep it, send <c>null</c> to clear it.</param>
    /// <param name="DueDate">New due date. Omit to keep it, send <c>null</c> to clear it.</param>
    public record UpdateTaskDTO(string? Title, Optional<string?> Description, Optional<DateTime?> DueDate);
}