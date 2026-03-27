using MaiaFlow.Application;
using MaiaFlow.Application.DTOs.User;
using MaiaFlow.Domain.User;

namespace MaiaFlow.Infrastructure
{
    public class UserService(IUserRepository repository) : IUserService
    {
        public async Task<ReadUserDTO> CreateUserAsync(CreateUserDTO createUserDto)
        {
            var user = User.Create(createUserDto.Name, createUserDto.Email, createUserDto.Password);

            await repository.AddAsync(user);

            var userDto = new ReadUserDTO(user.Name, user.Email);

            return userDto;
        }
    }
}