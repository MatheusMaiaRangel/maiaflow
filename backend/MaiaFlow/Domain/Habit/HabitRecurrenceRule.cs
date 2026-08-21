using System;
using System.Collections.Generic;
using System.Linq;

namespace MaiaFlow.Domain.Habit
{
    public class HabitRecurrenceRule
    {
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
            EffectiveFrom = effectiveFrom;
        }

        public static HabitRecurrenceRule Create(int habitId, HabitFrequencyType frequencyType, int? intervalDays,
            WeekDays daysOfWeek, List<int> daysOfMonth, DateTime effectiveFrom)
        {
            Validate(frequencyType, intervalDays, daysOfWeek, daysOfMonth);
            return new HabitRecurrenceRule(habitId, frequencyType, intervalDays, daysOfWeek, daysOfMonth, effectiveFrom);
        }

        public void Close(DateTime effectiveTo)
        {
            EffectiveTo = effectiveTo;
        }

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
            if (frequencyType == HabitFrequencyType.IntervalDays && (intervalDays == null || intervalDays <= 0))
                throw new ArgumentException("O intervalo em dias deve ser maior que zero.");

            if (frequencyType == HabitFrequencyType.SpecificDaysOfWeek && daysOfWeek == WeekDays.None)
                throw new ArgumentException("Selecione pelo menos um dia da semana para o hábito.");

            if (frequencyType == HabitFrequencyType.Monthly)
            {
                if (daysOfMonth.Count == 0)
                    throw new ArgumentException("Selecione pelo menos um dia do mês para o hábito.");

                if (daysOfMonth.Any(d => d < 1 || d > 31))
                    throw new ArgumentException("Os dias do mês devem estar entre 1 e 31.");
            }
        }
    }
}