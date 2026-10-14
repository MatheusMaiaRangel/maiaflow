using MaiaFlow.Application;
using MaiaFlow.Application.DTOs.User;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MaiaFlow.Controllers
{
    [Route("api")]
    public class UserController(IUserService userService) : AuthenticatedControllerBase
    {
        /// <summary>Registers a new user.</summary>
        [AllowAnonymous]
        [HttpPost("users")]
        [ProducesResponseType<ReadUserDTO>(StatusCodes.Status201Created)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
        public async Task<ActionResult<ReadUserDTO>> CreateUser(CreateUserDTO createUserDto)
        {
            var response = await userService.CreateUserAsync(createUserDto);
            return CreatedAtAction(nameof(GetMe), response);
        }

        /// <summary>Signs in and returns a JWT to send as <c>Authorization: Bearer</c>.</summary>
        [AllowAnonymous]
        [HttpPost("auth/login")]
        [ProducesResponseType<AuthResponseDTO>(StatusCodes.Status200OK)]
        public async Task<ActionResult<AuthResponseDTO>> Login(LoginUserDTO loginDto)
        {
            return Ok(await userService.LoginAsync(loginDto));
        }

        /// <summary>The signed-in user's profile.</summary>
        [HttpGet("users/me")]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        [ProducesResponseType<ReadUserDTO>(StatusCodes.Status200OK)]
        public async Task<ActionResult<ReadUserDTO>> GetMe()
        {
            return Ok(await userService.GetUserByIdAsync(UserId));
        }

        /// <summary>Edits name, e-mail, or password. Only the fields sent are changed.</summary>
        [HttpPatch("users/me")]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
        [ProducesResponseType<ReadUserDTO>(StatusCodes.Status200OK)]
        public async Task<ActionResult<ReadUserDTO>> UpdateMe(UpdateUserDTO updateUserDto)
        {
            return Ok(await userService.UpdateUserAsync(UserId, updateUserDto));
        }

        /// <summary>Deletes the signed-in user and all their tasks and habits.</summary>
        [HttpDelete("users/me")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> DeleteMe()
        {
            await userService.DeleteUserAsync(UserId);
            return NoContent();
        }
    }
}
