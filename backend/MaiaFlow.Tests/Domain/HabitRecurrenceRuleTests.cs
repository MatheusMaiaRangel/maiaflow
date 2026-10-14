using MaiaFlow.Domain.Exceptions;
using MaiaFlow.Domain.Habit;

namespace MaiaFlow.Tests.Domain
{
    public class HabitRecurrenceRuleTests
    {
        private static readonly DateTime Monday = new(2026, 10, 12); // a Monday

        private static HabitRecurrenceRule Rule(HabitFrequencyType type, int? interval = null,
            WeekDays days = WeekDays.None, int[]? monthDays = null, DateTime? from = null) =>
            HabitRecurrenceRule.Create(1, type, interval, days, monthDays?.ToList() ?? [], from ?? Monday);

        [Fact]
        public void Daily_occurs_every_day_from_the_effective_date_on()
        {
            var rule = Rule(HabitFrequencyType.Daily);

            Assert.False(rule.OccursOn(Monday.AddDays(-1)));
            Assert.True(rule.OccursOn(Monday));
            Assert.True(rule.OccursOn(Monday.AddDays(400)));
        }

        [Fact]
        public void Weekly_is_anchored_on_the_weekday_of_the_effective_date()
        {
            var rule = Rule(HabitFrequencyType.Weekly);

            Assert.True(rule.OccursOn(Monday.AddDays(7)));
            Assert.False(rule.OccursOn(Monday.AddDays(8)));
            Assert.False(rule.OccursOn(Monday.AddDays(-7)));
        }

        [Fact]
        public void Monthly_occurs_only_on_the_chosen_days_and_skips_days_a_month_does_not_have()
        {
            var rule = Rule(HabitFrequencyType.Monthly, monthDays: [1, 15, 31], from: new DateTime(2026, 1, 1));

            Assert.True(rule.OccursOn(new DateTime(2026, 2, 1)));
            Assert.True(rule.OccursOn(new DateTime(2026, 2, 15)));
            Assert.False(rule.OccursOn(new DateTime(2026, 2, 16)));
            Assert.True(rule.OccursOn(new DateTime(2026, 3, 31)));
            Assert.False(rule.OccursOn(new DateTime(2026, 2, 28)));
        }

        [Fact]
        public void Yearly_is_anchored_on_day_and_month_and_29_february_only_happens_in_leap_years()
        {
            var rule = Rule(HabitFrequencyType.Yearly, from: new DateTime(2024, 2, 29));

            Assert.True(rule.OccursOn(new DateTime(2028, 2, 29)));
            Assert.False(rule.OccursOn(new DateTime(2025, 2, 28)));
            Assert.False(rule.OccursOn(new DateTime(2025, 3, 1)));
            Assert.True(Rule(HabitFrequencyType.Yearly).OccursOn(Monday.AddYears(1)));
        }

        [Fact]
        public void IntervalDays_occurs_every_n_days()
        {
            var rule = Rule(HabitFrequencyType.IntervalDays, interval: 3);

            Assert.True(rule.OccursOn(Monday));
            Assert.False(rule.OccursOn(Monday.AddDays(1)));
            Assert.False(rule.OccursOn(Monday.AddDays(2)));
            Assert.True(rule.OccursOn(Monday.AddDays(3)));
            Assert.True(rule.OccursOn(Monday.AddDays(300)));
        }

        [Fact]
        public void SpecificDaysOfWeek_uses_the_bit_mask()
        {
            var rule = Rule(HabitFrequencyType.SpecificDaysOfWeek,
                days: WeekDays.Monday | WeekDays.Wednesday | WeekDays.Friday); // 2 + 8 + 32 = 42

            Assert.True(rule.OccursOn(Monday));
            Assert.False(rule.OccursOn(Monday.AddDays(1)));
            Assert.True(rule.OccursOn(Monday.AddDays(2)));
            Assert.True(rule.OccursOn(Monday.AddDays(4)));
            Assert.False(rule.OccursOn(Monday.AddDays(5)));
            Assert.Equal(42, (int)(WeekDays.Monday | WeekDays.Wednesday | WeekDays.Friday));
        }

        [Fact]
        public void A_closed_rule_does_not_occur_on_or_after_its_end_date()
        {
            var rule = Rule(HabitFrequencyType.Daily);
            rule.Close(Monday.AddDays(5));

            Assert.True(rule.OccursOn(Monday.AddDays(4)));
            Assert.False(rule.OccursOn(Monday.AddDays(5)));
        }

        [Fact]
        public void Dates_are_normalized_to_midnight_so_a_time_of_day_cannot_hide_the_first_day()
        {
            var rule = Rule(HabitFrequencyType.Daily, from: Monday.AddHours(15));

            Assert.Equal(Monday, rule.EffectiveFrom);
            Assert.True(rule.OccursOn(Monday));
        }

        [Theory]
        [InlineData(HabitFrequencyType.IntervalDays, null, 0, new int[0])]
        [InlineData(HabitFrequencyType.IntervalDays, 0, 0, new int[0])]
        [InlineData(HabitFrequencyType.SpecificDaysOfWeek, null, 0, new int[0])]
        [InlineData(HabitFrequencyType.Monthly, null, 0, new int[0])]
        [InlineData(HabitFrequencyType.Monthly, null, 0, new[] { 0 })]
        [InlineData(HabitFrequencyType.Monthly, null, 0, new[] { 32 })]
        [InlineData(HabitFrequencyType.Daily, null, 128, new int[0])]
        [InlineData(HabitFrequencyType.Daily, null, -1, new int[0])]
        public void Invalid_rules_are_rejected(HabitFrequencyType type, int? interval, int days, int[] monthDays)
        {
            Assert.Throws<DomainValidationException>(() =>
                HabitRecurrenceRule.Create(1, type, interval, (WeekDays)days, monthDays.ToList(), Monday));
        }

        [Fact]
        public void Monthly_with_last_day_occurs_on_the_last_day_of_every_month_including_leap_february()
        {
            var rule = HabitRecurrenceRule.Create(1, HabitFrequencyType.Monthly, null, WeekDays.None, [15],
                new DateTime(2024, 1, 1), lastDayOfMonth: true);

            Assert.True(rule.OccursOn(new DateTime(2024, 2, 29)));
            Assert.False(rule.OccursOn(new DateTime(2024, 2, 28)));
            Assert.True(rule.OccursOn(new DateTime(2025, 2, 28)));
            Assert.True(rule.OccursOn(new DateTime(2025, 4, 30)));
            Assert.True(rule.OccursOn(new DateTime(2025, 4, 15))); // the chosen day still counts
            Assert.False(rule.OccursOn(new DateTime(2025, 4, 29)));
        }

        [Fact]
        public void The_last_day_option_is_ignored_for_other_frequencies()
        {
            var rule = HabitRecurrenceRule.Create(1, HabitFrequencyType.Weekly, null, WeekDays.None, [],
                Monday, lastDayOfMonth: true);

            Assert.False(rule.LastDayOfMonth);
        }
    }
}
