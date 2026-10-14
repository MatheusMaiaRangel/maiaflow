namespace MaiaFlow.Application.DTOs.Habit
{
    /// <param name="Title">New title. Omit to keep the current one (a title cannot be cleared).</param>
    /// <param name="Description">New description. Omit to keep it, send <c>null</c> to clear it.</param>
    public record UpdateHabitDetailsDTO(string? Title, Optional<string?> Description);
}