namespace MaiaFlow.Application.DTOs.Dashboard
{
    /// <summary>The signed-in user's dashboard (D28).</summary>
    /// <param name="Revision">Changes on every save; send it back on <c>PUT</c>. <c>0</c> when the user never
    /// saved a dashboard.</param>
    /// <param name="Config">The saved dashboard, or <c>null</c> to use the front end's default.</param>
    public record DashboardDTO(int Revision, DashboardConfigDTO? Config);
}
