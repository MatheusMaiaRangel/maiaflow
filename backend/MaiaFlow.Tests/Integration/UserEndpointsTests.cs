using System.Net;
using System.Net.Http.Json;
using static MaiaFlow.Tests.Integration.TestClient;

namespace MaiaFlow.Tests.Integration
{
    [Collection(ApiCollection.Name)]
    public class UserEndpointsTests(ApiFixture fixture)
    {
        [Fact]
        public async Task Sign_up_returns_201_and_never_returns_the_password()
        {
            var client = fixture.Factory.CreateClient();

            var response = await client.PostAsJsonAsync("/api/users",
                new { name = "Maria Silva", email = UniqueEmail(), password = Password });

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            Assert.Equal("/api/users/me", response.Headers.Location!.AbsolutePath);
            var body = await response.ReadJsonAsync();
            Assert.False(body.TryGetProperty("password", out _));
        }

        [Theory]
        [InlineData("Maria Silva", "sem-arroba", "senha-segura-1")]
        [InlineData("Ma", "ok@example.com", "senha-segura-1")]
        [InlineData("Maria Silva", "ok@example.com", "123")]
        public async Task Sign_up_with_invalid_data_returns_400(string name, string email, string password)
        {
            var response = await fixture.Factory.CreateClient()
                .PostAsJsonAsync("/api/users", new { name, email, password });

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task Emails_are_case_insensitive_for_sign_up_and_login()
        {
            var email = UniqueEmail();
            var client = fixture.Factory.CreateClient();
            await client.PostAsJsonAsync("/api/users", new { name = "Maria Silva", email, password = Password });

            var duplicate = await client.PostAsJsonAsync("/api/users",
                new { name = "Maria Silva", email = email.ToUpperInvariant(), password = Password });
            var login = await client.PostAsJsonAsync("/api/auth/login",
                new { email = email.ToUpperInvariant(), password = Password });

            Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
            Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        }

        [Fact]
        public async Task Get_me_returns_the_signed_in_user()
        {
            var email = UniqueEmail();
            var client = await SignedInClientAsync(fixture, email);

            var me = await (await client.GetAsync("/api/users/me")).ReadJsonAsync();

            Assert.Equal(email, me.GetProperty("email").GetString());
            Assert.Equal("Usuário Teste", me.GetProperty("name").GetString());
        }

        [Fact]
        public async Task Users_cannot_reach_other_users_through_the_old_id_routes()
        {
            var client = await SignedInClientAsync(fixture);

            Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/users/1")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await client.DeleteAsync("/api/users/1")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/users/1")).StatusCode);
        }

        [Fact]
        public async Task Patch_me_changes_only_the_fields_sent()
        {
            var email = UniqueEmail();
            var client = await SignedInClientAsync(fixture, email);

            var response = await client.PatchJsonAsync("/api/users/me", """{"name":"Novo Nome"}""");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.ReadJsonAsync();
            Assert.Equal("Novo Nome", body.GetProperty("name").GetString());
            Assert.Equal(email, body.GetProperty("email").GetString());
        }

        [Fact]
        public async Task Patch_me_with_an_email_used_by_someone_else_returns_409()
        {
            var otherEmail = UniqueEmail();
            await SignedInClientAsync(fixture, otherEmail);
            var client = await SignedInClientAsync(fixture);

            var response = await client.PatchJsonAsync("/api/users/me", $$"""{"email":"{{otherEmail}}"}""");

            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        }

        [Fact]
        public async Task Patch_me_keeping_the_same_email_is_allowed()
        {
            var email = UniqueEmail();
            var client = await SignedInClientAsync(fixture, email);

            var response = await client.PatchJsonAsync("/api/users/me", $$"""{"email":"{{email}}"}""");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        [Fact]
        public async Task Changing_the_password_validates_the_plain_text_and_lets_the_user_sign_in_with_the_new_one()
        {
            var email = UniqueEmail();
            var client = await SignedInClientAsync(fixture, email);

            var tooShort = await client.PatchJsonAsync("/api/users/me", """{"password":"123"}""");
            var changed = await client.PatchJsonAsync("/api/users/me", """{"password":"outra-senha-2"}""");

            Assert.Equal(HttpStatusCode.BadRequest, tooShort.StatusCode);
            Assert.Equal(HttpStatusCode.OK, changed.StatusCode);
            var anonymous = fixture.Factory.CreateClient();
            Assert.Equal(HttpStatusCode.Unauthorized,
                (await anonymous.PostAsJsonAsync("/api/auth/login", new { email, password = Password })).StatusCode);
            Assert.Equal(HttpStatusCode.OK,
                (await anonymous.PostAsJsonAsync("/api/auth/login", new { email, password = "outra-senha-2" })).StatusCode);
        }

        [Fact]
        public async Task Delete_me_removes_the_account_and_a_still_valid_token_then_gets_404()
        {
            var email = UniqueEmail();
            var client = await SignedInClientAsync(fixture, email);
            await client.PostJsonAsync("/api/tasks", """{"title":"Some task"}""");

            Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync("/api/users/me")).StatusCode);

            Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/users/me")).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized,
                (await fixture.Factory.CreateClient()
                    .PostAsJsonAsync("/api/auth/login", new { email, password = Password })).StatusCode);
        }
    }
}
