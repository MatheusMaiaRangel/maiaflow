namespace MaiaFlow.Domain.Habit
{
    public class HabitOccurrence
    {
        public int Id { get; }
        public int HabitId { get; private set; }
        public DateTime Date { get; private set; }
        public HabitOccurrenceStatus Status { get; private set; }

        private HabitOccurrence()
        {
        }

        private HabitOccurrence(int habitId, DateTime date)
        {
            HabitId = habitId;
            Date = date.Date;
            Status = HabitOccurrenceStatus.Pending;
        }

        public static HabitOccurrence Create(int habitId, DateTime date)
        {
            if (habitId <= 0)
                throw new ArgumentException("A ocorrência deve estar vinculada a um hábito válido.");

            return new HabitOccurrence(habitId, date);
        }

        public HabitOccurrence MarkAsCompleted()
        {
            Status = HabitOccurrenceStatus.Completed;
            return this;
        }

        public HabitOccurrence MarkAsNotCompleted()
        {
            Status = HabitOccurrenceStatus.NotCompleted;
            return this;
        }
    }
}