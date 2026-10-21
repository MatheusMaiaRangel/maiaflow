using System.Net;
using MaiaFlow.Tests.Application;
using static MaiaFlow.Tests.Integration.TestClient;

namespace MaiaFlow.Tests.Integration
{
    /// <summary>
    /// Every shared case of <c>contracts/dashboard-validation-cases.json</c> through the real endpoint: valid ones
    /// are saved, invalid ones get 400 (from binding or from the validator).
    /// </summary>
    [Collection(ApiCollection.Name)]
    public class DashboardContractCasesTests(ApiFixture fixture)
    {
        // One user for all the cases (signing up 100+ users would mostly measure BCrypt). The cases of a theory run
        // one after another, and each valid one saves over the revision it just read.
        private static readonly SemaphoreSlim ClientLock = new(1, 1);
        private static HttpClient? _client;

        public static TheoryData<string> CaseNames => DashboardCases.Names();

        private async Task<HttpClient> ClientAsync()
        {
            await ClientLock.WaitAsync();
            try
            {
                return _client ??= await SignedInClientAsync(fixture);
            }
            finally
            {
                ClientLock.Release();
            }
        }

        [Theory]
        [MemberData(nameof(CaseNames))]
        public async Task Shared_case_gets_the_expected_status(string name)
        {
            var sharedCase = DashboardCases.Get(name);
            var client = await ClientAsync();
            var revision = (await (await client.GetAsync("/api/dashboard")).ReadJsonAsync()).GetProperty("revision").GetInt32();

            var response = await client.PutJsonAsync("/api/dashboard",
                $$"""{"revision":{{revision}},"config":{{sharedCase.Config.GetRawText()}}}""");

            var expected = sharedCase.Valid ? HttpStatusCode.OK : HttpStatusCode.BadRequest;
            Assert.True(expected == response.StatusCode,
                $"Expected {expected} but got {response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        }
    }
}
