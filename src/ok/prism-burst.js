// Prism Burst — after Originkit's prism-burst (originkit.dev), ported to a
// plain module. A light burst whose ray filaments are sampled three times at
// offset angles, so red and blue split into prism fringes across each ray.
// Extra over the original: props.center ([x, y], -0.5..0.5 of the height
// from the middle) places the source, props.power (0..1+) scales the light.
//
// mountPrismBurst(root, props) → { props, destroy }.

const MAX_DPR = 1.5

const VERT_SRC = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`

const FRAG_SRC = `
precision highp float;
uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;
uniform float uHover;
uniform vec2  uCenter;
uniform float uPower;
uniform vec3 uBg, uBase, uAccent, uHigh;
uniform float uRays, uDisp, uCore, uFall, uBend, uReach;

float sat(float x){ return clamp(x, 0.0, 1.0); }
float pw(float x, float e){ return pow(max(x, 1e-5), e); }
float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 34.56); return fract(p.x * p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm3(vec2 p){ float s = 0.0, a = 0.5; for(int i = 0; i < 3; i++){ s += a * vnoise(p); p = p * 2.07 + vec2(4.1, 2.3); a *= 0.5; } return s; }
float streak(vec2 dd, float t, float rays, float fall, float core, float spin){
  float r = max(length(dd), 1e-3);
  float th = atan(dd.y, dd.x) + spin;
  vec2 cs = vec2(cos(th), sin(th));
  float a = fbm3(cs * rays + vec2(t * 0.06, 0.0));
  a += 0.50 * vnoise(cs * rays * 2.3 - vec2(t * 0.09, 3.1));
  a = pw(sat(a * 1.20 - 0.44), 2.1);
  float rad = 1.0 / (1.0 + r * r * fall * fall * 24.0);
  return a * rad * smoothstep(0.0, core * 1.10, r);
}
void main(){
  float ar = uRes.x / max(uRes.y, 1.0);
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (uv - 0.5) * vec2(ar, 1.0);
  float t = uTime;
  vec2 d = p - uCenter;
  float rr = length(d);
  vec2 pm = p - (uMouse - 0.5) * vec2(ar, 1.0);
  float g = sat(uHover) * exp(-dot(pm, pm) / max(uReach * uReach, 1e-4));
  float spin = g * uBend;
  float dsp = uDisp * 0.22 * (0.30 + 0.70 * sat(rr * 1.5)) * (1.0 + 4.0 * g);
  float dang = min(dsp * 0.18, 0.25 / max(uRays, 1.0));
  float R = streak(d * (1.0 - dsp * 0.35), t, uRays, uFall, uCore, spin - dang);
  float G = streak(d, t, uRays, uFall, uCore, spin);
  float B = streak(d * (1.0 + dsp * 0.35), t, uRays, uFall, uCore, spin + dang);
  float lum = (R + G + B) / 3.0;
  vec3 col = vec3(0.0);
  col += uBase * lum * 1.2;
  col += vec3(R, G, B) * 2.8;
  col += uBase * exp(-rr * uFall * 1.5) * 0.55;
  col += uAccent * exp(-rr * rr / (uCore * uCore * 5.0)) * 0.70;
  col += uHigh * exp(-rr * rr / (uCore * uCore * 0.30)) * 0.50;
  gl_FragColor = vec4(clamp(uBg + col * uPower, 0.0, 1.0), 1.0);
}
`

const hex = (s, fb) => {
  if (!s || s[0] !== '#') return fb
  let h = s.slice(1)
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
}
const clampN = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

export function mountPrismBurst(root, init = {}) {
  const props = {
    background: '#080620',
    baseColor: '#3E2FA6',
    accentColor: '#9A78FF',
    highlight: '#FFFFFF',
    rays: 120,
    speed: 100,
    hover: 200,
    reach: 31,
    burst: { dispersion: 100, core: 15, falloff: 80, bend: 130 },
    center: [-0.05, 0],
    power: 1,
    ...init,
  }
  props.burst = { dispersion: 100, core: 15, falloff: 80, bend: 130, ...init.burst }
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'
  root.append(canvas)
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false })
  if (!gl) return { props, destroy() {} }
  const mk = (type, s) => {
    const sh = gl.createShader(type)
    gl.shaderSource(sh, s)
    gl.compileShader(sh)
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
  const locs = {}
  const u = (n) => (n in locs ? locs[n] : (locs[n] = gl.getUniformLocation(prog, n)))
  const ptr = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, on: 0, onTarget: 0 }
  const track = (e) => {
    const r = canvas.getBoundingClientRect()
    if (r.width <= 0 || e.clientY < r.top || e.clientY > r.bottom) return void (ptr.onTarget = 0)
    ptr.tx = clampN((e.clientX - r.left) / r.width, 0, 1)
    ptr.ty = clampN((e.clientY - r.top) / r.height, 0, 1)
    ptr.onTarget = 1
  }
  addEventListener('pointermove', track, { passive: true })
  let visible = true
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
  io.observe(root)
  let raf = 0
  let last = performance.now()
  let clock = 0
  const render = (now) => {
    raf = requestAnimationFrame(render)
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (!visible) return
    clock = (clock + dt * (clampN(props.speed, 0, 100) / 50)) % 3600
    const k = 1 - Math.exp(-6 * dt)
    ptr.on += (ptr.onTarget - ptr.on) * k
    ptr.x += ((ptr.onTarget > 0 ? ptr.tx : 0.5) - ptr.x) * k
    ptr.y += ((ptr.onTarget > 0 ? ptr.ty : 0.5) - ptr.y) * k
    const dpr = Math.min(devicePixelRatio || 1, MAX_DPR)
    const bw = Math.max(1, Math.round((canvas.clientWidth || 1200) * dpr))
    const bh = Math.max(1, Math.round((canvas.clientHeight || 800) * dpr))
    if (canvas.width !== bw || canvas.height !== bh) ((canvas.width = bw), (canvas.height = bh))
    gl.viewport(0, 0, bw, bh)
    const b = props.burst
    gl.uniform2f(u('uRes'), bw, bh)
    gl.uniform1f(u('uTime'), clock)
    gl.uniform2f(u('uMouse'), ptr.x, 1 - ptr.y)
    gl.uniform1f(u('uHover'), Math.min(1, ptr.on) * (clampN(props.hover, 0, 200) / 100))
    gl.uniform2f(u('uCenter'), props.center[0], props.center[1])
    gl.uniform1f(u('uPower'), props.power)
    gl.uniform3f(u('uBg'), ...hex(props.background, [0.03, 0.02, 0.12]))
    gl.uniform3f(u('uBase'), ...hex(props.baseColor, [0.24, 0.18, 0.65]))
    gl.uniform3f(u('uAccent'), ...hex(props.accentColor, [0.6, 0.47, 1]))
    gl.uniform3f(u('uHigh'), ...hex(props.highlight, [1, 1, 1]))
    gl.uniform1f(u('uRays'), clampN(props.rays, 10, 120) / 10)
    gl.uniform1f(u('uReach'), clampN(props.reach, 5, 100) / 100)
    gl.uniform1f(u('uDisp'), clampN(b.dispersion, 0, 300) / 100)
    gl.uniform1f(u('uCore'), clampN(b.core, 5, 60) / 100)
    gl.uniform1f(u('uFall'), clampN(b.falloff, 20, 300) / 100)
    gl.uniform1f(u('uBend'), clampN(b.bend, 0, 400) / 100)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
  raf = requestAnimationFrame(render)
  return {
    props,
    destroy() {
      cancelAnimationFrame(raf)
      io.disconnect()
      removeEventListener('pointermove', track)
      canvas.remove()
    },
  }
}
