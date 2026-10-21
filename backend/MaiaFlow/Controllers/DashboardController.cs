using MaiaFlow.Application;
using MaiaFlow.Application.DTOs.Dashboard;
using Microsoft.AspNetCore.Mvc;

namespace MaiaFlow.Controllers
{
    /// <summary>The signed-in user's Today dashboard (D28). The owner always comes from the token.</summary>
    [Route("api/dashboard")]
    public class DashboardController(IDashboardService dashboardService) : AuthenticatedControllerBase
    {
        /// <summary>Reads the dashboard. <c>config</c> is <c>null</c> (revision 0 when never saved) to use the
        /// front end's default.</summary>
        [HttpGet]
        [ProducesResponseType<DashboardDTO>(StatusCodes.Status200OK)]
        public async Task<ActionResult<DashboardDTO>> GetDashboard()
        {
            return Ok(await dashboardService.GetAsync(UserId));
        }

        /// <summary>Replaces the whole dashboard and returns it with its new revision. Answers 409 when the
        /// revision sent is not the stored one (another device saved first); nothing is changed then.</summary>
        [HttpPut]
        [ProducesResponseType<DashboardDTO>(StatusCodes.Status200OK)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status413PayloadTooLarge)]
        public async Task<ActionResult<DashboardDTO>> SaveDashboard(SaveDashboardDTO saveDashboardDto)
        {
            return Ok(await dashboardService.SaveAsync(UserId, saveDashboardDto));
        }

        /// <summary>"Restaurar padrão": clears the saved dashboard and bumps the revision, so other devices
        /// holding the old one get 409 on their next save. Without a saved dashboard it does nothing.</summary>
        [HttpDelete]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        public async Task<IActionResult> ResetDashboard()
        {
            await dashboardService.ResetAsync(UserId);
            return NoContent();
        }
    }
}
