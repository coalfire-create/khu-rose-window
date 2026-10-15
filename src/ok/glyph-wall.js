// Glyph Wall — after Originkit's glyph-wall (originkit.dev), ported to a
// plain module. A wall of carved stone columns whose glyphs ignite gold as
// the pointer passes and fade out along the path it took. Here the wall is
// carved with hanja from 경희's motto and spirit instead of hieroglyphs, and
// props.sweep (0..1) lets the page ignite the wall cell by cell with scroll.
//
// mountGlyphWall(root, props) → { props, destroy }.

const MAX_DPR = 2
const TRAIL_POINTS = 16
const ATLAS_COLS = 8
const ATLAS_ROWS = 4
const ATLAS_CELL = 128
const ATLAS_PAD = 12
const STROKE = 6

// 文化世界의 創造 · 慶熙 · 學問과 平和 · 人類愛 · 眞善美 · 木蓮의 봄.
export const HANJA = ['文', '化', '世', '界', '創', '造', '慶', '熙', '學', '問', '平', '和', '人', '類', '愛', '眞', '善', '美', '光', '道', '春', '木', '蓮', '心']

// Bands for the split (half-height) cells: plain carved mouldings.
const BANDS = [
  'M8 42 L16 34 L24 42 L32 34 L40 42 L48 34 L56 42 L64 34 L72 42 L80 34 L88 42 M8 62 L16 54 L24 62 L32 54 L40 62 L48 54 L56 62 L64 54 L72 62 L80 54 L88 62',
  'M10 38 H90 M10 50 H90 M10 62 H90',
  'M12 36 H88 V64 H12 Z',
  'M8 50 H92 M20 38 V62 M40 38 V62 M60 38 V62 M80 38 V62',
  'M10 38 H90 V62 H10 Z M22 50 H78',
  'M8 56 Q20 40 32 56 T56 56 T80 56 Q86 48 92 44',
  'M16 40 H84 M16 60 H84 M28 40 V60 M72 40 V60',
  'M14 50 A6 6 0 1 0 26 50 A6 6 0 1 0 14 50 M44 50 A6 6 0 1 0 56 50 A6 6 0 1 0 44 50 M74 50 A6 6 0 1 0 86 50 A6 6 0 1 0 74 50',
]

const VERT_SRC = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`

const FRAG_SRC = `
precision highp float;
uniform vec2  uRes;
uniform float uDpr;
uniform float uTime;
uniform float uSize;
uniform float uReach;
uniform float uHover;
uniform float uSweep;
uniform vec3  uBg;
uniform vec3  uGlyph;
uniform vec3  uAccent;
uniform vec3  uPts[${TRAIL_POINTS + 1}];
uniform sampler2D uAtlas;

float h11(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = h21(i);
    float b = h21(i + vec2(1.0, 0.0));
    float c = h21(i + vec2(0.0, 1.0));
    float d = h21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
    return s;
}
float fall(float x) { x = clamp(x, 0.0, 1.0); float k = 1.0 - x * x; return k * k; }
float lightAt(vec2 q, float r) {
    float m = 0.0;
    for (int i = 0; i < ${TRAIL_POINTS + 1}; i++) {
        vec3 P = uPts[i];
        if (P.z <= 0.0) continue;
        m = max(m, P.z * fall(length(q - P.xy) / r));
    }
    return m;
}
float atlas(vec2 uv, float bias) { return texture2D(uAtlas, uv, bias).r; }

