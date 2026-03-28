using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace MaiaFlow.Domain.User
{
	public class User
	{
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
		
		// Factory Method
		public static User Create(string name, string email, string password)
		{
			if(string.IsNullOrEmpty(name)) 
				throw new ArgumentException("O nome do usuário é obrigatório.");
			
			if (name.Length < 3)
				throw new ArgumentException("O nome do usuário deve conter pelo menos 3 caracteres.");

			if (string.IsNullOrEmpty(email))
				throw new ArgumentException("O email do usuário é obrigatório.");

			if (!email.Contains("@"))
				throw new ArgumentException("O email do usuário é inválido.");
			
			if (string.IsNullOrEmpty(password))
				throw new ArgumentException("A senha do usuário é obrigatória.");
			
			if (password.Length < 6)
				throw new ArgumentException("A senha do usuário deve conter pelo menos 6 caracteres.");
			
			return new User(name, email, password);
		}	
		
		public User Update(string name, string email, string password)
		{
			if(string.IsNullOrEmpty(name)) 
				throw new ArgumentException("O nome do usuário é obrigatório.");
			
			if (name.Length < 3)
				throw new ArgumentException("O nome do usuário deve conter pelo menos 3 caracteres.");

			if (string.IsNullOrEmpty(email))
				throw new ArgumentException("O email do usuário é obrigatório.");

			if (!email.Contains("@"))
				throw new ArgumentException("O email do usuário é inválido.");
			
			if (string.IsNullOrEmpty(password))
				throw new ArgumentException("A senha do usuário é obrigatória.");
			
			if (password.Length < 6)
				throw new ArgumentException("A senha do usuário deve conter pelo menos 6 caracteres.");
			
			Name = name;
			Email = email;
			Password = password;
			
			return this;
		}
	}
}