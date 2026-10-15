// Atlas Sash — after Originkit's atlas-sash (originkit.dev), ported from
// React to a plain module so the page's scroll can drive it. A shader Earth
// (day, night lights, water glint, relief, clouds) wrapped in a tilting band
// of text whose back half passes behind the planet.
//
// mountAtlasSash(root, props) → { props, destroy }. Change `props` at any
// time; it is read every frame. Extra over the original: props.spin adds
// yaw (radians) and props.scale (0..1+) grows the planet, for scroll.

const TAU = Math.PI * 2
const DEG = Math.PI / 180
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)

const BASE = '/earth/'
const DAY_SRC = BASE + 'day.jpg'
const NIGHT_SRC = BASE + 'night.jpg'
const WATER_SRC = BASE + 'water.png'
const TOPO_SRC = BASE + 'topo.png'
const CLOUD_SRC = BASE + 'clouds.jpg'
const TEX_W = 2048
const TEX_H = 1024
const NIGHT_W = 4096
const AXIAL_TILT = 23.44 * DEG
const PERIOD_S = 60
const CLOUD_DRIFT = 0.012
const CURSOR_SUN_Z = 0.55
const MAX_PITCH = 1.1
const INERTIA_S = 0.9
const PITCH_RETURN_S = 1.6
const HOVER_TURN = 0.2
const HOVER_SOFT = 1.4
const HOVER_K = 60
const HOVER_C = 11
const STAR_PARALLAX = 0.35
const FADE_S = 0.6
const MAX_PIXELS = 4e6

export const ATLAS_DEFAULTS = {
  text: '',
  background: 'transparent',
  stars: 0,
  font: { fontFamily: 'Inter', fontWeight: 400, fontSize: 45, lineHeight: '1.25em', letterSpacing: '0em' },
  textColor: '#FFFFFF',
  ring: { lines: 4, radius: 110, tilt: 50, damping: 5, drift: 2.3 },
  size: 509,
  look: { clouds: 5, lights: 5, atmosphere: '#4F9BFF' },
  sun: { source: 'fixed', angle: 155, daylight: 64 },
  drag: true,
  hover: 5,
  speed: 5,
  spin: 0,
  scale: 1,
}

const PIX_CACHE = new Map()
function loadPix(src, channel, width = TEX_W) {
  const key = src + '#' + channel + '@' + width
  const hit = PIX_CACHE.get(key)
  if (hit) return hit
  const e = { state: 'loading', canvas: null, chan: null }
  PIX_CACHE.set(key, e)
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.decoding = 'async'
  img.onload = () => {
    try {
      const cv = document.createElement('canvas')
      cv.width = width
      cv.height = width / 2
      const cx = cv.getContext('2d', { willReadFrequently: channel >= 0 })
      cx.imageSmoothingQuality = 'high'
      cx.drawImage(img, 0, 0, width, width / 2)
      if (channel < 0) e.canvas = cv
      else {
        const data = cx.getImageData(0, 0, TEX_W, TEX_H).data
        const out = new Uint8Array(TEX_W * TEX_H)
        for (let i = 0; i < out.length; i++) out[i] = data[i * 4 + channel]
        e.chan = out
      }
      e.state = 'ready'
    } catch {
      e.state = 'failed'
    }
  }
  img.onerror = () => (e.state = 'failed')
  img.src = src
  return e
}

const COLOR_CACHE = new Map()
function rgbOf(c) {
  const hit = COLOR_CACHE.get(c)
  if (hit) return hit
  let out = [0, 0, 0]
  const s = (c || '').trim()
  if (s[0] === '#') {
    let hx = s.slice(1)
    if (hx.length === 3 || hx.length === 4) hx = hx.split('').map((x) => x + x).join('')
    const n = parseInt(hx.slice(0, 6), 16)
    if (!isNaN(n)) out = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  } else {
    const m = s.match(/[\d.]+/g)
    if (m && m.length >= 3) out = [+m[0], +m[1], +m[2]]
  }
  COLOR_CACHE.set(c, out)
  return out
}

const mul3 = (a, b) => a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]))
const rotX = (a) => [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]]
const rotY = (a) => [[Math.cos(a), 0, Math.sin(a)], [0, 1, 0], [-Math.sin(a), 0, Math.cos(a)]]
const rotZ = (a) => [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]]
const apply3 = (m, v) => [0, 1, 2].map((r) => m[r][0] * v[0] + m[r][1] * v[1] + m[r][2] * v[2])
const orbit = (hx, hy) => mul3(rotY(hx), rotX(-hy))

function globeFromView(yaw, pitch, view, out) {
  const worldFromView = view[0].map((_, c) => view.map((row) => row[c]))
  const m = mul3(mul3(mul3(rotY(-yaw), rotX(-pitch)), rotZ(-AXIAL_TILT)), worldFromView)
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) out[c * 3 + r] = m[r][c]
}

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`

const FRAG = `
#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives : enable
#endif
precision highp float;
uniform vec2 uCenter;
uniform float uRadius;
uniform float uDpr;
uniform mat3 uRot;
uniform float uCloudRot;
uniform vec3 uLight;
uniform vec3 uAtmo;
uniform float uClouds;
uniform float uLights;
uniform float uStars;
uniform float uTime;
uniform vec2 uStarShift;
uniform vec4 uHave;
uniform sampler2D uDay;
uniform sampler2D uNight;
uniform sampler2D uAux;

