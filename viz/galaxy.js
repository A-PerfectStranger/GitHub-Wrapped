export function renderGalaxy(container, repos, year) {
  container.replaceChildren();
  if (!repos.length) { const p = document.createElement('p'); p.className = 'empty'; p.textContent = 'Aún no hay planetas en este año. Tus próximos commits les darán forma.'; container.append(p); return () => {}; }
  const ns = 'http://www.w3.org/2000/svg', canvasMode = repos.length > 40;
  const surface = canvasMode ? document.createElement('canvas') : document.createElementNS(ns, 'svg');
  surface.setAttribute('role', 'img'); surface.setAttribute('aria-label', 'Galaxia de repositorios. Consulta los detalles en la lista accesible debajo.');
  const output = document.createElement('output'); output.setAttribute('aria-live', 'polite'); output.textContent = 'Pasa por un planeta o elige un repositorio para descubrirlo.';
  const details = document.createElement('details'), summary = document.createElement('summary'), list = document.createElement('div'); summary.textContent = `Explorar los ${repos.length} repositorios`; list.className = 'repo-list'; details.append(summary, list);
  const describe = repo => { output.textContent = `${repo.name} · ${repo.commits} commits · ★ ${repo.stars} · ${repo.forks} forks · ${repo.language}`; };
  for (const repo of repos) { const button = document.createElement('button'); button.textContent = repo.name; button.addEventListener('focus', () => describe(repo)); button.addEventListener('click', () => describe(repo)); list.append(button); }
  container.append(surface, output, details);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)'), max = Math.max(1, ...repos.map(repo => repo.commits));
  const pushes = repos.map(repo => Date.parse(repo.lastPushed) || Date.UTC(year, 0, 1)), newest = Math.max(...pushes), oldest = Math.min(...pushes);
  let width = 0, height = 0, nodes = [], frame, visible = false, phase = 0, previous;
  function point(node) { return { x: width / 2 + Math.cos(node.angle + phase * node.speed) * node.orbit, y: height / 2 + Math.sin(node.angle + phase * node.speed) * node.orbit * .58 }; }
  function setup() {
    width = surface.clientWidth; height = surface.clientHeight;
    const reach = Math.min(width * .43, height * .69), base = Math.min(50, reach * .4);
    nodes = repos.map((repo, i) => ({ repo, radius: 4 + 14 * Math.sqrt(repo.commits / max), orbit: base + (reach - base) * (newest === oldest ? .5 : (newest - pushes[i]) / (newest - oldest)), angle: i * 2.39996, speed: .08 + .1 * (1 - i / repos.length) }));
    if (canvasMode) { const ratio = Math.min(devicePixelRatio || 1, 2); surface.width = width * ratio; surface.height = height * ratio; surface.getContext('2d').setTransform(ratio, 0, 0, ratio, 0, 0); }
    else {
      surface.replaceChildren(); surface.setAttribute('viewBox', `0 0 ${width} ${height}`);
      const create = (tag, attributes) => { const node = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value); surface.append(node); return node; };
      [base, reach * .55, reach].forEach(radius => create('ellipse', { cx: width / 2, cy: height / 2, rx: radius, ry: radius * .58, fill: 'none', stroke: '#2a3039' }));
      create('circle', { cx: width / 2, cy: height / 2, r: 9, fill: '#c1ff72' });
      if (window.d3) window.d3.select(surface).selectAll('.planet').data(nodes).join('circle').attr('class', 'planet').attr('r', node => node.radius).attr('fill', node => node.repo.color || '#c1ff72').attr('stroke', '#ffffff30').each(function(node) { node.element = this; }).on('pointerenter', (_, node) => describe(node.repo)).on('click', (_, node) => describe(node.repo));
      else nodes.forEach(node => { node.element = create('circle', { r: node.radius, fill: node.repo.color || '#c1ff72' }); node.element.addEventListener('pointerenter', () => describe(node.repo)); node.element.addEventListener('click', () => describe(node.repo)); });
    }
    draw();
  }
  function draw() {
    const ctx = canvasMode ? surface.getContext('2d') : null;
    if (ctx) { ctx.clearRect(0, 0, width, height); ctx.strokeStyle = '#2a3039'; for (const radius of [35, Math.min(width * .23, height * .38), Math.min(width * .43, height * .69)]) { ctx.beginPath(); ctx.ellipse(width / 2, height / 2, radius, radius * .58, 0, 0, Math.PI * 2); ctx.stroke(); } ctx.fillStyle = '#c1ff72'; ctx.beginPath(); ctx.arc(width / 2, height / 2, 9, 0, Math.PI * 2); ctx.fill(); }
    for (const node of nodes) { const p = point(node); if (ctx) { ctx.beginPath(); ctx.arc(p.x, p.y, node.radius, 0, Math.PI * 2); ctx.fillStyle = node.repo.color || '#c1ff72'; ctx.fill(); } else { node.element.setAttribute('cx', p.x); node.element.setAttribute('cy', p.y); } }
  }
  function animate(now) { phase += previous ? Math.min((now - previous) / 1000, .1) : 0; previous = now; draw(); frame = requestAnimationFrame(animate); }
  function motion() { cancelAnimationFrame(frame); previous = undefined; if (visible && !reduced.matches) frame = requestAnimationFrame(animate); else draw(); }
  if (canvasMode) surface.addEventListener('pointermove', event => { const rect = surface.getBoundingClientRect(); const node = nodes.find(node => { const p = point(node); return Math.hypot(event.clientX - rect.left - p.x, event.clientY - rect.top - p.y) < node.radius + 6; }); if (node) describe(node.repo); });
  const resize = new ResizeObserver(setup); resize.observe(surface);
  const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; motion(); }); observer.observe(surface); reduced.addEventListener('change', motion);
  return () => { cancelAnimationFrame(frame); resize.disconnect(); observer.disconnect(); reduced.removeEventListener('change', motion); };
}
