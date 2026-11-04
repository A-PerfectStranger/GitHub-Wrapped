const palette = ['#c1ff72', '#64e4ed', '#f294d3', '#d3c4f5', '#edf1e8'];
export function renderWords(container, words) {
  container.replaceChildren();
  if (!words.length) { const p = document.createElement('p'); p.className = 'empty'; p.textContent = 'No encontramos mensajes de commits públicos para esta muestra.'; container.append(p); return () => {}; }
  let layout, disposed = false;
  function fallback() {
    container.replaceChildren();
    for (const [index, word] of words.entries()) { const span = document.createElement('span'); span.className = 'word'; span.textContent = word.word; span.style.cssText = `font-size:${14 + 22 * word.count / words[0].count}px;color:${palette[index % palette.length]}`; span.title = `${word.count} apariciones`; container.append(span); }
    container.style.height = 'auto'; container.style.minHeight = '340px';
  }
  function draw() {
    layout?.stop(); container.style.height = ''; container.style.minHeight = '';
    if (!window.d3?.layout?.cloud) { fallback(); return; }
    const width = container.clientWidth, height = container.clientHeight;
    layout = window.d3.layout.cloud().size([width, height]).words(words.map(word => ({ text: word.word, count: word.count, size: 13 + (width < 500 ? 33 : 59) * Math.sqrt(word.count / words[0].count) }))).padding(5).rotate(() => 0).font('monospace').fontSize(word => word.size).random(() => .5).on('end', positioned => {
      if (disposed) return;
      container.replaceChildren();
      const svg = window.d3.select(container).append('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', words.map(word => `${word.word}: ${word.count}`).join(', '));
      svg.append('g').attr('transform', `translate(${width / 2},${height / 2})`).selectAll('text').data(positioned).join('text').attr('text-anchor', 'middle').attr('transform', word => `translate(${word.x},${word.y})`).attr('fill', (_, i) => palette[i % palette.length]).style('font-size', word => `${word.size}px`).attr('class', 'word').style('animation-delay', (_, i) => `${i * 20}ms`).text(word => word.text).append('title').text(word => `${word.count} apariciones`);
    }).start();
  }
  let width = 0, visible = false;
  const resize = new ResizeObserver(entries => { const next = Math.round(entries[0].contentRect.width); if (next && next !== width) { width = next; if (visible) draw(); } }); resize.observe(container);
  const appearance = new IntersectionObserver(entries => { if (entries[0].isIntersecting) { visible = true; draw(); appearance.disconnect(); } }); appearance.observe(container);
  return () => { disposed = true; resize.disconnect(); appearance.disconnect(); layout?.stop(); };
}
