
using MaiaFlow.Application;
using MaiaFlow.Application.DTOs.User;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MaiaFlow.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UserController(IUserService _userService) : ControllerBase
    {

        [AllowAnonymous]
        [HttpPost]
        [Route("/users")]
        public async Task<ActionResult> CreateUser(CreateUserDTO createUserDto)
        {
            var response = await _userService.CreateUserAsync(createUserDto);

            return Ok(response);
        }
        
        [AllowAnonymous]
        [HttpPost]
        [Route("/auth/login")]
        public async Task<ActionResult> Login(LoginUserDTO loginDto)
        {
            try
            {
                var response = await _userService.LoginAsync(loginDto);
                return Ok(response);
            }
            catch (UnauthorizedAccessException)
            {
                return Unauthorized(new { message = "Email ou senha inválidos." });
            }
        }

        [Authorize]
        [HttpGet]
        [Route("/users/{id}")]
        public async Task<ActionResult> GetUserById(int id)
        {
            var response = await _userService.GetUserByIdAsync(id);
            return Ok(response);
        }
        
        [Authorize]
        [HttpPatch("/users/{id}")]
        public async Task<ActionResult> UpdateUser(int id, UpdateUserDTO updateUserDto)
        {
            var response = await _userService.UpdateUserAsync(id, updateUserDto);
            if (response == null)
            {
                return NotFound();
            }
            return Ok(response);

        }
    }
}