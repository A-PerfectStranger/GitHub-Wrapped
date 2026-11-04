import { createSign, createPrivateKey } from 'node:crypto';

const USER = /^[a-zA-Z0-9-]{1,39}$/;
const STOP = new Set('the and for with from this that into add added update updated fix fixed feat chore refactor docs test tests merge pull request branch commit initial remove removed changes change use using de del la las los el en con por para una uno que un se al es y a o to of in on is it as at be by or an new'.split(' '));
let installation;
class ApiError extends Error { constructor(status, message, code) { super(message); this.status = status; this.code = code; } }
const fields = 'name nameWithOwner isPrivate stargazerCount forkCount pushedAt createdAt primaryLanguage { name color } languages(first:20, orderBy:{field:SIZE,direction:DESC}) { edges { size node { name color } } }';
const query = `query Wrapped($login:String!,$from:DateTime!,$to:DateTime!){user(login:$login){login name avatarUrl createdAt contributionsCollection(from:$from,to:$to){totalCommitContributions totalPullRequestContributions totalIssueContributions totalPullRequestReviewContributions totalRepositoryContributions contributionCalendar{weeks{contributionDays{date contributionCount}}} commitContributionsByRepository(maxRepositories:100){repository{${fields}} contributions{totalCount}} repositoryContributions(first:100){nodes{occurredAt repository{isPrivate name}}} pullRequestContributions(first:1,orderBy:{direction:ASC}){nodes{occurredAt pullRequest{repository{isPrivate} title}}}}}}`;

