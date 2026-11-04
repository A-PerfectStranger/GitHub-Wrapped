export function renderTimeline(container, items) {
  container.replaceChildren();
  if (!items.length) { const p = document.createElement('p'); p.className = 'empty'; p.textContent = 'Tu historia está por escribirse. No hay contribuciones en este año.'; container.append(p); return; }
  const dateFormat = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', timeZone: 'UTC' });
  for (const item of items) {
    const card = document.createElement('article'); card.className = 'milestone';
    const time = document.createElement('time'); time.dateTime = item.date; time.textContent = dateFormat.format(new Date(`${item.date}T00:00:00Z`));
    const title = document.createElement('h3'); title.textContent = item.title;
    const detail = document.createElement('p'); detail.textContent = item.detail;
    card.append(time, title, detail); container.append(card);
  }
}