const float PI = 3.14159265;
const float TAU = 6.28318531;
const float GLOW = 0.07;
const float BUMP = 2.2;
const float SHADOW_REACH = 0.012;
const float EXPOSURE = 1.7;
const vec3 MOON = vec3(0.008, 0.012, 0.024);
const float STAR_CELL = 7.0;
const float STAR_SHARE = 0.16;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

vec2 equi(vec3 q, float shift) {
    float u1 = fract(atan(q.x, q.z) / TAU + 0.5 + shift);
    float u2 = fract(u1 + 0.5) - 0.5;
#ifdef GL_OES_standard_derivatives
    float u = fwidth(u1) < fwidth(u2) - 0.001 ? u1 : u2;
#else
    float u = u1;
#endif
    return vec2(u, acos(clamp(q.y, -1.0, 1.0)) / PI);
}

void main() {
    vec2 frag = gl_FragCoord.xy;
    vec2 p = (frag - uCenter) / uRadius;
    float r = length(p);
    vec2 s = r > 0.999 ? p / r * 0.999 : p;
    vec3 n = vec3(s, sqrt(max(0.0, 1.0 - dot(s, s))));
    vec3 q = uRot * n;
    vec3 L = uRot * uLight;
    vec3 H = uRot * normalize(uLight + vec3(0.0, 0.0, 1.0));
    float cl = max(length(q.xz), 1e-4);
    vec3 east = vec3(q.z, 0.0, -q.x) / cl;
    vec3 north = cross(q, east);

    vec2 uv = equi(q, 0.0);
    vec2 uvc = equi(q, -uCloudRot / TAU);
    vec3 day = texture2D(uDay, uv).rgb;
    vec3 night = texture2D(uNight, uv).rgb;
    float nightGlow = texture2D(uNight, uv, 3.0).r;
    vec4 aux = texture2D(uAux, uv);
    float hE = texture2D(uAux, uv + vec2(1.5 / 2048.0, 0.0)).g;
    float hN = texture2D(uAux, uv - vec2(0.0, 1.5 / 1024.0)).g;
    vec2 toSun = vec2(dot(L, east) / (TAU * cl), -dot(L, north) / PI) * SHADOW_REACH;
    float cloud = texture2D(uAux, uvc).b;
    float shadow = texture2D(uAux, uvc + toSun).b;

    float water = aux.r * uHave.z;
    float dry = 1.0 - water;
    vec3 nb = normalize(q - BUMP * uHave.z * dry * ((hE - aux.g) * east + (hN - aux.g) * north));
    float ndlS = dot(q, L);
    float ndl = dot(nb, L);
    float mu = n.z;

    vec3 sun = mix(vec3(1.0, 0.45, 0.22), vec3(1.0), smoothstep(0.0, 0.3, ndlS));
    vec3 alb = mix(vec3(0.010, 0.016, 0.030), pow(day, vec3(2.2)), uHave.x);
    float diff = max(ndl, 0.0) * smoothstep(-0.08, 0.12, ndlS);
    vec3 col = alb * sun * diff;

    float nh = max(dot(q, H), 0.0);
    col += sun * water * (pow(nh, 240.0) * 0.22 + pow(nh, 24.0) * 0.025) * smoothstep(0.0, 0.25, ndlS);

    float cov = clamp(cloud * uClouds, 0.0, 1.0) * uHave.w;
    float shade = clamp(shadow * uClouds, 0.0, 1.0) * uHave.w;
    col *= 1.0 - 0.55 * shade;

    float dark = 1.0 - smoothstep(-0.16, 0.06, ndlS);
    col += alb * MOON * dark;

    float li = clamp((night.r - 0.035) / 0.40, 0.0, 1.0);
    float lg = clamp((nightGlow - 0.035) / 0.40, 0.0, 1.0);
    vec3 lamp = mix(vec3(1.0, 0.46, 0.13), vec3(1.0, 0.84, 0.62), smoothstep(0.35, 0.9, li));
    vec3 city = lamp * li * li * 2.4 + vec3(1.0, 0.42, 0.12) * lg * 0.45;
    col += city * uLights * dark * (1.0 - 0.85 * cov) * (0.35 + 0.65 * mu) * uHave.y;

    float cdiff = smoothstep(-0.12, 0.25, ndlS) * (0.2 + 0.8 * max(ndlS, 0.0));
    col = mix(col, vec3(0.92, 0.94, 0.97) * (sun * cdiff + MOON * dark), cov);

    float lit = smoothstep(-0.35, 0.5, ndlS);
    float rim = 1.0 - mu;
    col = mix(col, uAtmo * 0.35 * lit, pow(rim, 3.0) * 0.55);
    col += uAtmo * (pow(rim, 1.6) * 0.05 + pow(rim, 6.0) * 0.8) * lit;
    col += vec3(1.0, 0.38, 0.12) * pow(rim, 3.0) * exp(-ndlS * ndlS / 0.012) * 0.22;

    float ia = clamp((1.0 - r) * uRadius + 0.5, 0.0, 1.0);
    float t = max(r - 1.0, 0.0) / GLOW;
    float halo = exp(-t * 3.5) * (1.0 - smoothstep(0.0, 1.0, t));
    float hl = smoothstep(-0.5, 0.7, dot(vec3(p / max(r, 1e-4), 0.0), uLight));
    vec3 lin = col * ia + uAtmo * halo * hl * 0.9 * (1.0 - ia);

    vec3 x = lin * EXPOSURE;
    vec3 rgb = pow(clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0), vec3(1.0 / 2.2));

    if (uStars > 0.0) {
        vec2 sp = (frag + uStarShift) / (STAR_CELL * uDpr);
        vec2 id = floor(sp);
        float h0 = hash(id);
        if (h0 < uStars * STAR_SHARE) {
            vec2 pos = vec2(hash(id + 17.3), hash(id + 41.9)) * 0.7 + 0.15;
            float d = length(fract(sp) - pos) * STAR_CELL;
            float mag = pow(hash(id + 7.1), 5.0);
            float tw = 0.7 + 0.3 * sin(uTime * (0.6 + 2.0 * hash(id + 3.3)) + h0 * 80.0);
            float star = exp(-d * d / (0.25 + 0.6 * mag)) * (0.15 + 0.85 * mag) * tw;
            rgb += vec3(star) * (1.0 - ia) * (1.0 - clamp(halo * 1.5, 0.0, 1.0));
        }
    }
    gl_FragColor = vec4(rgb, max(ia, max(rgb.r, max(rgb.g, rgb.b))));
}`

function makeGL(canvas) {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false })
  if (!gl) return null
  gl.getExtension('OES_standard_derivatives')
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic')
  const shader = (type, src) => {
    const s = gl.createShader(type)
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('AtlasSash:', gl.getShaderInfoLog(s))
      return null
    }
    return s
  }
  const vs = shader(gl.VERTEX_SHADER, VERT)
  const fs = shader(gl.FRAGMENT_SHADER, FRAG)
  const prog = gl.createProgram()
  if (!vs || !fs || !prog) return null
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null
  gl.useProgram(prog)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'aPos')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  const u = {}
  for (const name of ['uCenter', 'uRadius', 'uDpr', 'uRot', 'uCloudRot', 'uLight', 'uAtmo', 'uClouds', 'uLights', 'uStars', 'uTime', 'uStarShift', 'uHave', 'uDay', 'uNight', 'uAux'])
    u[name] = gl.getUniformLocation(prog, name)
  const tex = []
  for (let i = 0; i < 3; i++) {
    const t = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0 + i)
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8)
    tex.push(t)
  }
  gl.uniform1i(u.uDay, 0)
  gl.uniform1i(u.uNight, 1)
  gl.uniform1i(u.uAux, 2)
  return { gl, u, tex, held: ['', '', ''] }
}

function upload(g, slot, src) {
  const { gl } = g
  gl.activeTexture(gl.TEXTURE0 + slot)
  gl.bindTexture(gl.TEXTURE_2D, g.tex[slot])
  if (src instanceof Uint8Array) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, TEX_W, TEX_H, 0, gl.RGBA, gl.UNSIGNED_BYTE, src)
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src)
  gl.generateMipmap(gl.TEXTURE_2D)
}

function auxFor(water, topo, cloud) {
  const out = new Uint8Array(TEX_W * TEX_H * 4)
  for (let i = 0, k = 0; i < TEX_W * TEX_H; i++, k += 4) {
    out[k] = water ? water[i] : 0
    out[k + 1] = topo ? topo[i] : 0
    out[k + 2] = cloud ? cloud[i] : 0
    out[k + 3] = 255
  }
  return out
}

const RING_ADV = {
  fov: 35, frontOpacity: 100, backOpacity: 60, edgeFade: 15, turnRange: 50, roll: 8, baseTilt: -5, baseTurn: -130,
  idleX: 75, idleY: 80, idlePeriodX: 4800, idlePeriodY: 3000, textSharpness: 100, sphereSegments: 96, ringSegments: 192,
}

function ringFit(size, h, ringR) {
  const tanHalf = Math.tan((RING_ADV.fov * DEG) / 2)
  const maxT = 1 / Math.sqrt((ringR + 0.3) * (ringR + 0.3) - 1)
  const t = Math.min((Math.max(10, size) / h) * tanHalf, maxT)
  return { tanHalf, t, diameter: (t / tanHalf) * h }
}

const num = (v, fb) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? n : fb
}

function parseColor(input, fb) {
  if (typeof input !== 'string') return fb
  const s = input.trim()
  if (s[0] === '#') {
    let h = s.slice(1)
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('')
    if (h.length !== 6 && h.length !== 8) return fb
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
    return [r / 255, g / 255, b / 255, a]
  }
  const m = s.match(/rgba?\(([^)]+)\)/i)
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean)
    if (p.length >= 3) return [parseFloat(p[0]) / 255, parseFloat(p[1]) / 255, parseFloat(p[2]) / 255, p[3] ? parseFloat(p[3]) : 1]
  }
  return fb
}

function fontSpec(f = {}) {
  const px = Math.max(4, num(f.fontSize, 45))
  const weight = f.fontWeight ?? 500
  const style = f.fontStyle || 'normal'
  const fam = typeof f.fontFamily === 'string' && f.fontFamily ? f.fontFamily : 'Inter'
  const family = /[,"']/.test(fam) ? fam : `"${fam}"`
  let lh = 1.25 * px
  const L = f.lineHeight
  if (typeof L === 'number') lh = L <= 4 ? L * px : L
  else if (typeof L === 'string' && L.trim()) {
    const n = parseFloat(L)
    if (Number.isFinite(n)) lh = L.endsWith('px') ? n : L.endsWith('%') ? (n / 100) * px : n * px
  }
  let ls = 0
  const S = f.letterSpacing
  if (typeof S === 'number') ls = S
  else if (typeof S === 'string' && S.trim()) {
    const n = parseFloat(S)
    if (Number.isFinite(n)) ls = S.endsWith('em') ? n * px : S.endsWith('%') ? (n / 100) * px : n
  }
  return { css: `${style} ${weight} ${px}px ${family}, sans-serif`, px, lh: Math.max(px * 0.6, lh), ls }
}

function drawBand(canvas, text, fs, lines, circPx, scale) {
  canvas.width = Math.max(1, Math.round(circPx * scale))
  canvas.height = Math.max(1, Math.round(lines * fs.lh * scale))
  const ctx = canvas.getContext('2d')
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.font = fs.css
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${fs.ls}px`
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  const words = String(text || '').split(/\s+/).filter(Boolean)
  if (!words.length) return
  const widths = words.map((w) => ctx.measureText(w).width)
  const space = Math.max(1, ctx.measureText(' ').width)
  let idx = 0
  for (let li = 0; li < lines; li++) {
    const lw = []
    let sum = 0
    while (lw.length < 4000) {
      const i = idx % words.length
      const need = sum + widths[i] + (lw.length + 1) * space
      if (lw.length > 0 && need > circPx) break
      lw.push(i)
      sum += widths[i]
      idx++
    }
    const gap = (circPx - sum) / lw.length
    let x = gap / 2
    const y = (li + 0.5) * fs.lh
    for (const i of lw) {
      ctx.fillText(words[i], x, y)
      x += widths[i] + gap
    }
  }
}

