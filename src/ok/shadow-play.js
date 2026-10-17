// Shadow Play — after Originkit's shadow-play (originkit.dev), ported to a
// plain module. Headline text where every pixel marches a ray toward a light,
// so the letterforms throw soft volumetric shadows with a spectral fringe —
// here, light coming through stained glass.
//
// mountShadowPlay(root, props) → { props, destroy }. Extra over the
// original: with no pointer (touch, or the pointer elsewhere) the light
// drifts on its own along props.auto(t) → [x, y] in 0..1 of the box, and
// props.power (0..1) dims the whole effect for scroll fades.

const VERT = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`

const FRAG = (samples) => `
precision highp float;
uniform vec2 resolution;
uniform vec2 mouse;
uniform sampler2D src;
uniform vec3 textColor;
uniform vec3 bgColor;
uniform float lightSize;
uniform float lightFalloff;
uniform float shadowStrength;
uniform float rainbow;
uniform float dither;
uniform vec3 shadowColor;
uniform float lightActive;

#define PI 3.141593
#define SAMPLES ${samples.toFixed(1)}

float hash(vec2 p) { return fract(sin(dot(p, vec2(489., 589.))) * 492.) * 2. - 1.; }
float hash(vec3 p) { return fract(sin(dot(p, vec3(489., 589., 58.))) * 492.) * 2. - 1.; }
vec2 hash2(vec3 p) { return vec2(hash(p), hash(p + 1.)); }
vec4 readTex(vec2 uv) {
  if (uv.x < 0. || uv.x > 1. || uv.y < 0. || uv.y > 1.) { return vec4(0); }
  return texture2D(src, uv);
}
vec3 spectrum(float x) { return cos((x - vec3(0, .5, 1)) * vec3(.6, 1., .5) * PI); }

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  float mask = readTex(uv).r;
  if (mask > 0.995) { gl_FragColor = vec4(textColor, 1.0); return; }
  vec2 p = uv * 2. - 1.;
  p.x *= resolution.x / resolution.y;
  vec2 mp = mouse / resolution;
  mp = mp * 2. - 1.;
  mp.x *= resolution.x / resolution.y;
  vec2 rp = p;
  vec2 d = (mp - p) / SAMPLES;
  float acc = 0.;
  for (float i = 0.; i < SAMPLES; i++) {
    rp += d;
    rp += hash2(vec3(rp, i)) * 0.5 / SAMPLES;
    vec2 uv2 = rp;
    uv2.x /= resolution.x / resolution.y;
    uv2 = uv2 * 0.5 + 0.5;
    acc += readTex(uv2).r / SAMPLES;
  }
  float lm = length(p - mp);
  float falloff = smoothstep(0., 1., pow(lightSize / lm, lightFalloff));
  float shade = acc * shadowStrength * falloff * lightActive;
  vec3 rainbowCol = spectrum(cos(acc * 3.5)) * acc * rainbow * falloff * lightActive;
  vec3 c = shadowColor * shade + rainbowCol;
  c -= hash(vec3(uv.xyy)) * dither;
  float a = clamp(shade + acc * rainbow * falloff * lightActive, 0.0, 1.0);
  vec3 col = mix(bgColor, clamp(c, 0.0, 1.0), a);
  gl_FragColor = vec4(mix(col, textColor, mask), 1.0);
}
`

export const SHADOW_DEFAULTS = {
  text: 'Thru.',
  font: { fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.03em' },
  textColor: '#ffffff',
  backgroundColor: '#000000',
  shadowColor: '#000000',
  fitToWidth: true,
  fitPadding: 8,
  align: 'center',
  lightX: 50,
  lightY: 30,
  followEase: 12,
  lightSize: 10,
  lightFalloff: 60,
  shadowStrength: 100,
  rainbow: 250,
  dither: 1,
  samples: 64,
  quality: 100,
  power: 1,
  auto: null,
}

let probeCtx = null
function parseColor(css, fallback) {
  if (!probeCtx) {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 1
    probeCtx = cv.getContext('2d', { willReadFrequently: true })
  }
  try {
    probeCtx.clearRect(0, 0, 1, 1)
    probeCtx.fillStyle = '#000'
    probeCtx.fillStyle = css
    probeCtx.fillRect(0, 0, 1, 1)
    const d = probeCtx.getImageData(0, 0, 1, 1).data
    return [d[0] / 255, d[1] / 255, d[2] / 255]
  } catch {
    return fallback
  }
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean)
  if (!words.length) return [text]
  const lines = []
  let current = ''
  // A word is never broken (文化世界의 stays whole); the fit shrinks the
  // type until every word fits its line instead.
  const place = (word) => {
    if (current === '') return void (current = word)
    if (ctx.measureText(`${current} ${word}`).width <= maxWidth) current = `${current} ${word}`
    else {
      lines.push(current)
      current = ''
      place(word)
    }
  }
  for (const word of words) place(word)
  if (current !== '') lines.push(current)
  return lines.length ? lines : [text]
}

export function mountShadowPlay(root, init = {}) {
  const props = { ...SHADOW_DEFAULTS, ...init }
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'
  root.append(canvas)
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false })
  if (!gl) return { props, destroy() {} }

  const samples = Math.max(4, Math.min(160, Math.round(props.samples)))
  const mk = (type, srcText) => {
    const s = gl.createShader(type)
    gl.shaderSource(s, srcText)
    gl.compileShader(s)
    return s
  }
  const prog = gl.createProgram()
  gl.attachShader(prog, mk(gl.VERTEX_SHADER, VERT))
  gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, FRAG(samples)))
  gl.linkProgram(prog)
  gl.useProgram(prog)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'position')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  const tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  const U = {}
  for (const n of ['resolution', 'mouse', 'src', 'textColor', 'bgColor', 'lightSize', 'lightFalloff', 'shadowStrength', 'rainbow', 'dither', 'shadowColor', 'lightActive'])
    U[n] = gl.getUniformLocation(prog, n)

  const size = { w: 0, h: 0, dpr: 1 }
  const mask = document.createElement('canvas')
  let maskKey = ''

  const drawMask = () => {
    const { w, h, dpr } = size
    if (w <= 0 || h <= 0) return
    mask.width = Math.max(1, Math.round(w * dpr))
    mask.height = Math.max(1, Math.round(h * dpr))
    const ctx = mask.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, w, h)
    const f = props.font || {}
    const family = f.fontFamily || 'Inter, system-ui, sans-serif'
    const weight = f.fontWeight || 900
    const styleStr = f.fontStyle || 'normal'
    const lineHeight = typeof f.lineHeight === 'number' ? f.lineHeight : parseFloat(f.lineHeight) || 1
    const fontStr = (s) => `${styleStr} ${weight} ${s}px ${family}`
    const ls = f.letterSpacing
    const applyFont = (s) => {
      ctx.font = fontStr(s)
      if (typeof ls === 'string' && 'letterSpacing' in ctx) ctx.letterSpacing = ls.endsWith('em') ? `${parseFloat(ls) * s}px` : ls
    }
    const hardLines = String(props.text ?? '').split('\n')
    const inset = Math.max(0, Math.min(45, props.fitPadding)) / 50
    const availW = Math.max(1, w * (1 - inset))
    const availH = Math.max(1, h * (1 - inset))
    const layout = (s) => {
      applyFont(s)
      // hard lines stay as written: no wrapping inside them
      const wrapped = hardLines
      let widest = 0
      for (const l of wrapped) widest = Math.max(widest, ctx.measureText(l).width)
      return { wrapped, widest, height: s * lineHeight * wrapped.length }
    }
    let s = Math.max(10, h * 0.4)
    if (props.fitToWidth) {
      const fits = (v) => {
        const l = layout(v)
        return l.widest <= availW && l.height <= availH
      }
      let lo = 10
      let hi = Math.max(11, availH / Math.max(0.1, lineHeight))
      if (fits(hi)) lo = hi
      else
        for (let i = 0; i < 22; i++) {
          const mid = (lo + hi) / 2
          if (fits(mid)) lo = mid
          else hi = mid
        }
      s = lo
    }
    const { wrapped } = layout(s)
    ctx.fillStyle = '#fff'
    ctx.textBaseline = 'middle'
    ctx.textAlign = props.align
    const boxLeft = (w - availW) / 2
    const x = props.align === 'left' ? boxLeft : props.align === 'right' ? boxLeft + availW : w / 2
    const lh = s * lineHeight
    const total = lh * wrapped.length
    wrapped.forEach((ln, i) => ctx.fillText(ln, x, h / 2 - total / 2 + lh * (i + 0.5)))
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mask)
  }

  const resize = () => {
    const r = root.getBoundingClientRect()
    const w = Math.max(1, Math.round(r.width))
    const h = Math.max(1, Math.round(r.height))
    const q = Math.max(25, Math.min(100, props.quality)) / 100
    size.w = w
    size.h = h
    size.dpr = Math.min(devicePixelRatio || 1, 2) * q
    canvas.width = Math.max(1, Math.round(w * size.dpr))
    canvas.height = Math.max(1, Math.round(h * size.dpr))
    gl.viewport(0, 0, canvas.width, canvas.height)
    maskKey = ''
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(root)
  document.fonts?.ready.then(() => (maskKey = ''))

  const target = { x: (props.lightX / 100) * size.w, y: (1 - props.lightY / 100) * size.h }
  const light = { ...target }
  let pointerOn = false
  let lastMove = 0
  const onMove = (e) => {
    const r = root.getBoundingClientRect()
    if (e.clientY < r.top || e.clientY > r.bottom) return
    pointerOn = true
    lastMove = performance.now()
    target.x = e.clientX - r.left
    target.y = r.height - (e.clientY - r.top)
  }
  addEventListener('pointermove', onMove, { passive: true })
  let visible = true
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
  io.observe(root)

  let raf = 0
  let act = 0
  const t0 = performance.now()
  const tick = (now) => {
    raf = requestAnimationFrame(tick)
    if (!visible) return
    const key = `${props.text}|${JSON.stringify(props.font)}|${size.w}x${size.h}`
    if (key !== maskKey) {
      maskKey = key
      drawMask()
    }
    // The pointer leads while it moves; otherwise the light drifts by itself.
    if (pointerOn && now - lastMove > 4000) pointerOn = false
    if (!pointerOn && props.auto) {
      const [ax, ay] = props.auto((now - t0) / 1000)
      target.x = ax * size.w
      target.y = (1 - ay) * size.h
    }
    const k = Math.max(1, Math.min(100, props.followEase)) / 100
    light.x += (target.x - light.x) * k
    light.y += (target.y - light.y) * k
    act += ((pointerOn || props.auto ? 1 : 0) * props.power - act) * 0.08
    const tc = parseColor(props.textColor, [1, 1, 1])
    const bc = parseColor(props.backgroundColor, [0, 0, 0])
    const sc = parseColor(props.shadowColor, [0, 0, 0])
    gl.useProgram(prog)
    gl.uniform2f(U.resolution, canvas.width, canvas.height)
    gl.uniform2f(U.mouse, light.x * (canvas.width / Math.max(1, size.w)), light.y * (canvas.height / Math.max(1, size.h)))
    gl.uniform3f(U.textColor, ...tc)
    gl.uniform3f(U.bgColor, ...bc)
    gl.uniform3f(U.shadowColor, ...sc)
    gl.uniform1f(U.lightActive, act)
    gl.uniform1f(U.lightSize, Math.max(0.001, props.lightSize / 100))
    gl.uniform1f(U.lightFalloff, Math.max(0.01, props.lightFalloff / 100))
    gl.uniform1f(U.shadowStrength, props.shadowStrength / 100)
    gl.uniform1f(U.rainbow, props.rainbow / 100)
    gl.uniform1f(U.dither, props.dither / 100)
    gl.uniform1i(U.src, 0)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
  raf = requestAnimationFrame(tick)

  return {
    props,
    destroy() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      removeEventListener('pointermove', onMove)
      canvas.remove()
    },
  }
}
