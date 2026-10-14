using System.Net.Mail;
using MaiaFlow.Domain.Exceptions;

namespace MaiaFlow.Domain.User
{
	public class User
	{
		public const int MinNameLength = 3;
		public const int MaxNameLength = 100;
		public const int MaxEmailLength = 256;
		public const int MinPasswordLength = 6;
		public const int MaxPasswordLength = 72; // BCrypt ignores everything after 72 bytes

		public int Id { get; }
		public string Name { get; private set; }
		public string Email { get; private set; }
		public string Password { get; private set; }

		// Constructors
		private User()
		{

		}

		private User(string name, string email, string password)
		{
			Name = name;
			Email = email;
			Password = password;
		}

		// Factory Method. "passwordHash" is the BCrypt hash; validate the plain text with ValidatePassword first.
		public static User Create(string name, string email, string passwordHash)
		{
			var normalizedEmail = NormalizeEmail(email);
			ValidateProfile(name, normalizedEmail, passwordHash);
			return new User(name.Trim(), normalizedEmail, passwordHash);
		}

		public User Update(string name, string email, string passwordHash)
		{
			var normalizedEmail = NormalizeEmail(email);
			ValidateProfile(name, normalizedEmail, passwordHash);

			Name = name.Trim();
			Email = normalizedEmail;
			Password = passwordHash;

			return this;
		}

		/// <summary>E-mails are stored trimmed and lower-case so uniqueness does not depend on casing.</summary>
		public static string NormalizeEmail(string? email) => (email ?? string.Empty).Trim().ToLowerInvariant();

		/// <summary>Validates a plain-text password. Call it before hashing.</summary>
		public static void ValidatePassword(string? password)
		{
			if (string.IsNullOrEmpty(password))
				throw new DomainValidationException("A senha do usuário é obrigatória.");

			if (password.Length < MinPasswordLength)
				throw new DomainValidationException(
					$"A senha do usuário deve conter pelo menos {MinPasswordLength} caracteres.");

			if (System.Text.Encoding.UTF8.GetByteCount(password) > MaxPasswordLength)
				throw new DomainValidationException(
					$"A senha do usuário deve conter no máximo {MaxPasswordLength} bytes.");
		}

		/// <summary>Validates name and e-mail only, so callers can reject bad input before any hashing or lookup.</summary>
		public static void ValidateProfile(string? name, string? email)
		{
			ValidateName(name);
			ValidateEmail(NormalizeEmail(email));
		}

		private static void ValidateProfile(string? name, string email, string passwordHash)
		{
			ValidateName(name);
			ValidateEmail(email);

			if (string.IsNullOrEmpty(passwordHash))
				throw new DomainValidationException("A senha do usuário é obrigatória.");
		}

		private static void ValidateName(string? name)
		{
			if (string.IsNullOrWhiteSpace(name))
				throw new DomainValidationException("O nome do usuário é obrigatório.");

			if (name.Trim().Length < MinNameLength)
				throw new DomainValidationException(
					$"O nome do usuário deve conter pelo menos {MinNameLength} caracteres.");

			if (name.Trim().Length > MaxNameLength)
				throw new DomainValidationException(
					$"O nome do usuário deve conter no máximo {MaxNameLength} caracteres.");
		}

		private static void ValidateEmail(string email)
		{
			if (string.IsNullOrEmpty(email))
				throw new DomainValidationException("O email do usuário é obrigatório.");

			if (email.Length > MaxEmailLength || !IsValidEmail(email))
				throw new DomainValidationException("O email do usuário é inválido.");
		}

		private static bool IsValidEmail(string email) =>
			MailAddress.TryCreate(email, out var address) && address.Address == email;
	}
}
