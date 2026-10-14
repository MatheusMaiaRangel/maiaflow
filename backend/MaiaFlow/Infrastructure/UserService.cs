using MaiaFlow.Application;
using MaiaFlow.Application.DTOs.User;
using MaiaFlow.Domain.Exceptions;
using MaiaFlow.Domain.User;

namespace MaiaFlow.Infrastructure
{
    public class UserService(IUserRepository repository, ITokenService tokenService) : IUserService
    {
        private static readonly string UnknownUserHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString());

        public async Task<ReadUserDTO> CreateUserAsync(CreateUserDTO createUserDto)
        {
            
            // Reject bad input before the database lookup and the (expensive) BCrypt hash.
            User.ValidateProfile(createUserDto.Name, createUserDto.Email);
            User.ValidatePassword(createUserDto.Password);

            var existingUser = await repository.GetByEmailAsync(User.NormalizeEmail(createUserDto.Email));
            if (existingUser != null)
                throw new ConflictException("E-mail já cadastrado.");

            var hashedPassword = BCrypt.Net.BCrypt.HashPassword(createUserDto.Password);

            var user = User.Create(createUserDto.Name, createUserDto.Email, hashedPassword);

            await repository.AddAsync(user);

            var userDto = new ReadUserDTO(user.Name, user.Email);

            return userDto;
        }
        
        public async Task<ReadUserDTO> GetUserByIdAsync(int id)
        {
            var user = await repository.GetByIdAsync(id);
            if (user == null) throw new NotFoundException("Usuário não encontrado.");
            
            var userDto = new ReadUserDTO(user.Name, user.Email);
            return userDto;
        }

        public async Task<ReadUserDTO> UpdateUserAsync(int id, UpdateUserDTO updateUserDto)
        {
            // search for an existent user
            var user = await repository.GetByIdAsync(id);
            if (user == null) throw new NotFoundException("Usuário não encontrado.");
            
            var name = updateUserDto.Name ?? user.Name;
            var email = updateUserDto.Email ?? user.Email;

            User.ValidateProfile(name, email);

            var otherUser = await repository.GetByEmailAsync(User.NormalizeEmail(email));
            if (otherUser != null && otherUser.Id != user.Id)
                throw new ConflictException("E-mail já cadastrado.");

            // a new password is validated in plain text and then hashed
            var password = user.Password;
            if (updateUserDto.Password is not null)
            {
                User.ValidatePassword(updateUserDto.Password);
                password = BCrypt.Net.BCrypt.HashPassword(updateUserDto.Password);
            }

            user.Update(name, email, password);
            
            await repository.UpdateAsync(user);

            var userDto = new ReadUserDTO(user.Name, user.Email);
            return userDto;
        }
        
        public async Task<AuthResponseDTO> LoginAsync(LoginUserDTO loginUserDto)
        {
            var email = User.NormalizeEmail(loginUserDto.Email);
            // An e-mail longer than the column can never match; skip the lookup (the BCrypt check below still runs).
            var user = email.Length > User.MaxEmailLength ? null : await repository.GetByEmailAsync(email);

            // Always run one BCrypt verification so an unknown e-mail takes as long as a wrong password.
            var passwordMatches = BCrypt.Net.BCrypt.Verify(loginUserDto.Password, user?.Password ?? UnknownUserHash);
            if (user == null || !passwordMatches)
                throw new UnauthorizedAccessException("Email ou senha inválidos.");

            var token = tokenService.GenerateToken(user);
            return new AuthResponseDTO(token);
        }

        public async Task DeleteUserAsync(int id)
        {
            var user = await repository.GetByIdAsync(id);
            if (user == null) throw new NotFoundException("Usuário não encontrado.");

            await repository.DeleteAsync(user);
        }
    }
}