// --- tiny column-major mat4 helpers for the ring pass ---
function mul4(a, b) {
  const o = new Float32Array(16)
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]
      o[c * 4 + r] = s
    }
  return o
}
const ident4 = () => {
  const m = new Float32Array(16)
  m[0] = m[5] = m[10] = m[15] = 1
  return m
}
function perspective4(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2)
  const nf = 1 / (near - far)
  const m = new Float32Array(16)
  m[0] = f / aspect
  m[5] = f
  m[10] = (far + near) * nf
  m[11] = -1
  m[14] = 2 * far * near * nf
  return m
}
const translate4 = (x, y, z) => {
  const m = ident4()
  m[12] = x
  m[13] = y
  m[14] = z
  return m
}
const rotX4 = (a) => {
  const m = ident4()
  const c = Math.cos(a), s = Math.sin(a)
  m[5] = c, m[6] = s, m[9] = -s, m[10] = c
  return m
}
const rotY4 = (a) => {
  const m = ident4()
  const c = Math.cos(a), s = Math.sin(a)
  m[0] = c, m[2] = -s, m[8] = s, m[10] = c
  return m
}
const rotZ4 = (a) => {
  const m = ident4()
  const c = Math.cos(a), s = Math.sin(a)
  m[0] = c, m[1] = s, m[4] = -s, m[5] = c
  return m
}

