namespace MaiaFlow.Tests.Integration
{
    /// <summary>The product's "today": the calendar day in Brasília (the real clock, for tests that do not fake time).</summary>
    public static class BrazilTime
    {
        public static readonly TimeZoneInfo Zone = TimeZoneInfo.FindSystemTimeZoneById("America/Sao_Paulo");

        public static DateTime Today => TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, Zone).Date;
    }
}
