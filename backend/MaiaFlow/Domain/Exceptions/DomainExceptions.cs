namespace MaiaFlow.Domain.Exceptions
{
    /// <summary>A business rule or input validation failed. Maps to HTTP 400.</summary>
    public class DomainValidationException(string message) : Exception(message);

    /// <summary>The resource does not exist or does not belong to the caller. Maps to HTTP 404.</summary>
    public class NotFoundException(string message) : Exception(message);

    /// <summary>The operation conflicts with existing data, such as a duplicated e-mail. Maps to HTTP 409.</summary>
    public class ConflictException(string message) : Exception(message);
}
