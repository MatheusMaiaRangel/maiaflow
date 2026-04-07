namespace  MaiaFlow.Domain.User
{
    public interface IUserRepository
    {
        Task AddAsync(User user);
        Task<User?> GetByIdAsync(int id);
        Task<User?> GetByEmailAsync(string email);
        Task UpdateAsync(User user);
    }
}

