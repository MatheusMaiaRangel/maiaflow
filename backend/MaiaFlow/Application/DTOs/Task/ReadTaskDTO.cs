using MaiaFlow.Domain.TaskItem;

namespace MaiaFlow.Application.DTOs.TaskItem
{
    /// <summary>A task of the signed-in user.</summary>
    /// <param name="Id">Id of the task.</param>
    /// <param name="Title">Title of the task.</param>
    /// <param name="Description">Optional description.</param>
    /// <param name="DueDate">Optional due day.</param>
    /// <param name="Status">Current status.</param>
    /// <param name="CreatedOn">Day the task was created (Brasília); null for tasks created before it was recorded.</param>
    /// <param name="CompletedOn">Day the task was completed (Brasília); null unless the status is Completed, and also
    /// null for tasks completed before it was recorded.</param>
    public record ReadTaskDTO(
        int Id,
        string Title,
        string? Description,
        DateTime? DueDate,
        TaskItemStatus Status,
        DateOnly? CreatedOn,
        DateOnly? CompletedOn);
}