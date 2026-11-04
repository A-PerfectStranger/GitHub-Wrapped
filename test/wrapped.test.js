import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import handler, { appJwt, wordsFrom, longestStreak, personality } from '../api/wrapped.js';
const originalFetch = globalThis.fetch;
const envNames = ['GITHUB_APP_ID', 'GITHUB_APP_PRIVATE_KEY', 'GITHUB_APP_INSTALLATION_ID'];
const originalEnv = envNames.map(name => process.env[name]);
after(() => { globalThis.fetch = originalFetch; envNames.forEach((name, index) => { if (originalEnv[index] === undefined) delete process.env[name]; else process.env[name] = originalEnv[index]; }); });
async function request(url, method = 'GET') {
  const headers = {}; let body;
  const res = { setHeader: (key, value) => { headers[key] = value; }, end: value => { body = JSON.parse(value); } };
  await handler({ url, method }, res);
  return { status: res.statusCode, headers, body };
}
const year = new Date().getUTCFullYear();
test('demo is credential-free, complete, deterministic, and cacheable', async () => {
  envNames.forEach(name => delete process.env[name]);
  const result = await request(`/api/wrapped?user=octocat&year=${year}&mock=1`);
  assert.equal(result.status, 200); assert.equal(result.body.year, year);
  assert.equal(result.body.hourHistogram.length, 24); assert.equal(result.body.repos.length, 8);
  assert.equal(result.body.persona.title, 'Búho nocturno'); assert.equal(result.body.commitWords.length, 18);
  assert.match(result.headers['Cache-Control'], /s-maxage=3600/);
  assert.deepEqual(result.body, (await request(`/api/wrapped?user=octocat&year=${year}&mock=1`)).body);
});
test('invalid logins, years, and methods return JSON without caching', async () => {
  for (const query of ['user=bad/name', 'user=', `user=${'a'.repeat(40)}`, 'user=ok&year=2007', `user=ok&year=${year + 1}`, 'user=ok&year=2020.5', 'user=ok&year=']) {
    const result = await request(`/api/wrapped?${query}&mock=1`); assert.equal(result.status, 400); assert.equal(result.headers['Cache-Control'], 'no-store'); assert.ok(result.body.error);
  }
  const result = await request('/api/wrapped?user=ok', 'POST'); assert.equal(result.status, 405); assert.equal(result.headers.Allow, 'GET');
});
test('missing GitHub App configuration gives a friendly 503', async () => { assert.equal((await request('/api/wrapped?user=octocat')).status, 503); });
test('word processing strips prefixes, hashes, URLs, numbers, stopwords, and second lines', () => {
  assert.deepEqual(wordsFrom(['feat(ui): Add Órbita galaxy https://example.com abcdef123 123\nsecret body', 'fix: galaxy de la órbita']), [{ word: 'galaxy', count: 2 }, { word: 'órbita', count: 2 }]);
  assert.equal(wordsFrom(Array.from({ length: 100 }, (_, i) => `term${String.fromCharCode(97 + i % 26)}word${String.fromCharCode(97 + Math.floor(i / 26))}`)).length, 60);
});
test('streaks handle gaps, zeros, and empty calendars', () => {
  assert.equal(longestStreak([]).count, 0);
  assert.equal(longestStreak([{ date: '2024-02-28', count: 2 }, { date: '2024-02-29', count: 1 }, { date: '2024-03-01', count: 2 }, { date: '2024-03-03', count: 1 }, { date: '2024-03-04', count: 0 }]).count, 3);
});
test('personality applies strict thresholds and precedence to all six rules', () => {
  const hours = Array(24).fill(0); hours[22] = 41; hours[5] = 41;
  const choose = (h, weekends = 0, langs = [], cal = []) => personality(h, weekends, 100, langs, cal).title;
  assert.equal(choose(hours, 99), 'Búho nocturno'); hours[22] = 40; assert.equal(choose(hours), 'Madrugador'); hours[5] = 40;
  assert.equal(choose(hours, 46), 'Maratonista de fines de semana');
  const languages = Array.from({ length: 5 }, (_, i) => ({ name: `${i}`, bytes: 20 })); assert.equal(choose(hours, 45, languages), 'Políglota');
  const calendar = Array.from({ length: 30 }, (_, i) => ({ date: `2024-01-${String(i + 1).padStart(2, '0')}`, count: 1 }));
  assert.equal(choose(hours, 45, [], calendar), 'Imparable'); assert.equal(choose(hours), 'Constructor');
  assert.equal(personality(Array(24).fill(0), 0, 0, [], []).title, 'Constructor');
});
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
function configure() { process.env.GITHUB_APP_ID = '123'; process.env.GITHUB_APP_INSTALLATION_ID = '456'; process.env.GITHUB_APP_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).replace(/\n/g, '\\n'); }
function profile() {
  const repositories = Array.from({ length: 10 }, (_, i) => ({ repository: { name: `repo-${i}`, nameWithOwner: `octocat/repo-${i}`, isPrivate: i === 0, pushedAt: `${year}-06-01T12:00:00Z`, createdAt: `${year}-01-01T00:00:00Z`, stargazerCount: 2, forkCount: 1, primaryLanguage: { name: 'JavaScript', color: '#f1e05a' }, languages: { edges: [{ size: 100, node: { name: 'JavaScript', color: '#f1e05a' } }] } }, contributions: { totalCount: 100 - i } }));
  return { login: 'octocat', name: 'Octocat', avatarUrl: '', createdAt: '2011-01-25T00:00:00Z', contributionsCollection: { totalCommitContributions: 800, totalPullRequestContributions: 3, totalIssueContributions: 2, totalPullRequestReviewContributions: 5, totalRepositoryContributions: 1, contributionCalendar: { weeks: [{ contributionDays: [{ date: `${year - 1}-12-31`, contributionCount: 99 }, { date: `${year}-01-01`, contributionCount: 2 }, { date: `${year}-01-02`, contributionCount: 3 }] }] }, commitContributionsByRepository: repositories, pullRequestContributions: { nodes: [{ occurredAt: `${year}-01-02T00:00:00Z`, pullRequest: { repository: { isPrivate: true }, title: 'PRIVATE PR' } }] }, repositoryContributions: { nodes: [{ occurredAt: `${year}-01-02T00:00:00Z`, repository: { isPrivate: true, name: 'PRIVATE REPO' } }] } } };
}
let calls = [], installationCalls = 0;
function upstream({ user = profile(), errors, restStatus = 200, restHeaders = {} } = {}) {
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/access_tokens')) {
      installationCalls++;
      const jwt = options.headers.Authorization.slice(7), [header, payload, signature] = jwt.split('.');
      assert.equal(JSON.parse(Buffer.from(payload, 'base64url')).iss, '123');
      assert.equal(createVerify('RSA-SHA256').update(`${header}.${payload}`).verify(publicKey, signature, 'base64url'), true);
      return Response.json({ token: 'server-only-token', expires_at: new Date(Date.now() + 3600000).toISOString() });
    }
    assert.equal(options.headers.Authorization, 'Bearer server-only-token');
    if (url.endsWith('/graphql')) return Response.json(errors ? { errors } : { data: { user } });
    const i = Number(url.match(/repo-(\d+)/)[1]);
    return Response.json(restStatus === 200 ? [{ sha: 'shared-sha', commit: { message: 'feat: galaxy orbit', author: { date: `${year}-01-01T23:00:00Z` } } }, { sha: `sha-${i}`, commit: { message: 'fix: keyboard galaxy', author: { date: `${year}-01-02T23:00:00Z` } } }] : { message: 'error' }, { status: restStatus, headers: restHeaders });
  };
}
test('real collection signs JWT, filters private details, bounds REST, and deduplicates commits', async () => {
  configure(); calls = []; upstream();
  const result = await request(`/api/wrapped?user=octocat&year=${year}`);
  assert.equal(result.status, 200); assert.equal(result.body.repos.length, 9); assert.equal(result.body.totals.commits, 800);
  assert.equal(result.body.sample.commits, 9); assert.equal(result.body.calendar.length, 2); assert.equal(result.body.languages[0].bytes, 800);
  assert.equal(result.body.persona.title, 'Búho nocturno'); assert.ok(!JSON.stringify(result.body).includes('PRIVATE')); assert.ok(!JSON.stringify(result.body).includes('server-only-token'));
  const rest = calls.filter(call => call.url.includes('/commits?')); assert.equal(rest.length, 8); assert.ok(rest.every(call => !call.url.includes('/repo-0/') && call.url.includes('per_page=100')));
  assert.equal(calls.filter(call => call.url.endsWith('/graphql')).length, 1);
  const variables = JSON.parse(calls.find(call => call.url.endsWith('/graphql')).options.body).variables; assert.equal(variables.from, `${year}-01-01T00:00:00Z`); assert.equal(variables.to, `${year}-12-31T23:59:59Z`);
  assert.equal(installationCalls, 1);
});
test('installation token is reused, never sent to the browser', async () => { calls = []; upstream(); const result = await request('/api/wrapped?user=octocat'); assert.equal(result.status, 200); assert.equal(installationCalls, 1); });
test('GraphQL missing users and rate limits map to 404 and 429', async () => {
  upstream({ errors: [{ type: 'NOT_FOUND' }] }); assert.equal((await request('/api/wrapped?user=missing')).status, 404);
  upstream({ user: null }); assert.equal((await request('/api/wrapped?user=missing')).body.error, 'Usuario no encontrado');
  upstream({ errors: [{ type: 'RATE_LIMITED' }] }); const result = await request('/api/wrapped?user=octocat'); assert.equal(result.status, 429); assert.equal(result.headers['Cache-Control'], 'no-store');
});
test('years before account creation are rejected before REST calls', async () => { calls = []; upstream(); const result = await request('/api/wrapped?user=octocat&year=2009'); assert.equal(result.status, 400); assert.equal(calls.length, 1); });
test('REST rate limits are surfaced and unavailable samples are marked partial', async () => {
  upstream({ restStatus: 403, restHeaders: { 'x-ratelimit-remaining': '0' } }); assert.equal((await request('/api/wrapped?user=octocat')).status, 429);
  upstream({ restStatus: 429 }); assert.equal((await request('/api/wrapped?user=octocat')).status, 429);
  upstream({ restStatus: 403, restHeaders: { 'retry-after': '60' } }); assert.equal((await request('/api/wrapped?user=octocat')).status, 429);
  upstream({ restStatus: 404 }); const result = await request('/api/wrapped?user=octocat'); assert.equal(result.status, 200); assert.equal(result.body.sample.partial, true); assert.deepEqual(result.body.commitWords, []);
});
test('empty years and unexpected failures remain valid JSON', async () => {
  const user = profile(); user.contributionsCollection.commitContributionsByRepository = []; user.contributionsCollection.contributionCalendar.weeks = [];
  upstream({ user }); const result = await request('/api/wrapped?user=octocat'); assert.equal(result.status, 200); assert.deepEqual(result.body.timeline, []); assert.deepEqual(result.body.repos, []);
  upstream({ user: { ...profile(), contributionsCollection: null } }); const error = await request('/api/wrapped?user=octocat'); assert.equal(error.status, 500); assert.ok(!error.body.error.includes('SECRET'));
});

