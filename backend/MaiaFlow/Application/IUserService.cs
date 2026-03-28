using MaiaFlow.Application.DTOs.User;

namespace MaiaFlow.Application
{
    public interface IUserService
    {
        Task <ReadUserDTO>CreateUserAsync(CreateUserDTO createUserDto);
        Task <ReadUserDTO>GetUserByIdAsync(int id);
        Task <ReadUserDTO?>UpdateUserAsync(int id, UpdateUserDTO updateUserDto);
    }
}