using MaiaFlow.Domain.Exceptions;

namespace MaiaFlow.Domain.Habit
{
    public class Habit
    {
        public const int MinTitleLength = 3;
        public const int MaxTitleLength = 150;
        public const int MaxDescriptionLength = 500;
        /// <summary>Upper bound on recurrence rules (history included), so the calendar stays cheap to compute.</summary>
        public const int MaxRules = 100;

        public int Id { get; }
        public string Title { get; private set; }
        public string? Description { get; private set; }
        public DateTime StartDate { get; private set; }
        public int UserId { get; private set; }
        public DateTime? OccurrencesGeneratedUntil { get; private set; }

        private readonly List<HabitRecurrenceRule> _rules = new();
        public IReadOnlyCollection<HabitRecurrenceRule> Rules => _rules.AsReadOnly();

        // For EF Core, which sets the properties after construction.
        private Habit()
        {
            Title = null!;
        }

        private Habit(string title, string? description, DateTime startDate, int userId)
        {
            Title = title;
            Description = description;
            StartDate = startDate;
            UserId = userId;
        }

        public static Habit Create(string title, string? description, DateTime startDate, int userId,
            HabitFrequencyType frequencyType, int? intervalDays, WeekDays daysOfWeek, List<int>? daysOfMonth,
            bool lastDayOfMonth = false)
        {
            if (userId <= 0)
                throw new DomainValidationException("O hábito deve estar vinculado a um usuário válido.");

            var (validTitle, validDescription) = Validate(title, description);

            var habit = new Habit(validTitle, validDescription, startDate.Date, userId);
            var rule = HabitRecurrenceRule.Create(habit.Id, frequencyType, intervalDays, daysOfWeek,
                daysOfMonth ?? new List<int>(), startDate, lastDayOfMonth);

            habit._rules.Add(rule);
            return habit;
        }

        public Habit UpdateDetails(string title, string? description)
        {
            var (validTitle, validDescription) = Validate(title, description);

            Title = validTitle;
            Description = validDescription;
            return this;
        }

        /// <summary>
        /// First day on which a recurrence change can take effect: not before <paramref name="today"/>,
        /// not before the current rule starts (a habit may start in the future), and after the days whose
        /// occurrences were already generated (those are never rewritten).
        /// </summary>
        public DateTime EarliestRecurrenceChange(DateTime today)
        {
            var earliest = today.Date;
            if (OccurrencesGeneratedUntil.HasValue && OccurrencesGeneratedUntil.Value.AddDays(1) > earliest)
                earliest = OccurrencesGeneratedUntil.Value.AddDays(1);

            var currentStart = GetCurrentRule()?.EffectiveFrom;
            return currentStart.HasValue && currentStart.Value > earliest ? currentStart.Value : earliest;
        }

        /// <summary>
        /// Closes the current rule on <paramref name="effectiveFrom"/> and starts a new one that day.
        /// Days before it keep the old rule, so history is preserved.
        /// </summary>
        public HabitRecurrenceRule ChangeRecurrenceRule(HabitFrequencyType frequencyType, int? intervalDays,
            WeekDays daysOfWeek, List<int>? daysOfMonth, DateTime effectiveFrom, bool lastDayOfMonth = false)
        {
            var from = effectiveFrom.Date;
            var currentRule = GetCurrentRule();

            if (OccurrencesGeneratedUntil.HasValue && from <= OccurrencesGeneratedUntil.Value)
                throw new DomainValidationException(
                    $"A recorrência só pode mudar a partir de {OccurrencesGeneratedUntil.Value.AddDays(1):yyyy-MM-dd}, " +
                    "pois os dias anteriores já foram gerados.");

            if (currentRule != null && from < currentRule.EffectiveFrom)
                throw new DomainValidationException(
                    "A nova recorrência não pode começar antes da recorrência atual.");

            if (_rules.Count >= MaxRules)
                throw new DomainValidationException(
                    $"Este hábito já teve {MaxRules} mudanças de recorrência; crie um novo hábito.");

            // Validate the new rule before touching the current one.
            var newRule = HabitRecurrenceRule.Create(Id, frequencyType, intervalDays, daysOfWeek,
                daysOfMonth ?? new List<int>(), from, lastDayOfMonth);

            currentRule?.Close(from);
            _rules.Add(newRule);
            return newRule;
        }

        /// <summary>
        /// The most recent rule (the one with no end date). If a change was scheduled for the future this is
        /// the scheduled rule, not the one active today; use <see cref="GetRuleAt"/> for a specific day.
        /// </summary>
        public HabitRecurrenceRule? GetCurrentRule() =>
            _rules.Where(r => r.EffectiveTo == null).OrderByDescending(r => r.EffectiveFrom).FirstOrDefault();

        /// <summary>The rule that applies on <paramref name="date"/>, or null before the habit starts.</summary>
        public HabitRecurrenceRule? GetRuleAt(DateTime date) =>
            _rules
                .Where(r => r.EffectiveFrom <= date.Date && (r.EffectiveTo == null || r.EffectiveTo > date.Date))
                .OrderByDescending(r => r.EffectiveFrom)
                .FirstOrDefault();

        public void MarkOccurrencesGeneratedUntil(DateTime date)
        {
            OccurrencesGeneratedUntil = date.Date;
        }

        private static (string Title, string? Description) Validate(string? title, string? description)
        {
            if (string.IsNullOrWhiteSpace(title))
                throw new DomainValidationException("O título do hábito é obrigatório.");

            var trimmedTitle = title.Trim();
            if (trimmedTitle.Length < MinTitleLength)
                throw new DomainValidationException(
                    $"O título do hábito deve conter pelo menos {MinTitleLength} caracteres.");

            if (trimmedTitle.Length > MaxTitleLength)
                throw new DomainValidationException(
                    $"O título do hábito deve conter no máximo {MaxTitleLength} caracteres.");

            if (description is { Length: > MaxDescriptionLength })
                throw new DomainValidationException(
                    $"A descrição do hábito deve conter no máximo {MaxDescriptionLength} caracteres.");

            return (trimmedTitle, string.IsNullOrWhiteSpace(description) ? null : description);
        }
    }
}
