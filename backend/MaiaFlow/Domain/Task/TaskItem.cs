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

        // Constructors
        private TaskItem()
        {
        }

        private TaskItem(string title, string? description, DateTime? dueDate, int userId)
        {
            Title = title;
            Description = description;
            DueDate = dueDate;
            UserId = userId;
            Status = TaskItemStatus.Pending;
        }

        // Factory Method
        public static TaskItem Create(string title, string? description, DateTime? dueDate, int userId)
        {
            if (userId <= 0)
                throw new DomainValidationException("A tarefa deve estar vinculada a um usuário válido.");

            var (validTitle, validDescription) = Validate(title, description);
            return new TaskItem(validTitle, validDescription, dueDate, userId);
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

        public TaskItem MarkAsCompleted()
        {
            Status = TaskItemStatus.Completed;
            return this;
        }

        public TaskItem MarkAsNotCompleted()
        {
            Status = TaskItemStatus.NotCompleted;
            return this;
        }

        public TaskItem MarkAsPending()
        {
            Status = TaskItemStatus.Pending;
            return this;
        }
    }
}