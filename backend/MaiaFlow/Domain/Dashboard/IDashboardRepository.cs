namespace MaiaFlow.Domain.Dashboard
{
    /// <summary>
    /// Saves are compare-and-set on the revision, done in one SQL statement each, so two devices saving at the
    /// same time can never both win.
    /// </summary>
    public interface IDashboardRepository
    {
        Task<Dashboard?> GetByUserIdAsync(int userId);

        /// <summary>Creates the row with revision 1. <c>false</c> when the user already has one.</summary>
        Task<bool> TryCreateAsync(int userId, string config, DateTimeOffset now);

        /// <summary>Stores <paramref name="config"/> and bumps the revision, only if it still is
        /// <paramref name="expectedRevision"/>. <c>false</c> when it is not (or there is no row).</summary>
        Task<bool> TryReplaceAsync(int userId, int expectedRevision, string? config, DateTimeOffset now);

        /// <summary>Clears the configuration and bumps the revision. Does nothing when there is no row.</summary>
        Task ResetAsync(int userId, DateTimeOffset now);
    }
}
