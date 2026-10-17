namespace MaiaFlow.Domain.Habit
{
    /// <summary>Completed occurrences in a row: the run that is still going and the longest one.</summary>
    public readonly record struct HabitStreak(int Current, int Best);

    /// <summary>Pure calculations behind the habit statistics, kept apart from data access so they are easy to test.</summary>
    public static class HabitStatistics
    {
        private const int RateDecimals = 4;

        /// <summary>
        /// Streaks over the given occurrences of one habit. Today's occurrence is left out while it is still
        /// pending (the day is not over); any other non-completed occurrence breaks the run.
        /// </summary>
        public static HabitStreak CalculateStreak(IEnumerable<HabitOccurrence> occurrences, DateTime today)
        {
            var statuses = occurrences
                .Where(o => !IsPendingToday(o, today))
                .OrderBy(o => o.Date)
                .Select(o => o.Status);

            var current = 0;
            var best = 0;
            foreach (var status in statuses)
            {
                current = status == HabitOccurrenceStatus.Completed ? current + 1 : 0;
                best = Math.Max(best, current);
            }

            return new HabitStreak(current, best);
        }

        /// <summary>
        /// <c>completed / scheduled</c>, without today's occurrence while it is pending; <c>null</c> when
        /// nothing is left to count. Rounded to four decimals.
        /// </summary>
        public static double? CompletionRate(int completed, int scheduled, bool isTodayPending)
        {
            var countable = scheduled - (isTodayPending ? 1 : 0);
            if (countable <= 0) return null;

            return Math.Round((double)completed / countable, RateDecimals, MidpointRounding.AwayFromZero);
        }

        public static bool IsPendingToday(HabitOccurrence occurrence, DateTime today) =>
            occurrence.Date.Date == today.Date && occurrence.Status == HabitOccurrenceStatus.Pending;
    }
}
