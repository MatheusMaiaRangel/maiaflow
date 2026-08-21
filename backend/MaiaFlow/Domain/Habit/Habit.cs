namespace MaiaFlow.Domain.Habit
{
    public class Habit
    {
        public int Id { get; }
        public string Title { get; private set; }
        public string? Description { get; private set; }
        public DateTime StartDate { get; private set; }
        public int UserId { get; private set; }
        public DateTime? OccurrencesGeneratedUntil { get; private set; }

        private readonly List<HabitRecurrenceRule> _rules = new();
        public IReadOnlyCollection<HabitRecurrenceRule> Rules => _rules.AsReadOnly();

        private Habit()
        {
        }

        private Habit(string title, string? description, DateTime startDate, int userId)
        {
            Title = title;
            Description = description;
            StartDate = startDate;
            UserId = userId;
        }

        public static Habit Create(string title, string? description, DateTime startDate, int userId,
            HabitFrequencyType frequencyType, int? intervalDays, WeekDays daysOfWeek, List<int>? daysOfMonth)
        {
            if (string.IsNullOrEmpty(title))
                throw new ArgumentException("O título do hábito é obrigatório.");

            if (title.Length < 3)
                throw new ArgumentException("O título do hábito deve conter pelo menos 3 caracteres.");

            if (userId <= 0)
                throw new ArgumentException("O hábito deve estar vinculado a um usuário válido.");

            var habit = new Habit(title, description, startDate, userId);
            var rule = HabitRecurrenceRule.Create(habit.Id, frequencyType, intervalDays, daysOfWeek,
                daysOfMonth ?? new List<int>(), startDate);

            habit._rules.Add(rule);
            return habit;
        }

        public Habit UpdateDetails(string title, string? description)
        {
            if (string.IsNullOrEmpty(title))
                throw new ArgumentException("O título do hábito é obrigatório.");

            if (title.Length < 3)
                throw new ArgumentException("O título do hábito deve conter pelo menos 3 caracteres.");

            Title = title;
            Description = description;
            return this;
        }

        public HabitRecurrenceRule ChangeRecurrenceRule(HabitFrequencyType frequencyType, int? intervalDays,
            WeekDays daysOfWeek, List<int>? daysOfMonth, DateTime effectiveFrom)
        {
            var currentRule = _rules.SingleOrDefault(r => r.EffectiveTo == null);
            currentRule?.Close(effectiveFrom);

            var newRule = HabitRecurrenceRule.Create(Id, frequencyType, intervalDays, daysOfWeek,
                daysOfMonth ?? new List<int>(), effectiveFrom);

            _rules.Add(newRule);
            return newRule;
        }

        public HabitRecurrenceRule? GetCurrentRule() => _rules.SingleOrDefault(r => r.EffectiveTo == null);

        public HabitRecurrenceRule? GetRuleAt(DateTime date) =>
            _rules.SingleOrDefault(r => r.EffectiveFrom <= date && (r.EffectiveTo == null || r.EffectiveTo > date));

        public void MarkOccurrencesGeneratedUntil(DateTime date)
        {
            OccurrencesGeneratedUntil = date.Date;
        }
    }
}