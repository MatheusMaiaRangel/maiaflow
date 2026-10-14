namespace MaiaFlow.Infrastructure
{
    /// <summary>
    /// System clock whose "local" time zone is the product's time zone (Brasília), so "today" means the
    /// users' calendar day instead of the UTC day.
    /// </summary>
    public sealed class ZonedTimeProvider(TimeZoneInfo zone) : TimeProvider
    {
        public override TimeZoneInfo LocalTimeZone => zone;
    }
}