const SPHERE_VS = `#version 300 es
precision highp float;
in vec3 aPos;
uniform mat4 uViewProj;
void main() { gl_Position = uViewProj * vec4(aPos, 1.0); }`
const SPHERE_FS = `#version 300 es
precision highp float;
out vec4 outColor;
void main() { outColor = vec4(0.0); }`
const RING_VS = `#version 300 es
precision highp float;
in vec2 aPos;
uniform mat4 uModel;
uniform mat4 uViewProj;
uniform vec2 uRing;
out vec2 vUV;
out vec3 vWorld;
out vec3 vNormal;
void main() {
    float phi = aPos.x * 6.28318530718;
    vec3 n = vec3(sin(phi), 0.0, cos(phi));
    vec3 p = vec3(n.x * uRing.x, aPos.y * uRing.y, n.z * uRing.x);
    vec4 w = uModel * vec4(p, 1.0);
    vWorld = w.xyz;
    vNormal = mat3(uModel) * n;
    vUV = vec2(aPos.x, 0.5 - 0.5 * aPos.y);
    gl_Position = uViewProj * w;
}`
const RING_FS = `#version 300 es
precision highp float;
in vec2 vUV;
in vec3 vWorld;
in vec3 vNormal;
uniform sampler2D uTex;
uniform vec4 uColor;
uniform vec3 uCam;
uniform vec3 uShade;
out vec4 outColor;
void main() {
    vec3 v = uCam - vWorld;
    float f = dot(vNormal / max(length(vNormal), 1e-5), v / max(length(v), 1e-5));
    float facing = abs(f);
    float cover = texture(uTex, vUV).a;
    float o = f > 0.0 ? uShade.x : uShade.y;
    float shade = 1.0 - uShade.z * (1.0 - facing);
    float a = cover * o * uColor.a;
    outColor = vec4(uColor.rgb * shade * a, a);
}`

