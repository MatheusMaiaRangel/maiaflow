using MaiaFlow.Domain.Habit;
using static MaiaFlow.Domain.Habit.HabitOccurrenceStatus;

namespace MaiaFlow.Tests.Domain
{
    public class HabitStatisticsTests
    {
        private static readonly DateTime Today = new(2026, 10, 14);

        // One occurrence per day, the last one being today.
        private static List<HabitOccurrence> Days(params HabitOccurrenceStatus[] statuses) =>
            statuses.Select((status, i) => Occurrence(Today.AddDays(i - statuses.Length + 1), status)).ToList();

        private static HabitOccurrence Occurrence(DateTime date, HabitOccurrenceStatus status)
        {
            var occurrence = HabitOccurrence.Create(1, date);
            return status switch
            {
                Completed => occurrence.MarkAsCompleted(),
                NotCompleted => occurrence.MarkAsNotCompleted(),
                _ => occurrence
            };
        }

        [Fact]
        public void No_occurrences_means_no_streak()
        {
            Assert.Equal(new HabitStreak(0, 0), HabitStatistics.CalculateStreak([], Today));
        }

        [Fact]
        public void The_current_streak_is_the_trailing_run_and_the_best_is_the_longest_run()
        {
            var streak = HabitStatistics.CalculateStreak(Days(Completed, Completed, Completed, NotCompleted, Completed, Completed), Today);

            Assert.Equal(new HabitStreak(2, 3), streak);
        }

        [Fact]
        public void Today_still_pending_does_not_break_the_streak()
        {
            var streak = HabitStatistics.CalculateStreak(Days(Completed, Completed, Pending), Today);

            Assert.Equal(new HabitStreak(2, 2), streak);
        }

        [Fact]
        public void A_past_pending_day_breaks_the_streak()
        {
            var streak = HabitStatistics.CalculateStreak(Days(Completed, Completed, Pending, Completed), Today);

            Assert.Equal(new HabitStreak(1, 2), streak);
        }

        [Fact]
        public void Today_not_completed_ends_the_current_streak()
        {
            var streak = HabitStatistics.CalculateStreak(Days(Completed, Completed, NotCompleted), Today);

            Assert.Equal(new HabitStreak(0, 2), streak);
        }

        [Fact]
        public void Occurrences_are_sorted_by_date_before_counting()
        {
            var shuffled = Days(NotCompleted, Completed, Completed).AsEnumerable().Reverse();

            Assert.Equal(new HabitStreak(2, 2), HabitStatistics.CalculateStreak(shuffled, Today));
        }

        [Theory]
        [InlineData(2, 4, true, 0.6667)]
        [InlineData(3, 4, false, 0.75)]
        [InlineData(0, 3, false, 0.0)]
        [InlineData(1, 1, false, 1.0)]
        public void The_completion_rate_leaves_out_today_while_it_is_pending(int completed, int scheduled, bool isTodayPending, double expected)
        {
            Assert.Equal(expected, HabitStatistics.CompletionRate(completed, scheduled, isTodayPending));
        }

        [Theory]
        [InlineData(0, false)]
        [InlineData(1, true)]
        public void The_completion_rate_is_null_when_nothing_is_left_to_count(int scheduled, bool isTodayPending)
        {
            Assert.Null(HabitStatistics.CompletionRate(0, scheduled, isTodayPending));
        }
    }
}