void main() {
    vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
    float W = uSize;
    float cx = floor(p.x / W);
    float xin = p.x - cx * W;
    float oy = h11(cx + 3.7) * W;
    float yy = p.y + oy;
    float cy = floor(yy / W);
    vec2 local = vec2(xin / W, yy / W - cy);

    float split = step(0.7, h21(vec2(cx + 11.3, cy - 7.1)));
    float gid;
    float hc;
    vec2 auv;
    vec2 centre;
    float edgeY;
    if (split > 0.5) {
        float sub = floor(local.y * 2.0);
        float ly = fract(local.y * 2.0);
        hc = h21(vec2(cx * 1.7 + sub * 5.3, cy + sub * 3.1));
        gid = 24.0 + floor(hc * 8.0);
        auv = vec2(local.x, (${ATLAS_PAD}.0 + (30.0 + ly * 40.0) * 1.04) / ${ATLAS_CELL}.0);
        centre = vec2((cx + 0.5) * W, (cy + (sub + 0.5) * 0.5) * W - oy);
        edgeY = ly;
    } else {
        hc = h21(vec2(cx, cy));
        gid = floor(hc * 24.0);
        auv = local;
        centre = vec2((cx + 0.5) * W, (cy + 0.5) * W - oy);
        edgeY = local.y;
    }
    float empty = step(h21(vec2(cx - 5.3, cy + 2.9)), 0.05);
    float mask = step(0.03, local.x) * step(local.x, 0.97) * step(0.03, edgeY) * step(edgeY, 0.97) * (1.0 - empty);
    vec2 cell = vec2(mod(gid, ${ATLAS_COLS}.0), floor(gid / ${ATLAS_COLS}.0));
    vec2 uv = (cell + auv) / vec2(${ATLAS_COLS}.0, ${ATLAS_ROWS}.0);

    float c = atlas(uv, 0.0) * mask;
    float soft = atlas(uv, 1.5) * mask;
    float glow = atlas(uv, 3.0) * mask;
    vec2 ex = vec2(3.0 / ${ATLAS_COLS * ATLAS_CELL}.0, 0.0);
    vec2 ey = vec2(0.0, 3.0 / ${ATLAS_ROWS * ATLAS_CELL}.0);
    float gx = (atlas(uv + ex, 1.0) - atlas(uv - ex, 1.0)) * mask;
    float gy = (atlas(uv + ey, 1.0) - atlas(uv - ey, 1.0)) * mask;

    float n = fbm(p / 38.0);
    float colTone = 0.86 + 0.26 * h11(cx + 1.3);
    vec3 stone = uBg * colTone * (0.72 + 0.56 * n);
    stone *= 0.93 + 0.07 * vnoise(vec2(xin / 5.0 + cx * 7.0, p.y / 160.0));
    stone *= 0.95 + 0.05 * h21(floor(p));
    float gd = min(xin, W - xin);
    stone *= mix(0.3, 1.0, smoothstep(0.6, 2.6, gd));
    stone *= 1.0 + 0.35 * smoothstep(2.4, 3.2, xin) * (1.0 - smoothstep(3.2, 5.5, xin));

    float spot = lightAt(p, uReach * 1.25) * uHover;
    float cellL = lightAt(centre, uReach) * uHover;
    float jitter = (h21(centre * 0.013 + 4.1) - 0.5) * 0.35;
    float lit = smoothstep(0.3, 0.7, cellL + jitter);

    // The page's sweep: cells ignite one by one, rising from the bottom.
    float order = clamp(1.0 - centre.y / max(uRes.y / uDpr, 1.0), 0.0, 1.0) * 0.7 + h21(centre * 0.031 + 2.2) * 0.3;
    lit = max(lit, smoothstep(order - 0.04, order + 0.04, uSweep) * 0.9);

    float th = h21(centre * 0.021 + 9.7);
    float tw = step(0.95, th) * pow(max(0.0, sin(uTime * (0.35 + 0.7 * fract(th * 13.0)) + th * 40.0)), 6.0);
    lit = max(lit, tw * 0.8);

    vec2 dl = (uPts[0].z > 0.0 ? uPts[0].xy : p + vec2(-240.0, -320.0)) - p;
    vec2 ld = dl / max(length(dl), 1.0);
    float edge = clamp((gx * ld.x + gy * ld.y) * 2.0, -1.0, 1.0);

    vec3 col = stone * (1.0 + 1.1 * spot) + uAccent * stone * spot * 0.6;
    col *= 1.0 - 0.55 * c;
    col -= col * 0.45 * max(-edge, 0.0);
    col += uGlyph * (0.08 * c + 0.22 * max(edge, 0.0) * (0.3 + spot));
    vec3 gold = uAccent * (1.05 * c + 0.55 * glow + 0.25 * soft) + vec3(1.0, 0.95, 0.85) * 0.12 * c * c;
    col += gold * lit;
    gl_FragColor = vec4(col, 1.0);
}
`

function parseColor(input, fb) {
  if (!input) return fb
  const str = String(input).trim()
  if (str[0] === '#') {
    let hex = str.slice(1)
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
    if (hex.length >= 6) return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  }
  return fb
}

function buildAtlas(glyphs, family) {
  const cv = document.createElement('canvas')
  cv.width = ATLAS_COLS * ATLAS_CELL
  cv.height = ATLAS_ROWS * ATLAS_CELL
  const ctx = cv.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, cv.width, cv.height)
  // Hanja, carved: a filled glyph in the cell's middle.
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `900 ${ATLAS_CELL * 0.74}px ${family}`
  glyphs.slice(0, 24).forEach((g, i) => {
    const x = (i % ATLAS_COLS) * ATLAS_CELL + ATLAS_CELL / 2
    const y = Math.floor(i / ATLAS_COLS) * ATLAS_CELL + ATLAS_CELL / 2 + ATLAS_CELL * 0.03
    ctx.fillText(g, x, y)
  })
  // Mouldings for the split cells.
  ctx.strokeStyle = '#fff'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const scale = (ATLAS_CELL - ATLAS_PAD * 2) / 100
  BANDS.forEach((d, k) => {
    const i = 24 + k
    const x = (i % ATLAS_COLS) * ATLAS_CELL + ATLAS_PAD
    const y = Math.floor(i / ATLAS_COLS) * ATLAS_CELL + ATLAS_PAD
    ctx.setTransform(scale, 0, 0, scale, x, y)
    ctx.lineWidth = STROKE
    ctx.stroke(new Path2D(d))
  })
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  return cv
}

export function mountGlyphWall(root, init = {}) {
  const props = {
    background: '#18212D',
    glyphColor: '#A9B8C9',
    accent: '#F2C27A',
    size: 64,
    speed: 50,
    hover: 107,
    reach: 180,
    trail: 900,
    sweep: 0,
    glyphs: HANJA,
    family: '"Noto Serif KR", serif',
    ...init,
  }
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'
  root.append(canvas)
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false })
  if (!gl) return { props, destroy() {} }
  const mk = (type, s) => {
    const sh = gl.createShader(type)
    gl.shaderSource(sh, s)
    gl.compileShader(sh)
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.error('GlyphWall:', gl.getShaderInfoLog(sh))
    return sh
  }
  const prog = gl.createProgram()
  gl.attachShader(prog, mk(gl.VERTEX_SHADER, VERT_SRC))
  gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, FRAG_SRC))
  gl.linkProgram(prog)
  gl.useProgram(prog)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const posLoc = gl.getAttribLocation(prog, 'a_pos')
  gl.enableVertexAttribArray(posLoc)
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

  const tex = gl.createTexture()
  const uploadAtlas = () => {
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, buildAtlas(props.glyphs, props.family))
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }
  uploadAtlas()
  // Redraw once the serif hanja font has arrived.
  document.fonts?.load(`900 64px ${props.family}`, props.glyphs.join('')).then(uploadAtlas).catch(() => {})

  const u = {}
  for (const n of ['uRes', 'uDpr', 'uTime', 'uSize', 'uReach', 'uHover', 'uSweep', 'uBg', 'uGlyph', 'uAccent', 'uPts', 'uAtlas']) u[n] = gl.getUniformLocation(prog, n)
  gl.uniform1i(u.uAtlas, 0)

  const pointer = { x: 0, y: 0, has: false, gone: true }
  const onMove = (e) => {
    pointer.x = e.clientX
    pointer.y = e.clientY
    pointer.has = true
    pointer.gone = false
  }
  const onLeave = () => (pointer.gone = true)
  addEventListener('pointermove', onMove, { passive: true })
  document.documentElement.addEventListener('pointerleave', onLeave)
  let visible = true
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
  io.observe(root)

  const trailPts = []
  const head = { x: 0, y: 0, t: -1e9, inside: false }
  const ptsBuf = new Float32Array((TRAIL_POINTS + 1) * 3)
  let raf = 0
  let last = performance.now()
  let clock = 0
  const render = (now) => {
    raf = requestAnimationFrame(render)
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000))
    last = now
    if (!visible) return
    clock = (clock + dt * (props.speed / 50)) % 3600
    const dpr = Math.min(devicePixelRatio || 1, MAX_DPR)
    const cw = canvas.clientWidth || 1200
    const ch = canvas.clientHeight || 800
    const bw = Math.max(1, Math.round(cw * dpr))
    const bh = Math.max(1, Math.round(ch * dpr))
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw
      canvas.height = bh
      gl.viewport(0, 0, bw, bh)
    }
    let inside = false
    let lx = 0, ly = 0
    if (pointer.has && !pointer.gone) {
      const rect = root.getBoundingClientRect()
      lx = pointer.x - rect.left
      ly = pointer.y - rect.top
      inside = lx >= 0 && ly >= 0 && lx <= cw && ly <= ch
    }
    if (inside) {
      head.x = lx
      head.y = ly
      head.t = now
      const tail = trailPts[trailPts.length - 1]
      if (!tail || Math.hypot(tail.x - lx, tail.y - ly) > Math.max(8, props.reach * 0.25)) {
        trailPts.push({ x: lx, y: ly, t: now })
        if (trailPts.length > TRAIL_POINTS) trailPts.shift()
      }
    }
    head.inside = inside
    const fade = (t) => {
      if (props.trail <= 0) return 0
      const w = Math.max(0, Math.min(1, 1 - (now - t) / props.trail))
      return w * w * (3 - 2 * w)
    }
    ptsBuf[0] = head.x
    ptsBuf[1] = head.y
    ptsBuf[2] = head.inside ? 1 : fade(head.t)
    for (let i = 0; i < TRAIL_POINTS; i++) {
      const p = trailPts[i]
      const o = (i + 1) * 3
      ptsBuf[o] = p ? p.x : 0
      ptsBuf[o + 1] = p ? p.y : 0
      ptsBuf[o + 2] = p ? fade(p.t) : 0
    }
    const bg = parseColor(props.background, [0.09, 0.13, 0.18])
    const gc = parseColor(props.glyphColor, [0.66, 0.72, 0.79])
    const ac = parseColor(props.accent, [0.95, 0.76, 0.48])
    gl.uniform2f(u.uRes, bw, bh)
    gl.uniform1f(u.uDpr, bw / cw)
    gl.uniform1f(u.uTime, clock)
    gl.uniform1f(u.uSize, Math.max(20, props.size))
    gl.uniform1f(u.uReach, Math.max(10, props.reach))
    gl.uniform1f(u.uHover, Math.max(0, props.hover) / 100)
    gl.uniform1f(u.uSweep, props.sweep)
    gl.uniform3f(u.uBg, ...bg)
    gl.uniform3f(u.uGlyph, ...gc)
    gl.uniform3f(u.uAccent, ...ac)
    gl.uniform3fv(u.uPts, ptsBuf)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
  raf = requestAnimationFrame(render)
  return {
    props,
    destroy() {
      cancelAnimationFrame(raf)
      io.disconnect()
      removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      canvas.remove()
    },
  }
}