function program(gl, vs, fs, attr) {
  const p = gl.createProgram()
  const mk = (type, src) => {
    const s = gl.createShader(type)
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader')
    return s
  }
  const a = mk(gl.VERTEX_SHADER, vs)
  const b = mk(gl.FRAGMENT_SHADER, fs)
  gl.attachShader(p, a)
  gl.attachShader(p, b)
  gl.bindAttribLocation(p, 0, attr)
  gl.linkProgram(p)
  gl.deleteShader(a)
  gl.deleteShader(b)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link')
  return p
}

function makeMesh(gl, data, size, idx) {
  const vao = gl.createVertexArray()
  const vbo = gl.createBuffer()
  const ibo = gl.createBuffer()
  gl.bindVertexArray(vao)
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, size, gl.FLOAT, false, 0, 0)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo)
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW)
  gl.bindVertexArray(null)
  return { vao, count: idx.length }
}
function sphereMesh(gl, seg) {
  const lon = Math.max(16, seg)
  const lat = Math.max(8, Math.round(seg / 2))
  const pos = []
  const idx = []
  for (let i = 0; i <= lat; i++) {
    const th = (i / lat) * Math.PI
    const st = Math.sin(th), ct = Math.cos(th)
    for (let j = 0; j <= lon; j++) {
      const ph = (j / lon) * Math.PI * 2
      pos.push(st * Math.sin(ph), ct, st * Math.cos(ph))
    }
  }
  for (let i = 0; i < lat; i++)
    for (let j = 0; j < lon; j++) {
      const a = i * (lon + 1) + j
      const b = a + lon + 1
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  return makeMesh(gl, new Float32Array(pos), 3, new Uint32Array(idx))
}
function ringMesh(gl, seg) {
  const pos = []
  const idx = []
  for (let j = 0; j <= seg; j++) pos.push(j / seg, 1, j / seg, -1)
  for (let j = 0; j < seg; j++) {
    const a = 2 * j
    idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3)
  }
  return makeMesh(gl, new Float32Array(pos), 2, new Uint32Array(idx))
}

