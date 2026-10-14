using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MaiaFlow.Controllers
{
    /// <summary>Base for controllers whose routes need a signed-in user (JWT Bearer).</summary>
    [Authorize]
    [ApiController]
    [Produces("application/json")]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public abstract class AuthenticatedControllerBase : ControllerBase
    {
        /// <summary>Id of the signed-in user, read from the JWT.</summary>
        protected int UserId =>
            int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? throw new UnauthorizedAccessException("Token inválido."));
    }
}
