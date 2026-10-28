// Shared SVG interaction: choose by horizontal position, never by distance to a line.
export function nearestPoint(points, x) {
  if (!points.length) return null;
  return points.reduce((best, point) => Math.abs(point.x - x) < Math.abs(best.x - x) ? point : best);
}

export function dateTickRows(rows, count = 5) {
  if (rows.length <= count) return rows;
  return Array.from({ length: count }, (_, i) => rows[Math.round(i * (rows.length - 1) / (count - 1))]);
}

export function attachChartHover(svg, points, { top = 20, bottom = 210 } = {}) {
  if (!svg || !points.length) return;
  const host = svg.parentElement;
  host.style.position = 'relative';
  const tooltip = document.createElement('div');
  tooltip.className = 'time-chart-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  Object.assign(tooltip.style, {
    position: 'absolute', width: 'max-content', zIndex: '5', pointerEvents: 'none', whiteSpace: 'pre-line',
    background: '#101e19', color: '#eef8f2', border: '1px solid #537463', borderRadius: '8px',
    padding: '8px 10px', font: '12px/1.5 system-ui, sans-serif', boxSizing: 'border-box',
    boxShadow: '0 3px 12px #0005', overflowWrap: 'anywhere',
  });
  host.append(tooltip);
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  for (const [key, value] of Object.entries({ y1: top, y2: bottom, stroke: '#a8cbbb', 'stroke-width': 1, 'stroke-dasharray': '4 4', 'pointer-events': 'none', visibility: 'hidden' })) line.setAttribute(key, value);
  svg.append(line);
  svg.setAttribute('tabindex', '0');
  const originalLabel = svg.getAttribute('aria-label') || '';
  let selected = null;
  const hide = () => { tooltip.hidden = true; line.setAttribute('visibility', 'hidden'); svg.setAttribute('aria-label', originalLabel); };
  const show = point => {
    selected = point;
    tooltip.textContent = point.text;
    tooltip.hidden = false;
    line.setAttribute('x1', point.x); line.setAttribute('x2', point.x); line.setAttribute('visibility', 'visible');
    svg.setAttribute('aria-label', `${originalLabel}. ${point.text}`);
    // Anchor within the visible scroll viewport, not the full offscreen SVG.
    tooltip.style.maxWidth = `${Math.max(1, host.clientWidth - 16)}px`;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const pixel = new DOMPoint(point.x, top).matrixTransform(matrix);
    const rect = host.getBoundingClientRect();
    const left = Math.max(8, Math.min(host.clientWidth - tooltip.offsetWidth - 8, pixel.x - rect.left + 12));
    tooltip.style.left = `${host.scrollLeft + left}px`;
    tooltip.style.top = `${host.scrollTop + 8}px`;
  };
  const move = event => {
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    show(nearestPoint(points, point.x));
  };
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerdown', move);
  svg.addEventListener('pointerleave', hide);
  svg.addEventListener('pointercancel', hide);
  svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', event => {
    if (event.key === 'Escape') return hide();
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = points.indexOf(selected);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1 : Math.max(0, Math.min(points.length - 1, (index < 0 ? 0 : index) + (event.key === 'ArrowRight' ? 1 : -1)));
    show(points[next]);
  });
  host.addEventListener('scroll', hide, { passive: true });
}
