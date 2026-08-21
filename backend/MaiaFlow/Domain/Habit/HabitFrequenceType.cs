namespace MaiaFlow.Domain.Habit
{
    public enum HabitFrequencyType
    {
        Daily,
        Weekly,
        Monthly,
        Yearly,
        IntervalDays,           // a cada X dias
        SpecificDaysOfWeek      // dias fixos (seg, qua, sex...)
    }
}