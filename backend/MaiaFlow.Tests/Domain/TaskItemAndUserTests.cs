using MaiaFlow.Domain.Exceptions;
using MaiaFlow.Domain.TaskItem;
using MaiaFlow.Domain.User;

namespace MaiaFlow.Tests.Domain
{
    public class TaskItemTests
    {
        [Fact]
        public void Create_and_update_apply_the_same_title_rules()
        {
            var task = TaskItem.Create("a", null, null, 1); // 1 character is valid

            task.Update("b", null, null);

            Assert.Equal("b", task.Title);
            Assert.Throws<DomainValidationException>(() => TaskItem.Create("  ", null, null, 1));
            Assert.Throws<DomainValidationException>(() => task.Update("  ", null, null));
            Assert.Throws<DomainValidationException>(() => TaskItem.Create(new string('a', 151), null, null, 1));
            Assert.Throws<DomainValidationException>(() => task.Update(new string('a', 151), null, null));
        }

        [Fact]
        public void A_new_task_is_pending_and_status_can_change()
        {
            var task = TaskItem.Create("Pagar conta", null, null, 1);

            Assert.Equal(TaskItemStatus.Pending, task.Status);
            Assert.Equal(TaskItemStatus.Completed, task.MarkAsCompleted().Status);
            Assert.Equal(TaskItemStatus.NotCompleted, task.MarkAsNotCompleted().Status);
            Assert.Equal(TaskItemStatus.Pending, task.MarkAsPending().Status);
        }

        [Fact]
        public void The_description_has_a_maximum_length_and_blank_means_none()
        {
            Assert.Throws<DomainValidationException>(() =>
                TaskItem.Create("Tarefa", new string('a', 501), null, 1));
            Assert.Null(TaskItem.Create("Tarefa", "  ", null, 1).Description);
        }

        [Fact]
        public void A_task_needs_a_valid_user()
        {
            Assert.Throws<DomainValidationException>(() => TaskItem.Create("Tarefa", null, null, 0));
        }
    }

    public class UserTests
    {
        [Fact]
        public void Emails_are_normalized_to_trimmed_lower_case()
        {
            var user = User.Create("  Maria Silva ", "  Maria@Example.COM ", "hash");

            Assert.Equal("maria@example.com", user.Email);
            Assert.Equal("Maria Silva", user.Name);
        }

        [Theory]
        [InlineData("Ma", "maria@example.com")]
        [InlineData("", "maria@example.com")]
        [InlineData("Maria Silva", "sem-arroba")]
        [InlineData("Maria Silva", "")]
        [InlineData("Maria Silva", "a b@example.com")]
        public void Invalid_profiles_are_rejected(string name, string email)
        {
            Assert.Throws<DomainValidationException>(() => User.Create(name, email, "hash"));
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("12345")]
        public void Plain_passwords_must_have_at_least_six_characters(string? password)
        {
            Assert.Throws<DomainValidationException>(() => User.ValidatePassword(password));
        }

        [Fact]
        public void Plain_passwords_longer_than_72_bytes_are_rejected_because_bcrypt_ignores_the_rest()
        {
            User.ValidatePassword(new string('a', 72));
            Assert.Throws<DomainValidationException>(() => User.ValidatePassword(new string('a', 73)));
        }
    }
}
