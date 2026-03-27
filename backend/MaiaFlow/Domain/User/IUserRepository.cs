namespace  MaiaFlow.Domain.User
{
    public interface IUserRepository
    {
        Task AddAsync(User user);
    }
}

