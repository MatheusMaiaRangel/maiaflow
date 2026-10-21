namespace MaiaFlow.Domain.Dashboard
{
    /// <summary>
    /// A user's dashboard (D28): one row per user holding the whole configuration as JSON. The revision changes on
    /// every save, so a device that saves over a version it never saw gets a conflict instead of erasing it.
    /// </summary>
    public class Dashboard
    {
        public int UserId { get; private set; }

        /// <summary>The configuration as JSON, or <c>null</c> to use the front end's default.</summary>
        public string? Config { get; private set; }

        public int Revision { get; private set; }

        public DateTimeOffset UpdatedAt { get; private set; }

        // For EF Core, which sets the properties after construction.
        private Dashboard()
        {
        }
    }
}
