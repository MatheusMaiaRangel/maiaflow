using MaiaFlow.Application.DTOs.User;

namespace MaiaFlow.Application
{
    public interface IUserService
    {
        Task <ReadUserDTO>CreateUserAsync(CreateUserDTO createUserDto);
    }
}