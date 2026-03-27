
using MaiaFlow.Application;
using MaiaFlow.Application.DTOs.User;
using Microsoft.AspNetCore.Mvc;

namespace MaiaFlow.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UserController(IUserService _userService) : ControllerBase
    {

        [HttpPost]
        public async Task<ActionResult> CreateUser(CreateUserDTO createUserDto)
        {
            var response = await _userService.CreateUserAsync(createUserDto);
            
            return Ok(response);
        }
    }
}