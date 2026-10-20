using MaiaFlow.Domain.Exceptions;

namespace MaiaFlow.Domain.TaskItem
{
    public class TaskItem
    {
        public const int MaxTitleLength = 150;
        public const int MaxDescriptionLength = 500;

        public int Id { get; }
        public string Title { get; private set; }
        public string? Description { get; private set; }
        public DateTime? DueDate { get; private set; }
        public TaskItemStatus Status { get; private set; }
        public int UserId { get; private set; }

        // Calendar days in Brasília (D15, D25). Tasks created before these columns existed keep both empty.
        public DateOnly? CreatedOn { get; private set; }
        public DateOnly? CompletedOn { get; private set; }

        // Constructors
        // For EF Core, which sets the properties after construction.
        private TaskItem()
        {
            Title = null!;
        }

        private TaskItem(string title, string? description, DateTime? dueDate, int userId, DateOnly createdOn)
        {
            Title = title;
            Description = description;
            DueDate = dueDate;
            UserId = userId;
            Status = TaskItemStatus.Pending;
            CreatedOn = createdOn;
        }

        // Factory Method
        public static TaskItem Create(string title, string? description, DateTime? dueDate, int userId, DateOnly today)
        {
            if (userId <= 0)
                throw new DomainValidationException("A tarefa deve estar vinculada a um usuário válido.");

            var (validTitle, validDescription) = Validate(title, description);
            return new TaskItem(validTitle, validDescription, dueDate, userId, today);
        }

        public TaskItem Update(string title, string? description, DateTime? dueDate)
        {
            var (validTitle, validDescription) = Validate(title, description);

            Title = validTitle;
            Description = validDescription;
            DueDate = dueDate;

            return this;
        }

        // Same rules on create and update.
        private static (string Title, string? Description) Validate(string? title, string? description)
        {
            if (string.IsNullOrWhiteSpace(title))
                throw new DomainValidationException("O título da tarefa é obrigatório.");

            var trimmedTitle = title.Trim();
            if (trimmedTitle.Length > MaxTitleLength)
                throw new DomainValidationException(
                    $"O título da tarefa deve conter no máximo {MaxTitleLength} caracteres.");

            if (description is { Length: > MaxDescriptionLength })
                throw new DomainValidationException(
                    $"A descrição da tarefa deve conter no máximo {MaxDescriptionLength} caracteres.");

            return (trimmedTitle, string.IsNullOrWhiteSpace(description) ? null : description);
        }

        // Completing an already completed task keeps the day it was first completed.
        public TaskItem MarkAsCompleted(DateOnly today)
        {
            if (Status != TaskItemStatus.Completed)
                CompletedOn = today;

            Status = TaskItemStatus.Completed;
            return this;
        }

        public TaskItem MarkAsNotCompleted()
        {
            Status = TaskItemStatus.NotCompleted;
            CompletedOn = null;
            return this;
        }

        public TaskItem MarkAsPending()
        {
            Status = TaskItemStatus.Pending;
            CompletedOn = null;
            return this;
        }
    }
}