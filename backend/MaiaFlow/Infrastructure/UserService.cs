using MaiaFlow.Application;
using MaiaFlow.Application.DTOs.User;
using MaiaFlow.Domain.User;

namespace MaiaFlow.Infrastructure
{
    public class UserService(IUserRepository repository, ITokenService tokenService) : IUserService
    {
        public async Task<ReadUserDTO> CreateUserAsync(CreateUserDTO createUserDto)
        {
            
            var existingUser = await repository.GetByEmailAsync(createUserDto.Email);
            if (existingUser != null)
                throw new InvalidOperationException("E-mail já cadastrado.");
            
            var hashedPassword = BCrypt.Net.BCrypt.HashPassword(createUserDto.Password);
            
            var user = User.Create(createUserDto.Name, createUserDto.Email, hashedPassword);

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
            
            // if the user changes the password will create a new hash pass
            var password = updateUserDto.Password is null
                ? user.Password
                : BCrypt.Net.BCrypt.HashPassword(updateUserDto.Password);
            
            
            user.Update(name, email, password);
            
            await repository.UpdateAsync(user);

            var userDto = new ReadUserDTO(user.Name, user.Email);
            return userDto;
        }
        
        public async Task<AuthResponseDTO> LoginAsync(LoginUserDTO loginUserDto)
        {
            var user = await repository.GetByEmailAsync(loginUserDto.Email);
            if (user == null || !BCrypt.Net.BCrypt.Verify(loginUserDto.Password, user.Password))
                throw new UnauthorizedAccessException("Email ou senha inválidos.");

            var token = tokenService.GenerateToken(user);
            return new AuthResponseDTO(token);
        }
    }
}