async function github(path, token, options = {}) {
  let response;
  try {
    response = await fetch(`https://api.github.com${path}`, { ...options, signal: options.signal || AbortSignal.timeout(6000), headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'GitHub-Wrapped', Authorization: `Bearer ${token}`, ...options.headers } });
  } catch (error) {
    if (error.name === 'TimeoutError' || options.signal?.aborted) throw new ApiError(504, 'GitHub tardó demasiado en responder. Vuelve a intentarlo.', 'GITHUB_TIMEOUT');
    const cause = error.cause?.code;
    const tls = ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'CERT_HAS_EXPIRED'].includes(cause);
    throw new ApiError(502, tls ? 'Node no pudo verificar el certificado HTTPS de GitHub. Revisa los certificados de tu equipo o proxy.' : 'El servidor no pudo conectar con api.github.com. Revisa tu conexión, DNS, proxy o firewall.', tls ? 'GITHUB_TLS_ERROR' : 'GITHUB_CONNECTION_ERROR');
  }
  if (response.status === 429 || (response.status === 403 && (response.headers.get('x-ratelimit-remaining') === '0' || response.headers.has('retry-after')))) throw new ApiError(429, 'GitHub alcanzó su límite de consultas. Inténtalo de nuevo más tarde.');
  if (response.status === 404) throw new ApiError(path.startsWith('/app/') ? 503 : 404, path.startsWith('/app/') ? 'No encontramos la instalación de la GitHub App. Revisa su configuración.' : 'Usuario no encontrado');
  if (!response.ok) throw new ApiError(502, 'No pudimos consultar GitHub. Revisa la instalación y los permisos de la GitHub App.');
  return response.json();
}
export function appJwt(id, key) {
  let privateKey;
  try {
    const pem = key.trim().replace(/^(['"])([\s\S]*)\1$/, '$2').replace(/\\r\\n|\\n/g, '\n');
    privateKey = createPrivateKey(pem);
    if (privateKey.asymmetricKeyType !== 'rsa') throw new Error('RSA required');
  } catch {
    throw new ApiError(503, 'GITHUB_APP_PRIVATE_KEY no es una clave privada RSA PEM válida. Copia el archivo .pem completo, con BEGIN y END, y reinicia el servidor.', 'INVALID_PRIVATE_KEY');
  }
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iat: now - 60, exp: now + 540, iss: id })}`;
  const signature = createSign('RSA-SHA256').update(body).sign(privateKey, 'base64url');
  return `${body}.${signature}`;
}
async function token(signal) {
  const { GITHUB_APP_ID: id, GITHUB_APP_PRIVATE_KEY: key, GITHUB_APP_INSTALLATION_ID: install } = process.env;
  if (!id || !key || !install) throw new ApiError(503, 'Falta configurar la GitHub App. Puedes explorar la demo mientras tanto.');
  if (!/^\d+$/.test(id) || !/^\d+$/.test(install)) throw new ApiError(503, 'GITHUB_APP_ID y GITHUB_APP_INSTALLATION_ID deben ser IDs numéricos. Usa App ID, no Client ID.', 'INVALID_APP_IDS');
  if (installation?.expires > Date.now() + 60000) return installation.value;
  const jwt = appJwt(id, key);
  const result = await github(`/app/installations/${encodeURIComponent(install)}/access_tokens`, jwt, { method: 'POST', signal });
  installation = { value: result.token, expires: Date.parse(result.expires_at) };
  return result.token;
}
export function wordsFrom(messages) {
  const counts = new Map();
  for (const message of messages) {
    const line = message.split('\n')[0].toLowerCase().replace(/https?:\/\/\S+|\b[0-9a-f]{7,}\b/gi, ' ').replace(/^\w+(\([^)]*\))?!?:\s*/, ' ');
    for (const word of line.match(/[\p{L}]+/gu) || []) if (word.length >= 3 && !STOP.has(word)) counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts].map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count || a.word.localeCompare(b.word)).slice(0, 60);
}
export function longestStreak(calendar) {
  let length = 0, best = { count: 0, date: '' }, previous;
  for (const day of calendar) {
    length = day.count > 0 ? (previous && Date.parse(day.date) - Date.parse(previous) === 86400000 ? length : 0) + 1 : 0;
    if (length > best.count) best = { count: length, date: day.date };
    previous = day.date;
  }
  return best;
}
export function personality(hours, weekends, sampled, languages, calendar) {
  const fraction = hours.reduce((sum, value, hour) => sum + ((hour >= 22 || hour <= 4) ? value : 0), 0) / sampled;
  const early = hours.slice(5, 10).reduce((a, b) => a + b, 0) / sampled;
  const bytes = languages.reduce((sum, item) => sum + item.bytes, 0);
  const count = languages.filter(item => item.bytes / bytes > .05).length;
  const streak = longestStreak(calendar).count;
  if (fraction > .4) return { title: 'Búho nocturno', reason: `${Math.round(fraction * 100)}% de la muestra entre las 22:00 y las 04:59 UTC.` };
  if (early > .4) return { title: 'Madrugador', reason: `${Math.round(early * 100)}% de la muestra entre las 05:00 y las 09:59 UTC.` };
  if (weekends / sampled > .45) return { title: 'Maratonista de fines de semana', reason: `${Math.round(weekends / sampled * 100)}% de la muestra en sábado o domingo (UTC).` };
  if (count >= 5) return { title: 'Políglota', reason: `${count} lenguajes superan el 5% de los bytes analizados.` };
  if (streak >= 30) return { title: 'Imparable', reason: `${streak} días seguidos con contribuciones.` };
  return { title: 'Constructor', reason: 'Cada contribución es otra pieza de algo que antes no existía.' };
}
function milestones(calendar, repos, collection) {
  const active = calendar.filter(day => day.count);
  if (!active.length) return [];
  const first = active[0], peak = active.reduce((a, b) => b.count > a.count ? b : a), streak = longestStreak(calendar);
  const months = new Map();
  for (const day of active) { const month = day.date.slice(0, 7); months.set(month, (months.get(month) || 0) + day.count); }
  const best = [...months].sort((a, b) => b[1] - a[1])[0];
  const items = [
    { date: first.date, type: 'start', title: 'El primer paso', detail: 'Tu primer día con contribuciones del año.' },
    { date: peak.date, type: 'peak', title: 'Un día fuera de serie', detail: `${peak.count} contribuciones en un solo día.` },
    { date: `${best[0]}-01`, type: 'month', title: 'Tu mejor mes', detail: `${best[1]} contribuciones. El ritmo era otro.` },
    { date: streak.date, type: 'streak', title: 'Sin soltar el teclado', detail: `${streak.count} días seguidos con contribuciones.` }
  ];
  if (repos.length) items.push({ date: active.at(-1).date, type: 'repo', title: 'Tu centro de gravedad', detail: `${repos[0].name} · ${repos[0].commits} commits en el año.` });
  const pr = collection?.pullRequestContributions?.nodes?.[0];
  if (pr && !pr.pullRequest.repository.isPrivate) items.push({ date: pr.occurredAt.slice(0, 10), type: 'pr', title: 'Tu primer pull request', detail: pr.pullRequest.title });
  const created = collection?.repositoryContributions?.nodes?.filter(item => !item.repository.isPrivate).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
  if (created) items.push({ date: created.occurredAt.slice(0, 10), type: 'new', title: 'Una nueva idea', detail: `Creaste ${created.repository.name}.` });
  return items.sort((a, b) => a.date.localeCompare(b.date));
}
async function collect(user, year) {
  const signal = AbortSignal.timeout(7500), auth = await token(signal), from = `${year}-01-01T00:00:00Z`, to = `${year}-12-31T23:59:59Z`;
  const result = await github('/graphql', auth, { method: 'POST', signal, body: JSON.stringify({ query, variables: { login: user, from, to } }), headers: { 'Content-Type': 'application/json' } });
  if (result.errors?.length) {
    if (result.errors.some(error => error.type === 'NOT_FOUND')) throw new ApiError(404, 'Usuario no encontrado');
    if (result.errors.some(error => error.type === 'RATE_LIMITED')) throw new ApiError(429, 'GitHub alcanzó su límite de consultas. Inténtalo más tarde.');
    throw new ApiError(502, 'GitHub no pudo completar el resumen. Inténtalo de nuevo más tarde.');
  }
  const profile = result.data?.user;
  if (!profile) throw new ApiError(404, 'Usuario no encontrado');
  if (year < Number(profile.createdAt.slice(0, 4))) throw new ApiError(400, 'El año es anterior a la creación de esta cuenta.');
  const c = profile.contributionsCollection;
  const calendar = c.contributionCalendar.weeks.flatMap(week => week.contributionDays).filter(day => day.date.startsWith(`${year}-`)).map(day => ({ date: day.date, count: day.contributionCount }));
  const allRepos = c.commitContributionsByRepository.filter(item => !item.repository.isPrivate).sort((a, b) => b.contributions.totalCount - a.contributions.totalCount);
  const languageMap = new Map();
  for (const { repository } of allRepos.slice(0, 8)) for (const { size, node } of repository.languages.edges) {
    const item = languageMap.get(node.name) || { name: node.name, color: node.color || '#b9ff66', bytes: 0 };
    item.bytes += size; languageMap.set(node.name, item);
  }
  const languages = [...languageMap.values()].sort((a, b) => b.bytes - a.bytes);
  const repos = allRepos.slice(0, 60).map(({ repository: r, contributions }) => ({ name: r.nameWithOwner, stars: r.stargazerCount, forks: r.forkCount, commits: contributions.totalCount, language: r.primaryLanguage?.name || 'Sin lenguaje', color: r.primaryLanguage?.color || '#b9ff66', lastPushed: r.pushedAt }));
  let partial = false;
  const batches = await Promise.all(allRepos.slice(0, 8).map(async ({ repository }) => {
    try { return await github(`/repos/${repository.nameWithOwner.split('/').map(encodeURIComponent).join('/')}/commits?${new URLSearchParams({ author: user, since: from, until: to, per_page: '100' })}`, auth, { signal }); }
    catch (error) { if (error.status === 429) throw error; partial = true; return []; }
  }));
  const seen = new Set(), commits = batches.flat().filter(commit => { if (seen.has(commit.sha)) return false; seen.add(commit.sha); return true; });
  const hourHistogram = Array(24).fill(0); let weekends = 0, sampled = 0;
  for (const item of commits) {
    const date = new Date(item.commit.author?.date);
    if (Number.isNaN(date.getTime())) continue;
    hourHistogram[date.getUTCHours()]++; sampled++;
    if ([0, 6].includes(date.getUTCDay())) weekends++;
  }
  return { user: { login: profile.login, name: profile.name, avatarUrl: profile.avatarUrl, createdAt: profile.createdAt }, year,
    totals: { commits: c.totalCommitContributions, pullRequests: c.totalPullRequestContributions, issues: c.totalIssueContributions, reviews: c.totalPullRequestReviewContributions, newRepos: c.totalRepositoryContributions },
    calendar, languages, repos, commitWords: wordsFrom(commits.map(item => item.commit.message)), hourHistogram,
    timeline: milestones(calendar, repos, c), persona: personality(hourHistogram, weekends, sampled, languages, calendar), sample: { commits: commits.length, partial, timezone: 'UTC' } };
}
export function mockData(user, year) {
  const end = year === new Date().getUTCFullYear() ? new Date().toISOString().slice(0, 10) : `${year}-12-31`;
  const calendar = []; let day = new Date(`${year}-01-01T00:00:00Z`), i = 0;
  while (day.toISOString().slice(0, 10) <= end) { calendar.push({ date: day.toISOString().slice(0, 10), count: (++i % 11 === 0 ? 0 : (i * 7) % 13) }); day.setUTCDate(day.getUTCDate() + 1); }
  const languages = [{ name: 'JavaScript', color: '#f1e05a', bytes: 58000 }, { name: 'Python', color: '#3572A5', bytes: 26000 }, { name: 'CSS', color: '#563d7c', bytes: 16000 }];
  const repos = ['orbital', 'tiny-tools', 'after-hours', 'readme-garden', 'side-quest', 'dotfiles', 'weekend-lab', 'first-light'].map((name, index) => ({ name: `${user}/${name}`, stars: 136 - index * 17, forks: 21 - index * 3, commits: 310 - index * 36, language: languages[index % 3].name, color: languages[index % 3].color, lastPushed: new Date(Math.max(Date.UTC(year, 0, 1), Date.parse(end) - index * 14 * 86400000)).toISOString() }));
  const hourHistogram = Array.from({ length: 24 }, (_, hour) => hour >= 22 || hour <= 4 ? 20 : 5);
  return { user: { login: user, name: 'Explorador del código', avatarUrl: '', createdAt: '2008-01-01T00:00:00Z' }, year, totals: { commits: 1472, pullRequests: 86, issues: 34, reviews: 57, newRepos: 8 }, calendar, languages, repos,
    commitWords: ['orbit', 'design', 'release', 'components', 'accessibility', 'explore', 'performance', 'galaxy', 'styles', 'keyboard', 'deploy', 'readme', 'responsive', 'colors', 'cache', 'public', 'search', 'motion'].map((word, index) => ({ word, count: 60 - index * 3 })),
    hourHistogram, timeline: milestones(calendar, repos), persona: personality(hourHistogram, 40, 225, languages, calendar), sample: { commits: 225, partial: false, timezone: 'UTC' } };
}
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); throw new ApiError(405, 'Usa GET para consultar un resumen.'); }
    const params = new URL(req.url, 'http://localhost').searchParams;
    const user = params.get('user') || '', raw = params.get('year') ?? String(new Date().getUTCFullYear()), year = Number(raw);
    if (!USER.test(user)) throw new ApiError(400, 'Introduce un usuario de GitHub válido (1–39 letras, números o guiones).');
    if (!/^\d{4}$/.test(raw) || year < 2008 || year > new Date().getUTCFullYear()) throw new ApiError(400, 'Elige un año válido entre 2008 y el actual.');
    const data = params.get('mock') === '1' ? mockData(user, year) : await collect(user, year);
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.statusCode = 200; res.end(JSON.stringify(data));
  } catch (error) {
    res.statusCode = error.status || (error.name === 'TimeoutError' ? 504 : 500);
    if (res.statusCode === 429) res.setHeader('Retry-After', '60');
    res.end(JSON.stringify({ error: error.status ? error.message : 'No pudimos completar el resumen. Inténtalo de nuevo en unos segundos.', ...(error.code && { code: error.code }) }));
  }
}
