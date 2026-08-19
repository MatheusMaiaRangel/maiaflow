namespace MaiaFlow.Domain.TaskItem
{
    public class TaskItem
    {
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
            if (string.IsNullOrEmpty(title))
                throw new ArgumentException("O título da tarefa é obrigatório.");

            if (title.Length < 1)
                throw new ArgumentException("O título da tarefa deve conter pelo menos 1 caracter.");

            if (userId <= 0)
                throw new ArgumentException("A tarefa deve estar vinculada a um usuário válido.");

            return new TaskItem(title, description, dueDate, userId);
        }

        public TaskItem Update(string title, string? description, DateTime? dueDate)
        {
            if (string.IsNullOrEmpty(title))
                throw new ArgumentException("O título da tarefa é obrigatório.");

            if (title.Length < 3)
                throw new ArgumentException("O título da tarefa deve conter pelo menos 3 caracteres.");

            Title = title;
            Description = description;
            DueDate = dueDate;

            return this;
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