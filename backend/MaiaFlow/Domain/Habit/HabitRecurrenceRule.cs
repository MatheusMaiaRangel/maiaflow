using MaiaFlow.Domain.Exceptions;

using System;
using System.Collections.Generic;
using System.Linq;

namespace MaiaFlow.Domain.Habit
{
    public class HabitRecurrenceRule
    {
        private const WeekDays AllWeekDays = (WeekDays)127;
        public const int MaxIntervalDays = 3650;

        public int Id { get; }
        public int HabitId { get; private set; }
        public HabitFrequencyType FrequencyType { get; private set; }
        public int? IntervalDays { get; private set; }
        public WeekDays DaysOfWeek { get; private set; }
        public List<int> DaysOfMonth { get; private set; } = new();
        public DateTime EffectiveFrom { get; private set; }
        public DateTime? EffectiveTo { get; private set; }

        private HabitRecurrenceRule()
        {
        }

        private HabitRecurrenceRule(int habitId, HabitFrequencyType frequencyType, int? intervalDays,
            WeekDays daysOfWeek, List<int> daysOfMonth, DateTime effectiveFrom)
        {
            HabitId = habitId;
            FrequencyType = frequencyType;
            IntervalDays = intervalDays;
            DaysOfWeek = daysOfWeek;
            DaysOfMonth = daysOfMonth;
            EffectiveFrom = effectiveFrom.Date;
        }

        public static HabitRecurrenceRule Create(int habitId, HabitFrequencyType frequencyType, int? intervalDays,
            WeekDays daysOfWeek, List<int> daysOfMonth, DateTime effectiveFrom)
        {
            Validate(frequencyType, intervalDays, daysOfWeek, daysOfMonth);
            var days = daysOfMonth.Distinct().Order().ToList();
            return new HabitRecurrenceRule(habitId, frequencyType, intervalDays, daysOfWeek, days, effectiveFrom);
        }

        public void Close(DateTime effectiveTo)
        {
            EffectiveTo = effectiveTo.Date;
        }

        /// <summary>
        /// Whether the habit happens on <paramref name="date"/>. <c>Weekly</c>, <c>Yearly</c> and
        /// <c>IntervalDays</c> are anchored on <see cref="EffectiveFrom"/> (the habit's start date, or the
        /// day a later rule began). A <c>Yearly</c> habit anchored on 29 February only happens in leap
        /// years, and <c>Monthly</c> days that a month does not have (such as 31) are skipped.
        /// </summary>
        public bool OccursOn(DateTime date)
        {
            if (date.Date < EffectiveFrom.Date) return false;
            if (EffectiveTo.HasValue && date.Date >= EffectiveTo.Value.Date) return false;

            return FrequencyType switch
            {
                HabitFrequencyType.Daily => true,
                HabitFrequencyType.Weekly => date.DayOfWeek == EffectiveFrom.DayOfWeek,
                HabitFrequencyType.Monthly => DaysOfMonth.Contains(date.Day),
                HabitFrequencyType.Yearly => date.Month == EffectiveFrom.Month && date.Day == EffectiveFrom.Day,
                HabitFrequencyType.IntervalDays => IntervalDays.HasValue
                    && (date.Date - EffectiveFrom.Date).Days % IntervalDays.Value == 0,
                HabitFrequencyType.SpecificDaysOfWeek => DaysOfWeek.HasFlag(ToWeekDays(date.DayOfWeek)),
                _ => false
            };
        }

        private static WeekDays ToWeekDays(DayOfWeek day) => day switch
        {
            DayOfWeek.Sunday => WeekDays.Sunday,
            DayOfWeek.Monday => WeekDays.Monday,
            DayOfWeek.Tuesday => WeekDays.Tuesday,
            DayOfWeek.Wednesday => WeekDays.Wednesday,
            DayOfWeek.Thursday => WeekDays.Thursday,
            DayOfWeek.Friday => WeekDays.Friday,
            DayOfWeek.Saturday => WeekDays.Saturday,
            _ => WeekDays.None
        };

        private static void Validate(HabitFrequencyType frequencyType, int? intervalDays,
            WeekDays daysOfWeek, List<int> daysOfMonth)
        {
            if (!Enum.IsDefined(frequencyType))
                throw new DomainValidationException("A frequência do hábito é inválida.");

            if (frequencyType == HabitFrequencyType.IntervalDays
                && (intervalDays == null || intervalDays <= 0 || intervalDays > MaxIntervalDays))
                throw new DomainValidationException(
                    $"O intervalo em dias deve estar entre 1 e {MaxIntervalDays}.");

            if ((daysOfWeek & ~AllWeekDays) != 0)
                throw new DomainValidationException("Os dias da semana informados são inválidos.");

            if (frequencyType == HabitFrequencyType.SpecificDaysOfWeek && daysOfWeek == WeekDays.None)
                throw new DomainValidationException("Selecione pelo menos um dia da semana para o hábito.");

            // Checked for every frequency type so the stored list stays small.
            if (daysOfMonth.Count > 31 || daysOfMonth.Any(d => d < 1 || d > 31))
                throw new DomainValidationException("Os dias do mês devem estar entre 1 e 31.");

            if (frequencyType == HabitFrequencyType.Monthly && daysOfMonth.Count == 0)
                throw new DomainValidationException("Selecione pelo menos um dia do mês para o hábito.");
        }
    }
}