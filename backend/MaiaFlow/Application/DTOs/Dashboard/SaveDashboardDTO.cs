using System.Text.Json.Serialization;

namespace MaiaFlow.Application.DTOs.Dashboard
{
    /// <summary>Replaces the whole dashboard of the signed-in user.</summary>
    /// <param name="Revision">The revision the client last read (<c>0</c> when it never saw a saved one). When
    /// another device saved since, the API answers 409 and nothing changes.</param>
    /// <param name="Config">The new dashboard.</param>
    [JsonNumberHandling(JsonNumberHandling.Strict)]
    public record SaveDashboardDTO([property: JsonRequired] int Revision, DashboardConfigDTO Config);
}