export function mountAtlasSash(root, init = {}) {
  const props = { ...ATLAS_DEFAULTS, ...init }
  props.ring = { ...ATLAS_DEFAULTS.ring, ...init.ring }
  props.look = { ...ATLAS_DEFAULTS.look, ...init.look }
  props.sun = { ...ATLAS_DEFAULTS.sun, ...init.sun }
  Object.assign(root.style, { position: root.style.position || 'absolute', overflow: 'hidden', touchAction: 'pan-y' })
  const layer = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none'
  const globeCv = document.createElement('canvas')
  const ringCv = document.createElement('canvas')
  globeCv.style.cssText = layer
  ringCv.style.cssText = layer
  root.append(globeCv, ringCv)

  let visible = true
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { rootMargin: '10% 0px' })
  io.observe(root)
  const effSize = () => props.size * props.scale

  /* ---- the text band ---- */
  const stopRing = (() => {
    const canvas = ringCv
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true })
    if (!gl) return () => {}
    let sphereProg, ringProg, uS, uR
    try {
      sphereProg = program(gl, SPHERE_VS, SPHERE_FS, 'aPos')
      ringProg = program(gl, RING_VS, RING_FS, 'aPos')
      uS = { viewProj: gl.getUniformLocation(sphereProg, 'uViewProj') }
      uR = Object.fromEntries(['uModel', 'uViewProj', 'uRing', 'uTex', 'uColor', 'uCam', 'uShade'].map((n) => [n, gl.getUniformLocation(ringProg, n)]))
    } catch (e) {
      console.warn('AtlasSash:', e)
      return () => {}
    }
    const maxTex = Math.min(8192, gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096)
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic')
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    const bandCanvas = document.createElement('canvas')
    const sphere = sphereMesh(gl, RING_ADV.sphereSegments)
    const ring = ringMesh(gl, RING_ADV.ringSegments)
    let texKey = ''
    let loadedCss = ''
    let fontVersion = 0
    const onFonts = () => fontVersion++
    document.fonts?.addEventListener?.('loadingdone', onFonts)
    const dims = { w: 0, h: 0, dpr: 1 }
    const resize = () => {
      dims.w = root.offsetWidth
      dims.h = root.offsetHeight
      dims.dpr = Math.min(2, devicePixelRatio || 1)
      canvas.width = Math.max(1, Math.round(dims.w * dims.dpr))
      canvas.height = Math.max(1, Math.round(dims.h * dims.dpr))
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(root)
    const pointer = { x: 0, y: 0, active: false }
    const onMove = (e) => {
      const r = root.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) return
      pointer.x = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1)
      pointer.y = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1)
      pointer.active = true
    }
    addEventListener('pointermove', onMove, { passive: true })
    const cur = { tilt: 0, turn: 0, roll: 0 }
    let poseInit = false
    let idleT = 0
    let last = -1
    let raf = 0
    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      const dt = last < 0 ? 0 : Math.min((now - last) / 1000, 1 / 20)
      last = now
      if (!visible) return
      const a = RING_ADV
      const { w, h, dpr } = dims
      if (w < 2 || h < 2) return
      const fovR = a.fov * DEG
      const ringR = clamp(props.ring.radius, 100, 160) / 100
      const { tanHalf, t } = ringFit(effSize(), h, ringR)
      const D = Math.sqrt(1 + t * t) / t
      const pxPerWorld = h / 2 / (tanHalf * (D - ringR))
      const fs = fontSpec(props.font)
      const lines = Math.round(clamp(props.ring.lines, 1, 8))
      const circPx = 2 * Math.PI * ringR * pxPerWorld
      const bandPx = lines * fs.lh
      const texScale = Math.max(0.1, Math.min((dpr * a.textSharpness) / 100, maxTex / circPx, maxTex / Math.max(1, bandPx)))
      if (fs.css !== loadedCss) {
        loadedCss = fs.css
        document.fonts?.load?.(fs.css).then(() => fontVersion++).catch(() => {})
      }
      // Re-rasterise the band only for real changes (not every scale step).
      const key = [props.text, fs.css, fs.lh.toFixed(2), fs.ls.toFixed(2), lines, Math.round(circPx / 64), fontVersion].join('|')
      if (key !== texKey) {
        texKey = key
        drawBand(bandCanvas, props.text, fs, lines, circPx, texScale)
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bandCanvas)
        gl.generateMipmap(gl.TEXTURE_2D)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
        if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 1))
      }
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
      let px = 0, py = 0
      if (!reduce) {
        if (pointer.active) ((px = pointer.x), (py = pointer.y))
        else {
          idleT += (dt * Math.max(0, props.ring.drift * 10)) / 50
          px = (a.idleX / 100) * Math.sin((2 * Math.PI * idleT) / (a.idlePeriodX / 1000))
          py = (a.idleY / 100) * Math.sin((2 * Math.PI * idleT) / (a.idlePeriodY / 1000))
        }
      }
      const tgtTilt = (a.baseTilt + py * props.ring.tilt) * DEG
      const tgtTurn = (a.baseTurn + px * a.turnRange) * DEG + props.spin
      const tgtRoll = -px * a.roll * DEG
      if (!poseInit || reduce) {
        cur.tilt = tgtTilt
        cur.turn = tgtTurn
        cur.roll = tgtRoll
        poseInit = true
      } else if (dt > 0) {
        const tau = 0.4 * Math.pow(0.1, clamp(props.ring.damping * 10, 0, 100) / 100)
        const k = 1 - Math.exp(-dt / tau)
        cur.tilt += (tgtTilt - cur.tilt) * k
        cur.turn += (tgtTurn - cur.turn) * k
        cur.roll += (tgtRoll - cur.roll) * k
      }
      const proj = perspective4(fovR, w / h, 0.05, D + 4)
      const viewProj = mul4(proj, translate4(0, 0, -D))
      const model = mul4(rotZ4(cur.roll), mul4(rotX4(cur.tilt), rotY4(cur.turn)))
      const tc = parseColor(props.textColor, [1, 1, 1, 1])
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(0, 0, 0, 0)
      gl.clearDepth(1)
      gl.depthMask(true)
      gl.enable(gl.DEPTH_TEST)
      gl.depthFunc(gl.LEQUAL)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      gl.disable(gl.CULL_FACE)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      // The planet only writes depth, so the band's back half hides behind it.
      gl.colorMask(false, false, false, false)
      gl.useProgram(sphereProg)
      gl.uniformMatrix4fv(uS.viewProj, false, viewProj)
      gl.bindVertexArray(sphere.vao)
      gl.drawElements(gl.TRIANGLES, sphere.count, gl.UNSIGNED_INT, 0)
      gl.colorMask(true, true, true, true)
      gl.depthMask(false)
      gl.useProgram(ringProg)
      gl.uniformMatrix4fv(uR.uModel, false, model)
      gl.uniformMatrix4fv(uR.uViewProj, false, viewProj)
      gl.uniform2f(uR.uRing, ringR, bandPx / 2 / pxPerWorld)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.uniform1i(uR.uTex, 0)
      gl.uniform4f(uR.uColor, tc[0], tc[1], tc[2], tc[3])
      gl.uniform3f(uR.uCam, 0, 0, D)
      gl.uniform3f(uR.uShade, a.frontOpacity / 100, a.backOpacity / 100, a.edgeFade / 100)
      gl.bindVertexArray(ring.vao)
      gl.drawElements(gl.TRIANGLES, ring.count, gl.UNSIGNED_INT, 0)
      gl.depthMask(true)
      gl.bindVertexArray(null)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      removeEventListener('pointermove', onMove)
      document.fonts?.removeEventListener?.('loadingdone', onFonts)
    }
  })()

  /* ---- the planet ---- */
  const stopGlobe = (() => {
    const canvas = globeCv
    const g = makeGL(canvas)
    if (!g) return () => {}
    const { gl, u } = g
    let W = 0, H = 0, dpr = 1
    const resize = () => {
      W = root.offsetWidth
      H = root.offsetHeight
      dpr = Math.min(2, devicePixelRatio || 1)
      if (W * H * dpr * dpr > MAX_PIXELS) dpr = Math.sqrt(MAX_PIXELS / Math.max(1, W * H))
      canvas.width = Math.max(1, Math.round(W * dpr))
      canvas.height = Math.max(1, Math.round(H * dpr))
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(root)
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    let px = 0, py = 0, over = false, R = 1
    let dragging = false, dragId = -1, lastX = 0, lastY = 0, lastT = 0
    let yaw = 0, pitch = 0, vYaw = 0, vPitch = 0
    const local = (e) => {
      const b = root.getBoundingClientRect()
      px = (e.clientX - b.left) * (b.width ? W / b.width : 1)
      py = (e.clientY - b.top) * (b.height ? H / b.height : 1)
    }
    const onMove = (e) => {
      local(e)
      over = true
      if (!dragging || e.pointerId !== dragId) return
      const now = performance.now()
      const dts = Math.max(0.001, (now - lastT) / 1000)
      const dYaw = (px - lastX) / R, dPitch = (py - lastY) / R
      yaw += dYaw
      pitch = clamp(pitch + dPitch, -MAX_PITCH, MAX_PITCH)
      vYaw += (dYaw / dts - vYaw) * 0.4
      vPitch += (dPitch / dts - vPitch) * 0.4
      lastX = px
      lastY = py
      lastT = now
    }
    const onLeave = () => !dragging && (over = false)
    const onDown = (e) => {
      local(e)
      over = true
      if (!props.drag || (e.pointerType === 'mouse' && e.button !== 0)) return
      if (Math.hypot(px - W / 2, py - H / 2) > R * 1.15) return
      dragging = true
      dragId = e.pointerId
      lastX = px
      lastY = py
      lastT = performance.now()
      vYaw = vPitch = 0
      root.setPointerCapture?.(e.pointerId)
      root.style.cursor = 'grabbing'
    }
    const onUp = (e) => {
      if (!dragging || e.pointerId !== dragId) return
      dragging = false
      if (performance.now() - lastT > 80) vYaw = vPitch = 0
      root.style.cursor = ''
    }
    root.addEventListener('pointermove', onMove)
    root.addEventListener('pointerenter', onMove)
    root.addEventListener('pointerleave', onLeave)
    root.addEventListener('pointerdown', onDown)
    root.addEventListener('pointerup', onUp)
    root.addEventListener('pointercancel', onUp)
    const rot = new Float32Array(9)
    const have = [0, 0, 0, 0]
    let last = -1, time = 0, cloudRot = 0, raf = 0
    const hov = { x: 0, vx: 0, y: 0, vy: 0 }
    let lx = NaN, ly = 0, lz = 0
    let auxKey = ''
    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      const dt = last < 0 ? 0 : Math.min(0.05, (now - last) / 1000)
      last = now
      if (!visible || W < 2 || H < 2) return
      const look = props.look
      const sunP = props.sun
      time += dt
      const want = [[loadPix(DAY_SRC, -1), DAY_SRC], [loadPix(NIGHT_SRC, -1, NIGHT_W), NIGHT_SRC]]
      want.forEach(([pix, src], slot) => {
        if (pix.state === 'ready' && pix.canvas && g.held[slot] !== src) {
          upload(g, slot, pix.canvas)
          g.held[slot] = src
        }
      })
      const water = loadPix(WATER_SRC, 0), topo = loadPix(TOPO_SRC, 0), cloud = loadPix(CLOUD_SRC, 0)
      const key = [water, topo, cloud].map((x) => (x.state === 'ready' ? 1 : 0)).join('')
      if (key !== auxKey && key !== '000') {
        upload(g, 2, auxFor(water.chan, topo.chan, cloud.chan))
        auxKey = key
      }
      const targets = [g.held[0] ? 1 : 0, g.held[1] ? 1 : 0, water.chan ? 1 : 0, cloud.chan ? 1 : 0]
      const fk = 1 - Math.exp(-dt / FADE_S)
      for (let i = 0; i < 4; i++) have[i] += (targets[i] - have[i]) * fk
      const spd = Math.max(0, props.speed) / 5
      const omega = reduce ? 0 : (TAU * spd) / PERIOD_S
      if (!dragging) {
        const decay = Math.exp(-dt / INERTIA_S)
        yaw += (omega + (reduce ? 0 : vYaw)) * dt
        pitch = clamp(pitch + (reduce ? 0 : vPitch) * dt, -MAX_PITCH, MAX_PITCH)
        vYaw *= decay
        vPitch *= decay
        pitch *= Math.exp(-dt / PITCH_RETURN_S)
      }
      cloudRot += dt * spd * CLOUD_DRIFT * (reduce ? 0 : 1)
      const cx = W / 2, cy = H / 2
      const ringR = clamp(props.ring.radius, 100, 160) / 100
      R = Math.max(20, ringFit(effSize(), H, ringR).diameter / 2)
      const hk = reduce ? 0 : Math.max(0, props.hover) / 5
      const soft = (v) => Math.tanh(HOVER_SOFT * clamp(v, -1.5, 1.5)) / Math.tanh(HOVER_SOFT)
      let gx = 0, gy = 0
      if (dragging) ((gx = hov.x), (gy = hov.y))
      else if (over && hk > 0) {
        gx = soft((px - cx) / Math.max(1, cx)) * HOVER_TURN * hk
        gy = -soft((py - cy) / Math.max(1, cy)) * HOVER_TURN * hk
      }
      const steps = Math.ceil(dt * 120)
      for (let i = 0; i < steps; i++) {
        const h = dt / steps
        hov.vx += (HOVER_K * (gx - hov.x) - HOVER_C * hov.vx) * h
        hov.x += hov.vx * h
        hov.vy += (HOVER_K * (gy - hov.y) - HOVER_C * hov.vy) * h
        hov.y += hov.vy * h
      }
      const view = orbit(hov.x, hov.y)
      globeFromView(yaw + props.spin, pitch, view, rot)
      const ang = sunP.angle * DEG
      const tz0 = clamp(sunP.daylight / 50 - 1, -0.98, 1)
      const flat = Math.sqrt(1 - tz0 * tz0)
      let tx = Math.cos(ang) * flat, ty = Math.sin(ang) * flat, tz = tz0
      if (sunP.source === 'cursor' && over) {
        const w = apply3(rotX(hov.y), apply3(rotY(-hov.x), [clamp((px - cx) / R, -2.5, 2.5), clamp(-(py - cy) / R, -2.5, 2.5), CURSOR_SUN_Z]))
        ;[tx, ty, tz] = w
      }
      const tl = Math.hypot(tx, ty, tz)
      if (isNaN(lx)) ((lx = tx / tl), (ly = ty / tl), (lz = tz / tl))
      else {
        const lk = 1 - Math.exp(-dt / 0.35)
        lx += (tx / tl - lx) * lk
        ly += (ty / tl - ly) * lk
        lz += (tz / tl - lz) * lk
      }
      const ll = Math.hypot(lx, ly, lz) || 1
      const Lv = apply3(view, [lx / ll, ly / ll, lz / ll])
      const at = rgbOf(look.atmosphere)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform2f(u.uCenter, canvas.width / 2, canvas.height / 2)
      gl.uniform1f(u.uRadius, R * dpr)
      gl.uniform1f(u.uDpr, dpr)
      gl.uniformMatrix3fv(u.uRot, false, rot)
      gl.uniform1f(u.uCloudRot, cloudRot)
      gl.uniform3f(u.uLight, Lv[0], Lv[1], Lv[2])
      gl.uniform3f(u.uAtmo, (at[0] / 255) ** 2.2, (at[1] / 255) ** 2.2, (at[2] / 255) ** 2.2)
      gl.uniform1f(u.uClouds, Math.max(0, look.clouds) / 5)
      gl.uniform1f(u.uLights, Math.max(0, look.lights) / 5)
      gl.uniform1f(u.uStars, clamp(props.stars / 10, 0, 1))
      gl.uniform1f(u.uTime, reduce ? 0 : time)
      gl.uniform2f(u.uStarShift, hov.x * R * dpr * STAR_PARALLAX, hov.y * R * dpr * STAR_PARALLAX)
      gl.uniform4f(u.uHave, have[0], have[1], have[2], have[3])
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      root.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerenter', onMove)
      root.removeEventListener('pointerleave', onLeave)
      root.removeEventListener('pointerdown', onDown)
      root.removeEventListener('pointerup', onUp)
      root.removeEventListener('pointercancel', onUp)
    }
  })()

  return {
    props,
    destroy() {
      io.disconnect()
      stopRing()
      stopGlobe()
      globeCv.remove()
      ringCv.remove()
    },
  }
}
