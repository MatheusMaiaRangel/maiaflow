using MaiaFlow.Domain.User;

namespace MaiaFlow.Application
{

    public interface ITokenService
    {
        string GenerateToken(User  user);
    }
}