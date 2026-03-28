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
        
        public async Task<ReadUserDTO> GetUserByIdAsync(int id)
        {
            var user = await repository.GetByIdAsync(id);
            if (user == null) throw new Exception("Usuário não encontrado");
            
            var userDto = new ReadUserDTO(user.Name, user.Email);
            return userDto;
        }

        public async Task<ReadUserDTO?> UpdateUserAsync(int id, UpdateUserDTO updateUserDto)
        {
            // search for an existent user
            var user = await repository.GetByIdAsync(id);
            if (user == null) return null;
            
            var name = updateUserDto.Name ?? user.Name;
            var email = updateUserDto.Email ?? user.Email;
            var password = updateUserDto.Password ?? user.Password;

            user.Update(name, email, password);
            
            await repository.UpdateAsync(user);

            var userDto = new ReadUserDTO(user.Name, user.Email);
            return userDto;
        }
    }
}