const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent?.append(e); return e; };

// Gothic arches receding down the nave of the Grand Peace Palace.
export function buildNave(root, count = 9, gap = 520) {
  const arches = [];
  for (let i = 0; i < count; i++) {
    const wrap = document.createElement('div');
    wrap.className = 'arch';
    const svg = el('svg', { viewBox: '0 0 1000 1300' }, wrap);
    const defs = el('defs', {}, svg);
    const g = el('linearGradient', { id: `st${i}`, x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
    el('stop', { offset: '0', 'stop-color': '#2a2226' }, g);
    el('stop', { offset: '0.5', 'stop-color': '#5b4c48' }, g);
    el('stop', { offset: '1', 'stop-color': '#2a2226' }, g);
    // outer frame with a pointed-arch opening cut out (even-odd)
    const opening = 'M120,1300 L120,640 A780,780 0 0 1 500,40 A780,780 0 0 1 880,640 L880,1300 Z';
    el('path', { d: `M-2600,-1400 H3600 V1300 H-2600 Z ${opening}`, fill: `url(#st${i})`, 'fill-rule': 'evenodd' }, svg);
    // mouldings: nested arches
    for (const [inset, op] of [[0, 0.55], [26, 0.35], [52, 0.2]]) {
      el('path', { d: `M${120 - inset},1300 L${120 - inset},640 A${780 + inset},${780 + inset} 0 0 1 500,${40 - inset * 1.3} A${780 + inset},${780 + inset} 0 0 1 ${880 + inset},640 L${880 + inset},1300`, fill: 'none', stroke: '#d9b56a', 'stroke-opacity': op, 'stroke-width': 3 }, svg);
    }
    // columns with capitals
    for (const x of [60, 940]) {
      el('rect', { x: x - 46, y: 640, width: 92, height: 700, fill: '#3b3134' }, svg);
      el('rect', { x: x - 60, y: 615, width: 120, height: 30, fill: '#6b5a52' }, svg);
      for (let f = -30; f <= 30; f += 20) el('line', { x1: x + f, y1: 650, x2: x + f, y2: 1300, stroke: '#1b1518', 'stroke-width': 3 }, svg);
    }
    root.append(wrap);
    arches.push({ wrap, z: -i * gap });
  }
  return (progress) => {
    const travel = progress * gap * (count - 1.2);
    for (const a of arches) {
      const z = a.z + travel;
      const fog = Math.min(1, Math.max(0, 1 + z / (gap * 5)));
      a.wrap.style.transform = `translate3d(0,0,${z}px)`;
      a.wrap.style.opacity = z > 700 ? 0 : fog;
      a.wrap.style.filter = `brightness(${0.35 + 0.65 * fog})`;
    }
  };
}

// The neoclassical main hall silhouette with lit windows.
export function buildHall(svg) {
  const g = el('g', {}, svg);
  const stone = '#1a1016', edge = 'rgba(217,181,106,.35)';
  el('rect', { x: 0, y: 470, width: 1000, height: 60, fill: '#140b10' }, g);
  for (let s = 0; s < 6; s++) el('rect', { x: 170 - s * 14, y: 440 + s * 6, width: 660 + s * 28, height: 8, fill: stone, stroke: edge, 'stroke-width': 0.6 }, g);
  el('rect', { x: 200, y: 250, width: 600, height: 190, fill: stone }, g);
  // windows glowing warm behind the colonnade
  for (let i = 0; i < 9; i++) el('rect', { x: 226 + i * 62, y: 290, width: 26, height: 110, rx: 13, fill: '#d9a86a', opacity: 0.55 + (i % 3) * 0.12 }, g);
  // columns
  for (let i = 0; i < 10; i++) {
    const x = 214 + i * 63;
    el('rect', { x, y: 236, width: 22, height: 204, fill: '#24161c', stroke: edge, 'stroke-width': 0.6 }, g);
    el('rect', { x: x - 5, y: 228, width: 32, height: 10, fill: '#2d1c23' }, g);
  }
  // entablature + pediment with a relief roundel
  el('rect', { x: 190, y: 204, width: 620, height: 26, fill: '#24161c', stroke: edge, 'stroke-width': 0.8 }, g);
  el('path', { d: 'M180,206 L500,86 L820,206 Z', fill: '#24161c', stroke: '#d9b56a', 'stroke-opacity': 0.5, 'stroke-width': 1.2 }, g);
  el('path', { d: 'M222,196 L500,100 L778,196 Z', fill: 'none', stroke: 'rgba(217,181,106,.25)' }, g);
  el('circle', { cx: 500, cy: 158, r: 22, fill: 'none', stroke: '#d9b56a', 'stroke-opacity': 0.6 }, g);
  for (let k = -3; k <= 3; k++) if (k) el('path', { d: `M${500 + k * 44},${188 - Math.abs(k) * 3} q6,-22 12,0`, stroke: 'rgba(217,181,106,.35)', fill: 'none' }, g);
  // wings
  el('rect', { x: 20, y: 300, width: 170, height: 170, fill: '#170d13' }, g);
  el('rect', { x: 810, y: 300, width: 170, height: 170, fill: '#170d13' }, g);
  for (let i = 0; i < 4; i++) { el('rect', { x: 40 + i * 38, y: 330, width: 16, height: 60, fill: '#d9a86a', opacity: 0.35 }, g); el('rect', { x: 830 + i * 38, y: 330, width: 16, height: 60, fill: '#d9a86a', opacity: 0.35 }, g); }
  // spring trees framing the hall
  for (const [cx, cy, rr] of [[90, 280, 120], [930, 270, 130], [30, 360, 90], [985, 380, 80]]) {
    el('circle', { cx, cy, r: rr, fill: 'rgba(240,170,190,.35)' }, g);
    el('circle', { cx: cx + 20, cy: cy - 20, r: rr * 0.7, fill: 'rgba(255,205,220,.35)' }, g);
  }
}

// Falling cherry petals on a 2D canvas.
export class Petals {
  constructor(canvas, n) {
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.n = n;
    this.resize(); addEventListener('resize', () => this.resize());
    this.p = Array.from({ length: n }, () => this.spawn(true));
  }
  resize() { const d = Math.min(devicePixelRatio, 2); this.c.width = this.c.clientWidth * d; this.c.height = this.c.clientHeight * d; this.d = d; }
  spawn(any) {
    return { x: Math.random() * this.c.width, y: any ? Math.random() * this.c.height : -20, s: (5 + Math.random() * 9) * this.d, vy: (0.4 + Math.random() * 0.9) * this.d, ph: Math.random() * 6.28, spin: (Math.random() - 0.5) * 0.04, rot: Math.random() * 6.28, hue: Math.random() };
  }
  render(t) {
    const { ctx, c } = this;
    ctx.clearRect(0, 0, c.width, c.height);
    for (let i = 0; i < this.p.length; i++) {
      const q = this.p[i];
      q.y += q.vy; q.x += Math.sin(t * 0.8 + q.ph) * 0.6 * this.d + 0.3 * this.d; q.rot += q.spin;
      if (q.y > c.height + 20 || q.x > c.width + 20) this.p[i] = this.spawn(false);
      const flip = Math.abs(Math.sin(t * 1.5 + q.ph));
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.scale(1, 0.35 + 0.65 * flip);
      ctx.fillStyle = q.hue < 0.5 ? 'rgba(255,196,212,.9)' : 'rgba(255,226,234,.85)';
      ctx.beginPath(); ctx.moveTo(0, -q.s); ctx.bezierCurveTo(q.s * 0.9, -q.s * 0.6, q.s * 0.7, q.s * 0.8, 0, q.s);
      ctx.bezierCurveTo(-q.s * 0.7, q.s * 0.8, -q.s * 0.9, -q.s * 0.6, 0, -q.s); ctx.fill();
      ctx.restore();
    }
  }
}
