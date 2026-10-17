namespace MaiaFlow.Application.DTOs.Habit
{
    /// <summary>Completion history of the user's habits over the last days, ending today (Brasília).</summary>
    /// <param name="Start">First day of the window.</param>
    /// <param name="End">Last day of the window (today).</param>
    /// <param name="Days">One entry per day of the window, oldest first, days without occurrences included.</param>
    /// <param name="Habits">One entry per habit, in the same order as <c>GET /api/habits</c>.</param>
    public record ReadHabitStatsDTO(
        DateTime Start,
        DateTime End,
        List<ReadHabitStatsDayDTO> Days,
        List<ReadHabitStatsItemDTO> Habits);

    /// <summary>Occurrence counts of one day, across all habits.</summary>
    public record ReadHabitStatsDayDTO(
        DateTime Date,
        int Completed,
        int NotCompleted,
        int Pending);

    /// <summary>Totals of one habit inside the window, plus its streaks.</summary>
    /// <param name="HabitId">Id of the habit.</param>
    /// <param name="HabitTitle">Current title of the habit.</param>
    /// <param name="Scheduled">Occurrences inside the window.</param>
    /// <param name="Completed">Completed occurrences inside the window.</param>
    /// <param name="NotCompleted">Occurrences marked as not completed inside the window.</param>
    /// <param name="Pending">Occurrences still pending inside the window (today's included).</param>
    /// <param name="CompletionRate">
    /// <c>Completed / Scheduled</c>, leaving out today's occurrence while it is still pending;
    /// <c>null</c> when nothing is left to count.
    /// </param>
    /// <param name="CurrentStreak">
    /// Completed occurrences in a row, counted back from the latest one (looks back up to 365 days);
    /// today's occurrence does not break it while it is still pending.
    /// </param>
    /// <param name="BestStreak">Longest run of completed occurrences in the same 365-day look-back.</param>
    public record ReadHabitStatsItemDTO(
        int HabitId,
        string HabitTitle,
        int Scheduled,
        int Completed,
        int NotCompleted,
        int Pending,
        double? CompletionRate,
        int CurrentStreak,
        int BestStreak);
}
