using MaiaFlow.Application.DTOs.Dashboard;

namespace MaiaFlow.Application
{
    public interface IDashboardService
    {
        Task<DashboardDTO> GetAsync(int userId);
        Task<DashboardDTO> SaveAsync(int userId, SaveDashboardDTO saveDashboardDto);
        Task ResetAsync(int userId);
    }
}