test('upstream deadlines return 504 without exposing internals', async () => { globalThis.fetch = async () => { throw new DOMException('private upstream trace', 'TimeoutError'); }; const result = await request('/api/wrapped?user=octocat'); assert.equal(result.status, 504); assert.equal(result.headers['Cache-Control'], 'no-store'); assert.ok(!result.body.error.includes('private')); });

test('PEM parsing accepts PKCS1/PKCS8, multiline, quoted and escaped line endings', () => {
  for (const type of ['pkcs1', 'pkcs8']) {
    const pem = privateKey.export({ type, format: 'pem' });
    for (const value of [pem, pem.replace(/\n/g, '\\n'), '"' + pem.replace(/\n/g, '\\r\\n') + '"']) {
      const [header, payload, signature] = appJwt('123', value).split('.');
      assert.equal(createVerify('RSA-SHA256').update(`${header}.${payload}`).verify(publicKey, signature, 'base64url'), true);
    }
  }
  for (const key of ['SECRET invalid PEM', generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ type: 'pkcs8', format: 'pem' })]) {
    assert.throws(() => appJwt('123', key), error => error.status === 503 && error.code === 'INVALID_PRIVATE_KEY' && !error.message.includes('SECRET'));
  }
});
test('network and TLS failures produce actionable messages without leaking causes', async () => {
  for (const [cause, code] of [['ENOTFOUND', 'GITHUB_CONNECTION_ERROR'], ['SELF_SIGNED_CERT_IN_CHAIN', 'GITHUB_TLS_ERROR']]) {
    globalThis.fetch = async () => { throw new TypeError('SECRET fetch failed', { cause: { code: cause, message: 'SECRET proxy' } }); };
    const result = await request('/api/wrapped?user=octocat');
    assert.equal(result.status, 502); assert.equal(result.body.code, code); assert.equal(result.headers['Cache-Control'], 'no-store'); assert.ok(!JSON.stringify(result.body).includes('SECRET'));
  }
});
test('OAuth Client ID is rejected with configuration instructions', async () => {
  process.env.GITHUB_APP_ID = 'Iv1.client-id';
  const result = await request('/api/wrapped?user=octocat');
  assert.equal(result.status, 503); assert.equal(result.body.code, 'INVALID_APP_IDS'); configure();
});
