using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MaiaFlow.Infrastructure;

namespace MaiaFlow.Controllers
{
    /// <summary>Base for controllers whose routes need a signed-in user (JWT Bearer).</summary>
    [Authorize]
    [EnableRateLimiting(RateLimitingExtensions.UserPolicy)]
    [ApiController]
    [Produces("application/json")]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status429TooManyRequests)]
    public abstract class AuthenticatedControllerBase : ControllerBase
    {
        /// <summary>Id of the signed-in user, read from the JWT.</summary>
        protected int UserId =>
            int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? throw new UnauthorizedAccessException("Token inválido."));
    }
}
