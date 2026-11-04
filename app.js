import { renderTimeline } from './viz/timeline.js';
import { renderWords } from './viz/wordcloud.js';
import { renderGalaxy } from './viz/galaxy.js';
const $ = selector => document.querySelector(selector);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const format = new Intl.NumberFormat('es');
const currentYear = new Date().getUTCFullYear();
const params = new URLSearchParams(location.search);
let controller, cleanups = [], activeSlide = 0;
for (let year = currentYear; year >= 2008; year--) $('#year').add(new Option(year, year));
if ([...$('#year').options].some(item => item.value === params.get('year'))) $('#year').value = params.get('year');
$('#year-art').textContent = $('#year').value;
$('#year').addEventListener('change', () => { $('#year-art').textContent = $('#year').value; });
$('#username').value = params.get('user') || (params.get('mock') === '1' ? 'octocat' : '');
function element(tag, text, className) { const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node; }
function counter(node, value) {
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    const start = performance.now(); let frame;
    function tick(now) { const progress = reduced.matches ? 1 : Math.min((now - start) / 850, 1); node.textContent = format.format(Math.round(value * (1 - (1 - progress) ** 3))); if (progress < 1) frame = requestAnimationFrame(tick); }
    frame = requestAnimationFrame(tick); cleanups.push(() => cancelAnimationFrame(frame));
  });
  observer.observe(node); cleanups.push(() => observer.disconnect());
}
function render(data, mock) {
  cleanups.forEach(cleanup => cleanup()); cleanups = [];
  $('#summary').hidden = $('#chapters').hidden = $('#slide-nav').hidden = $('#scroll-hint').hidden = false;
  $('#initial-note').hidden = true; document.body.classList.add('has-data');
  $('#demo-badge').hidden = !mock;
  $('#year-art').textContent = data.year;
  $('#account').textContent = `${data.user.name || data.user.login} / @${data.user.login}`;
  $('#data-label').textContent = `${data.year} · ${mock ? 'Un universo de ejemplo' : 'Tu actividad en GitHub'}`;
  $('#avatar').replaceChildren(element('span', '↗'));
  if (data.user.avatarUrl) { const url = new URL(data.user.avatarUrl); if (url.protocol === 'https:' && url.hostname === 'avatars.githubusercontent.com') { const img = document.createElement('img'); img.src = url.href; img.alt = ''; img.referrerPolicy = 'no-referrer'; $('#avatar').replaceChildren(img); } }
  $('#metrics').replaceChildren();
  for (const [key, label] of Object.entries({ commits: 'Commits', pullRequests: 'Pull requests', issues: 'Issues', reviews: 'Reviews', newRepos: 'Repos nuevos' })) {
    const metric = element('div', '', 'metric'), value = element('strong', '0'); metric.append(value, element('span', label)); $('#metrics').append(metric); counter(value, data.totals[key]);
  }
  $('#persona').textContent = data.persona.title; $('#reason').textContent = data.persona.reason;
  $('#top-language').textContent = data.languages[0]?.name || 'Aún por descubrir';
  $('#top-language').style.color = data.languages[0]?.color || 'var(--lime)';
  $('#language-note').textContent = data.languages.length ? 'Por bytes en tus repos más activos' : 'Sin lenguajes públicos este año';
  renderTimeline($('#timeline'), data.timeline);
  cleanups.push(renderWords($('#wordcloud'), data.commitWords));
  cleanups.push(renderGalaxy($('#galaxy'), data.repos, data.year));
  $('#sample-note').textContent = `${mock ? 'Demo · ' : ''}Muestra de ${format.format(data.sample.commits)} commits únicos: hasta 100 por repo, en los 8 más activos. Horarios UTC.${data.sample.partial ? ' Algunos repos no estuvieron disponibles; la muestra está incompleta.' : ''}`;
  document.querySelectorAll('.slide').forEach(slide => observer.observe(slide));
  $('#summary').scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'center' });
}
async function load(mock) {
  controller?.abort(); controller = new AbortController();
  const request = controller;
  $('#submit').disabled = $('#demo').disabled = true; $('#summary').setAttribute('aria-busy', 'true');
  $('#status').className = 'loading'; $('#status').textContent = mock ? 'Encendiendo el universo de ejemplo…' : 'Conectando los puntos de tu año…';
  const user = $('#username').value.trim() || (mock ? 'octocat' : '');
  const search = new URLSearchParams({ user, year: $('#year').value }); if (mock) search.set('mock', '1');
  const timeout = setTimeout(() => request.abort(), 22000);
  try {
    const response = await fetch(`/api/wrapped?${search}`, { signal: request.signal });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'No pudimos cargar tu resumen.');
    if (controller !== request) return;
    render(data, mock); $('#username').value = user; history.replaceState(null, '', `?${search}`);
    $('#status').textContent = mock ? 'Estás explorando datos ficticios. Escribe un usuario y pulsa «Mi Wrapped» para consultar GitHub.' : 'Tu universo está listo. Baja para explorarlo.';
  } catch (error) {
    if (controller !== request) return;
    $('#status').textContent = error.name === 'AbortError' ? 'GitHub está tardando más de lo esperado. Vuelve a intentarlo.' : error.message;
  } finally {
    clearTimeout(timeout);
    if (controller === request) { $('#status').className = ''; $('#submit').disabled = $('#demo').disabled = false; $('#summary').setAttribute('aria-busy', 'false'); }
  }
}
const slides = [...document.querySelectorAll('.slide')];
const observer = new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) {
    activeSlide = slides.indexOf(entry.target); entry.target.classList.add('reveal');
    document.querySelectorAll('#slide-nav a').forEach((link, index) => { if (index === activeSlide) link.setAttribute('aria-current', 'step'); else link.removeAttribute('aria-current'); });
  }
}, { rootMargin: '-15% 0px -35% 0px', threshold: 0 });
document.addEventListener('keydown', event => {
  if ($('#chapters').hidden || event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input,select,textarea,button,[contenteditable]')) return;
  const direction = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
  if (!direction) return;
  event.preventDefault(); activeSlide = Math.max(0, Math.min(3, activeSlide + direction));
  slides[activeSlide].scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth' });
});
$('#search-form').addEventListener('submit', event => { event.preventDefault(); load(false); });
$('#demo').addEventListener('click', () => load(true));
if (params.has('user') || params.get('mock') === '1') load(params.get('mock') === '1');
