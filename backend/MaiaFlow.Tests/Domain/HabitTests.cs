using MaiaFlow.Domain.Exceptions;
using MaiaFlow.Domain.Habit;

namespace MaiaFlow.Tests.Domain
{
    public class HabitTests
    {
        private static readonly DateTime Start = new(2026, 10, 12);

        private static Habit DailyHabit(string title = "Estudar", DateTime? start = null) =>
            Habit.Create(title, null, start ?? Start, 1, HabitFrequencyType.Daily, null, WeekDays.None, null);

        [Fact]
        public void A_new_habit_has_one_open_rule_starting_on_the_start_date()
        {
            var habit = DailyHabit(start: Start.AddHours(9));

            Assert.Equal(Start, habit.StartDate);
            Assert.Equal(Start, habit.GetCurrentRule()!.EffectiveFrom);
            Assert.Single(habit.Rules);
        }

        [Theory]
        [InlineData("")]
        [InlineData("  ")]
        [InlineData("ab")]
        public void Titles_must_be_present_and_have_at_least_three_characters(string title)
        {
            Assert.Throws<DomainValidationException>(() => DailyHabit(title));
        }

        [Fact]
        public void Titles_and_descriptions_have_a_maximum_length()
        {
            Assert.Throws<DomainValidationException>(() => DailyHabit(new string('a', Habit.MaxTitleLength + 1)));
            Assert.Throws<DomainValidationException>(() =>
                DailyHabit().UpdateDetails("Estudar", new string('a', Habit.MaxDescriptionLength + 1)));
        }

        [Fact]
        public void A_blank_description_is_stored_as_null()
        {
            var habit = DailyHabit().UpdateDetails("Estudar", "   ");

            Assert.Null(habit.Description);
        }

        [Fact]
        public void Changing_the_recurrence_closes_the_old_rule_and_keeps_the_history()
        {
            var habit = DailyHabit();
            var changeDate = Start.AddDays(10);

            habit.ChangeRecurrenceRule(HabitFrequencyType.Weekly, null, WeekDays.None, null, changeDate);

            Assert.Equal(2, habit.Rules.Count);
            Assert.Equal(HabitFrequencyType.Daily, habit.GetRuleAt(changeDate.AddDays(-1))!.FrequencyType);
            Assert.Equal(HabitFrequencyType.Weekly, habit.GetRuleAt(changeDate)!.FrequencyType);
            Assert.Equal(HabitFrequencyType.Weekly, habit.GetCurrentRule()!.FrequencyType);
        }

        [Fact]
        public void GetRuleAt_returns_nothing_before_the_habit_starts()
        {
            Assert.Null(DailyHabit().GetRuleAt(Start.AddDays(-1)));
        }

        [Fact]
        public void An_invalid_new_rule_leaves_the_current_rule_untouched()
        {
            var habit = DailyHabit();

            Assert.Throws<DomainValidationException>(() => habit.ChangeRecurrenceRule(
                HabitFrequencyType.IntervalDays, 0, WeekDays.None, null, Start.AddDays(3)));

            Assert.Single(habit.Rules);
            Assert.Null(habit.GetCurrentRule()!.EffectiveTo);
        }

        [Fact]
        public void The_recurrence_cannot_change_for_days_that_were_already_generated()
        {
            var habit = DailyHabit();
            habit.MarkOccurrencesGeneratedUntil(Start.AddDays(5));

            Assert.Throws<DomainValidationException>(() => habit.ChangeRecurrenceRule(
                HabitFrequencyType.Weekly, null, WeekDays.None, null, Start.AddDays(5)));
            habit.ChangeRecurrenceRule(HabitFrequencyType.Weekly, null, WeekDays.None, null, Start.AddDays(6));
            Assert.Equal(2, habit.Rules.Count);
        }

        [Fact]
        public void A_habit_keeps_at_most_MaxRules_recurrence_rules()
        {
            var habit = DailyHabit();
            for (var i = 1; i < Habit.MaxRules; i++)
                habit.ChangeRecurrenceRule(HabitFrequencyType.Daily, null, WeekDays.None, null, Start.AddDays(i));

            var error = Assert.Throws<DomainValidationException>(() => habit.ChangeRecurrenceRule(
                HabitFrequencyType.Weekly, null, WeekDays.None, null, Start.AddDays(Habit.MaxRules)));

            Assert.Equal(Habit.MaxRules, habit.Rules.Count);
            Assert.Contains(Habit.MaxRules.ToString(), error.Message);
        }

        [Fact]
        public void The_recurrence_cannot_start_before_the_current_rule()
        {
            var habit = DailyHabit();

            Assert.Throws<DomainValidationException>(() => habit.ChangeRecurrenceRule(
                HabitFrequencyType.Weekly, null, WeekDays.None, null, Start.AddDays(-1)));
        }

        [Fact]
        public void The_earliest_recurrence_change_is_today_or_the_day_after_the_generated_days()
        {
            var habit = DailyHabit();
            var today = Start.AddDays(10);

            Assert.Equal(today, habit.EarliestRecurrenceChange(today));

            habit.MarkOccurrencesGeneratedUntil(today);
            Assert.Equal(today.AddDays(1), habit.EarliestRecurrenceChange(today));

            habit.MarkOccurrencesGeneratedUntil(today.AddDays(-3));
            Assert.Equal(today, habit.EarliestRecurrenceChange(today));
        }

        [Fact]
        public void Occurrences_can_go_back_to_pending()
        {
            var occurrence = HabitOccurrence.Create(1, Start).MarkAsCompleted();

            occurrence.MarkAsPending();

            Assert.Equal(HabitOccurrenceStatus.Pending, occurrence.Status);
        }
    }
}
