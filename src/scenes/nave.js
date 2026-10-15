import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { GLASS_GLSL } from './glass.js'
import { pixelRatio, tier } from '../device.js'

// The opening: inside 평화의전당 at night, looking down the nave to the rose
// window. Light comes through the glass in coloured shafts, falls on the
// floor as the window's own pattern, and lights the dust. The pointer moves
// the light; scroll walks the camera up the nave into the window's glow.

const W_Z = -32 // the end wall
const ROSE = { x: 0, y: 15.2, r: 6.2 }
const SPOKES = 16
const LANCET = { y0: 2.4, y1: 9.4, w: 1.15, gap: 0.42, n: 5 }

// Light travels from the window toward the viewer and down.
const lightDir = new THREE.Vector3()

const SHARED = /* glsl */ `
uniform vec3 uL;
uniform float uTime;
uniform float uReveal;
uniform float uPower;
${GLASS_GLSL}
// Where the light reaching P passed through the end wall, and what colour
// the glass gave it there (rose or lancets), with its strength.
vec4 throughWindow(vec3 P) {
  float t = (P.z - (${W_Z.toFixed(1)})) / max(uL.z, 1e-3);
  vec3 W = P - uL * t;
  vec2 ruv = (W.xy - vec2(${ROSE.x.toFixed(2)}, ${ROSE.y.toFixed(2)})) / ${ROSE.r.toFixed(2)};
  vec4 g = vec4(0.0);
  float rr = length(ruv);
  if (rr < 1.0) {
    g = roseGlass(ruv, ${SPOKES.toFixed(1)}, uTime);
    g.a *= smoothstep(uReveal * 1.25 - 0.05, uReveal * 1.25 - 0.25, rr);
  } else {
    float span = ${(LANCET.n * LANCET.w + (LANCET.n - 1) * LANCET.gap).toFixed(3)};
    float lx = W.x + span * 0.5;
    float pitch = ${(LANCET.w + LANCET.gap).toFixed(3)};
    float idx = floor(lx / pitch);
    float fx = (lx - idx * pitch) / ${LANCET.w.toFixed(3)};
    float fy = (W.y - ${LANCET.y0.toFixed(2)}) / ${(LANCET.y1 - LANCET.y0).toFixed(2)};
    if (idx >= 0.0 && idx < ${LANCET.n.toFixed(1)} && fx < 1.0 && fy > 0.0 && fy < 1.0) {
      // pointed head
      float head = fy > 0.86 ? step(abs(fx - 0.5), 0.5 * (1.0 - (fy - 0.86) / 0.14)) : 1.0;
      g = lancetGlass(vec2(fx, fy), idx) * vec4(0.8, 0.8, 0.8, head);
      g.a *= smoothstep(uReveal * 1.6 - 0.1, uReveal * 1.6 - 0.4, 1.0 - fy * 0.5);
    }
  }
  return g;
}
`

function pointedArch(w, h, spring) {
  // A pointed (equilateral) arch outline, as a Shape, base at y=0.
  const s = new THREE.Shape()
  const r = w
  s.moveTo(-w / 2, 0)
  s.lineTo(-w / 2, spring)
  s.absarc(w / 2, spring, r, Math.PI, Math.PI - Math.acos(0.5), true)
  s.absarc(-w / 2, spring, r, Math.acos(0.5), 0, true)
  s.lineTo(w / 2, 0)
  s.lineTo(-w / 2, 0)
  return s
}

export class Nave {
  constructor(canvas) {
    this.canvas = canvas
    this.progress = 0
    this.reveal = 0
    this.flare = 0
    this.pointer = new THREE.Vector2()
    this.ptrSmooth = new THREE.Vector2()
    this.time = 0

    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }))
    r.setPixelRatio(pixelRatio(1.25, 1.5))
    r.toneMapping = THREE.ACESFilmicToneMapping
    r.toneMappingExposure = 1.0
    const scene = (this.scene = new THREE.Scene())
    scene.background = new THREE.Color('#06040a')
    scene.fog = new THREE.FogExp2('#0b0710', 0.011)
    const cam = (this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200))
    cam.position.set(0, 2.2, 16)

    const u = (this.u = {
      uL: { value: lightDir },
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uPower: { value: 1 },
    })

    /* --- the end wall with its rose and lancets --- */
    const stone = new THREE.MeshStandardMaterial({ color: '#4a4048', roughness: 0.92, metalness: 0 })
    const stoneDark = new THREE.MeshStandardMaterial({ color: '#2a2329', roughness: 0.95 })
    const wallShape = new THREE.Shape()
    wallShape.moveTo(-9, 0)
    wallShape.lineTo(9, 0)
    wallShape.lineTo(9, 26)
    wallShape.lineTo(-9, 26)
    wallShape.lineTo(-9, 0)
    const roseHole = new THREE.Path()
    roseHole.absarc(ROSE.x, ROSE.y, ROSE.r + 0.15, 0, Math.PI * 2, true)
    wallShape.holes.push(roseHole)
    const span = LANCET.n * LANCET.w + (LANCET.n - 1) * LANCET.gap
    for (let i = 0; i < LANCET.n; i++) {
      const x0 = -span / 2 + i * (LANCET.w + LANCET.gap)
      const h = new THREE.Path()
      const top = LANCET.y1 - LANCET.w * 0.9
      h.moveTo(x0, LANCET.y0)
      h.lineTo(x0 + LANCET.w, LANCET.y0)
      h.lineTo(x0 + LANCET.w, top)
      h.quadraticCurveTo(x0 + LANCET.w, LANCET.y1 - 0.25, x0 + LANCET.w / 2, LANCET.y1)
      h.quadraticCurveTo(x0, LANCET.y1 - 0.25, x0, top)
      h.lineTo(x0, LANCET.y0)
      wallShape.holes.push(h)
    }
    const wall = new THREE.Mesh(new THREE.ExtrudeGeometry(wallShape, { depth: 1.2, bevelEnabled: false, curveSegments: 48 }), stone)
    wall.position.z = W_Z - 0.6
    scene.add(wall)

    // Glass, just behind the wall: unlit, bright, the same function as the floor.
    const glassMat = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        varying vec3 vW;
        ${SHARED}
        void main(){
          // Seen face-on: sample the glass where this fragment is.
          vec3 P = vec3(vW.xy, ${W_Z.toFixed(1)});
          vec3 L0 = uL; // unused here, the window is read straight
          vec2 ruv = (P.xy - vec2(${ROSE.x.toFixed(2)}, ${ROSE.y.toFixed(2)})) / ${ROSE.r.toFixed(2)};
          vec4 g = throughWindow(P + uL * 0.0);
          float sunny = 0.75 + 0.5 * smoothstep(-0.4, 0.6, dot(normalize(vec2(-uL.x, uL.y)), normalize(ruv + 1e-4)));
          float flick = 0.92 + 0.08 * sin(uTime * 1.3 + vW.x * 2.0 + vW.y);
          vec3 c = g.rgb * g.a * (1.35 * sunny * flick) * uPower;
          gl_FragColor = vec4(c, 1.0);
        }`,
    })
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(18, 26), glassMat)
    glass.position.set(0, 13, W_Z - 0.75)
    scene.add(glass)

    // Tracery in front of the rose: rings, spokes, petal roundels.
    const trace = new THREE.Group()
    const add = (geo, x, y, rz = 0, mat = stoneDark) => {
      const m = new THREE.Mesh(geo, mat)
      m.position.set(x, y, 0)
      m.rotation.z = rz
      trace.add(m)
      return m
    }
    add(new THREE.TorusGeometry(ROSE.r, 0.28, 10, 96), ROSE.x, ROSE.y)
    add(new THREE.TorusGeometry(ROSE.r * 0.84, 0.13, 8, 96), ROSE.x, ROSE.y)
    add(new THREE.TorusGeometry(ROSE.r * 0.46, 0.14, 8, 72), ROSE.x, ROSE.y)
    add(new THREE.TorusGeometry(ROSE.r * 0.16, 0.12, 8, 48), ROSE.x, ROSE.y)
    for (let i = 0; i < SPOKES; i++) {
      const a = (i / SPOKES) * Math.PI * 2
      const len = ROSE.r * 0.68
      const mid = ROSE.r * 0.5
      add(new THREE.BoxGeometry(0.11, len, 0.16), ROSE.x + Math.cos(a) * mid, ROSE.y + Math.sin(a) * mid, a - Math.PI / 2)
      // petal roundels between the spokes on the outer ring
      const b = a + Math.PI / SPOKES
      add(new THREE.TorusGeometry(ROSE.r * 0.075, 0.06, 6, 24), ROSE.x + Math.cos(b) * ROSE.r * 0.92, ROSE.y + Math.sin(b) * ROSE.r * 0.92)
      // trefoil heads at the inner ring
      add(new THREE.TorusGeometry(ROSE.r * 0.09, 0.05, 6, 24, Math.PI), ROSE.x + Math.cos(b) * ROSE.r * 0.74, ROSE.y + Math.sin(b) * ROSE.r * 0.74, b - Math.PI / 2)
    }
    trace.position.z = W_Z + 0.65
    scene.add(trace)
    // A pointed arch framing the rose, and the gable above.
    const frame = new THREE.Mesh(new THREE.TorusGeometry(ROSE.r + 1.1, 0.35, 8, 64, Math.PI), stone)
    frame.position.set(ROSE.x, ROSE.y, W_Z + 0.5)
    scene.add(frame)

    /* --- the nave: clustered piers, arcades, vault ribs --- */
    const piers = new THREE.Group()
    const pierGeo = (() => {
      const parts = []
      const core = new THREE.CylinderGeometry(0.62, 0.7, 13, 16)
      parts.push(core)
      for (let k = 0; k < 4; k++) {
        const s = new THREE.CylinderGeometry(0.22, 0.24, 13, 10)
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4
        s.translate(Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62)
        parts.push(s)
      }
      return parts
    })()
    const capital = new THREE.CylinderGeometry(0.98, 0.78, 0.5, 16)
    const base = new THREE.CylinderGeometry(0.95, 1.05, 0.6, 16)
    // A pointed barrel vault: two arcs of radius R springing at x = ±7.2.
    const VAULT = { R: 9, y: 13, c: 9 - 7.2 }
    VAULT.a = Math.acos(VAULT.c / VAULT.R) // arc sweep from springer to apex
    const ribGeo = new THREE.TorusGeometry(VAULT.R, 0.2, 6, 28, VAULT.a)
    {
      const arc = []
      const n = 24
      for (let i = 0; i <= n; i++) {
        const t = Math.PI - (i / n) * VAULT.a // left half, springer → apex
        arc.push([VAULT.c + Math.cos(t) * VAULT.R, VAULT.y + Math.sin(t) * VAULT.R])
      }
      const full = [...arc, ...arc.slice(0, -1).reverse().map(([x, y]) => [-x, y])]
      const shape = new THREE.Shape()
      full.forEach(([x, y], i) => (i ? shape.lineTo(x, y + 0.6) : shape.moveTo(x, y + 0.6)))
      for (let i = full.length - 1; i >= 0; i--) shape.lineTo(full[i][0], full[i][1])
      const shell = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 60, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: '#3a3036', roughness: 1, side: THREE.DoubleSide }))
      shell.position.z = W_Z - 0.6
      scene.add(shell)
    }
    for (let z = W_Z + 4; z < 26; z += 5.2) {
      for (const sx of [-1, 1]) {
        const g = new THREE.Group()
        for (const p of pierGeo) g.add(new THREE.Mesh(p, stone))
        const cap = new THREE.Mesh(capital, stone)
        cap.position.y = 6.6
        const bs = new THREE.Mesh(base, stone)
        bs.position.y = -6.2
        g.add(cap, bs)
        g.position.set(sx * 7.2, 6.5, z)
        piers.add(g)
      }
      // pointed transverse ribs across the vault (two arcs meeting at the apex)
      const ribL = new THREE.Mesh(ribGeo, stoneDark)
      ribL.position.set(VAULT.c, VAULT.y, z)
      ribL.rotation.z = Math.PI - VAULT.a
      const ribR = new THREE.Mesh(ribGeo, stoneDark)
      ribR.position.set(-VAULT.c, VAULT.y, z)
      piers.add(ribL, ribR)
    }
    // arcades along each side (pointed arches between piers)
    const arcShape = pointedArch(4.4, 0.5, 0)
    const arcGeo = new THREE.ExtrudeGeometry(arcShape, { depth: 0.6, bevelEnabled: false, curveSegments: 16 })
    for (let z = W_Z + 6.6; z < 26; z += 5.2) {
      for (const sx of [-1, 1]) {
        const a = new THREE.Mesh(arcGeo, stoneDark)
        a.scale.set(1, 1, 1)
        a.rotation.y = Math.PI / 2
        a.position.set(sx * 7.5, 7.4, z)
        piers.add(a)
      }
    }
    scene.add(piers)
    // side walls with tall clerestory lancets in deep blue
    const side = new THREE.MeshStandardMaterial({ color: '#1d181d', roughness: 1 })
    for (const sx of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(60, 26), side)
      w.rotation.y = -sx * Math.PI / 2
      w.position.set(sx * 9.5, 13, -2)
      scene.add(w)
    }
    const clereMat = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        ${SHARED}
        void main(){
          float head = vUv.y > 0.85 ? step(abs(vUv.x - 0.5), 0.5 * (1.0 - (vUv.y - 0.85) / 0.15)) : 1.0;
          vec4 g = lancetGlass(vUv, floor(gl_FragCoord.x * 0.0) + 3.0);
          vec3 c = mix(g.rgb, vec3(0.08, 0.16, 0.5), 0.55) * g.a * head * 0.9 * uReveal * uPower;
          gl_FragColor = vec4(c, 1.0);
        }`,
    })
    for (let z = W_Z + 6.6; z < 22; z += 5.2)
      for (const sx of [-1, 1]) {
        const c = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 5.2), clereMat)
        c.rotation.y = -sx * Math.PI / 2
        c.position.set(sx * 9.45, 15.5, z)
        scene.add(c)
      }

    /* --- the floor, catching the window's colours --- */
    const floorMat = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        varying vec3 vW;
        ${SHARED}
        void main(){
          // polished stone, a chequer of two marbles
          vec2 tile = floor(vW.xz / 1.6);
          float chk = mod(tile.x + tile.y, 2.0);
          vec2 f = fract(vW.xz / 1.6);
          float joint = smoothstep(0.0, 0.03, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
          vec3 base = mix(vec3(0.05, 0.045, 0.05), vec3(0.09, 0.075, 0.07), chk) * (0.7 + 0.3 * joint);
          // the window's light, landing here
          vec4 g = (throughWindow(vW) + throughWindow(vW + vec3(0.09, 0.0, 0.05)) + throughWindow(vW + vec3(-0.06, 0.0, -0.08))) / 3.0;
          float dist = length(vW.xz - vec2(0.0, ${W_Z.toFixed(1)}));
          vec3 pool = g.rgb * (0.25 + 0.75 * g.a) * step(0.001, g.a + length(g.rgb)) * 0.75 * smoothstep(4.0, 12.0, dist);
          // soften: light spreads a little on polished stone
          vec3 c = base * 0.6 + pool * (0.55 + 0.45 * joint) * uPower;
          // a faint sheen toward the window
          c += vec3(0.06, 0.04, 0.05) * pow(max(0.0, 1.0 - abs(vW.x) / 9.0), 2.0) * smoothstep(30.0, 0.0, dist) * uReveal;
          gl_FragColor = vec4(c, 1.0);
        }`,
    })
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(19, 70), floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.position.set(0, 0, -2)
    scene.add(floor)

    /* --- the shafts: open cones from the window along the light --- */
    const shaftMat = new THREE.ShaderMaterial({
      uniforms: u,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `varying vec3 vW; varying float vH; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vH = uv.y; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        varying vec3 vW; varying float vH;
        ${SHARED}
        float n3(vec3 p){ return fract(sin(dot(floor(p), vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        void main(){
          vec4 g = throughWindow(vW);
          float mist = 0.65 + 0.35 * sin(vW.y * 0.8 + vW.z * 0.4 + uTime * 0.6) * sin(vW.x * 0.7 - uTime * 0.4);
          float fade = smoothstep(0.0, 0.25, vH) * smoothstep(1.0, 0.55, vH);
          vec3 c = g.rgb * g.a * 0.03 * mist * fade * uPower;
          gl_FragColor = vec4(c, 1.0);
        }`,
    })
    this.shafts = []
    for (let i = 0; i < 6; i++) {
      // several nested sheets make the beam read as a volume
      const k = i / 5
      const geo = new THREE.CylinderGeometry(ROSE.r * (0.55 + 0.45 * k), ROSE.r * (0.55 + 0.45 * k) * 1.05, 1, 48, 1, true)
      geo.translate(0, -0.5, 0)
      const m = new THREE.Mesh(geo, shaftMat)
      m.frustumCulled = false
      scene.add(m)
      this.shafts.push(m)
    }
    const lanShaft = new THREE.Mesh(new THREE.BoxGeometry(span, 1, LANCET.y1 - LANCET.y0), shaftMat)
    lanShaft.geometry.translate(0, -0.5, 0)
    lanShaft.frustumCulled = false
    scene.add(lanShaft)
    this.lanShaft = lanShaft

    /* --- dust in the light --- */
    const N = tier(2600, 1200)
    const pos = new Float32Array(N * 3)
    const seed = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 17
      pos[i * 3 + 1] = Math.random() * 20
      pos[i * 3 + 2] = W_Z + 1 + Math.random() * 44
      seed[i] = Math.random()
    }
    const dg = new THREE.BufferGeometry()
    dg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    dg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    const dustMat = new THREE.ShaderMaterial({
      uniforms: { ...u, uPx: { value: r.getPixelRatio() } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aSeed; uniform float uTime; uniform float uPx; varying vec3 vW; varying float vS;
        void main(){
          vec3 p = position;
          p.y = mod(p.y + uTime * (0.05 + aSeed * 0.12), 20.0);
          p.x += sin(uTime * 0.3 + aSeed * 40.0) * 0.4;
          p.z += cos(uTime * 0.21 + aSeed * 23.0) * 0.4;
          vW = p; vS = aSeed;
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uPx * (1.2 + aSeed * 2.4) * 22.0 / max(-mv.z, 0.5);
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vW; varying float vS;
        ${SHARED}
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          vec4 g = throughWindow(vW);
          float tw = 0.6 + 0.4 * sin(uTime * (1.0 + vS * 3.0) + vS * 50.0);
          vec3 c = (g.rgb * 1.6 + 0.25) * g.a * a * tw * 0.8 * uPower;
          gl_FragColor = vec4(c, 1.0);
        }`,
    })
    scene.add(new THREE.Points(dg, dustMat))

    /* --- light on the stone --- */
    scene.add(new THREE.AmbientLight('#2a1a2a', 0.5))
    const key = (this.key = new THREE.DirectionalLight('#ffd9b0', 0))
    key.position.set(0, 20, W_Z - 10)
    key.target.position.set(0, 0, 10)
    scene.add(key, key.target)
    const red = (this.red = new THREE.PointLight('#c8102e', 0, 40, 1.4))
    red.position.set(-5, 12, W_Z + 6)
    const blue = (this.blue = new THREE.PointLight('#2a4dff', 0, 40, 1.4))
    blue.position.set(5, 12, W_Z + 6)
    const gold = (this.gold = new THREE.PointLight('#ffbf5a', 0, 30, 1.6))
    gold.position.set(0, 4, W_Z + 10)
    scene.add(red, blue, gold)

    /* --- post: god rays from the window, bloom --- */
    const composer = (this.composer = new EffectComposer(r))
    composer.addPass(new RenderPass(scene, cam))
    this.rays = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uSun: { value: new THREE.Vector2(0.5, 0.7) }, uStrength: { value: 0.3 }, uThresh: { value: 1.0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse; uniform vec2 uSun; uniform float uStrength; uniform float uThresh; varying vec2 vUv;
        void main(){
          vec3 base = texture2D(tDiffuse, vUv).rgb;
          vec2 d = (vUv - uSun) / 48.0;
          vec2 uv = vUv;
          vec3 acc = vec3(0.0);
          float w = 1.0;
          for (int i = 0; i < 48; i++) {
            uv -= d;
            vec3 s = texture2D(tDiffuse, uv).rgb;
            acc += max(s - uThresh, 0.0) * w;
            w *= 0.965;
          }
          gl_FragColor = vec4(base + acc * uStrength / 48.0, 1.0);
        }`,
    })
    composer.addPass(this.rays)
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.55, 0.82)
    composer.addPass(this.bloom)
    composer.addPass(new OutputPass())

    addEventListener('pointermove', (e) => this.pointer.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1), { passive: true })
    this.resize()
    addEventListener('resize', () => this.resize())
  }

  resize() {
    const w = this.canvas.clientWidth || innerWidth
    const h = this.canvas.clientHeight || innerHeight
    if (w === this._w && h === this._h) return
    this._w = w
    this._h = h
    this.renderer.setSize(w, h, false)
    this.composer.setSize(w, h)
    this.bloom.resolution.set(w / 2, h / 2)
    this.camera.aspect = w / h
    // narrow screens: step back so the rose fits
    this.camera.fov = w / h < 0.8 ? 64 : 50
    this.camera.updateProjectionMatrix()
  }

  render(dt) {
    this.resize()
    this.time += dt
    const p = this.progress
    const e = p * p * (3 - 2 * p)
    this.ptrSmooth.lerp(this.pointer, Math.min(1, dt * 2.5))
    const px = this.ptrSmooth.x
    const py = this.ptrSmooth.y
    // The light leans with the pointer: the floor's pattern slides across.
    lightDir.set(-px * 0.38, -0.42 - py * 0.12, 1).normalize()
    const u = this.u
    u.uTime.value = this.time
    u.uReveal.value = this.reveal
    u.uPower.value = 1 + this.flare * 1.0 + e * 0.25
    // Shafts run along the light from the rose and the lancets.
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), lightDir)
    const len = 60
    for (const s of this.shafts) {
      s.position.set(ROSE.x, ROSE.y, W_Z - 0.3)
      s.quaternion.copy(q)
      s.scale.set(1, len, 1)
    }
    this.lanShaft.position.set(0, (LANCET.y0 + LANCET.y1) / 2, W_Z - 0.3)
    this.lanShaft.quaternion.copy(q)
    this.lanShaft.scale.set(1, len, 1)
    // Stone catches a little of the colour.
    const lit = this.reveal
    this.key.intensity = 0.55 * lit
    this.red.intensity = 70 * lit
    this.blue.intensity = 60 * lit
    this.gold.intensity = 60 * lit
    // Camera: a slow walk up the nave, rising toward the rose.
    const cam = this.camera
    const z = 16 - e * 30
    cam.position.set(px * 0.6, 2.2 + e * 7.5 - py * 0.3, z)
    cam.lookAt(px * -0.8, 9.5 + e * 5.2, W_Z)
    // god rays come from the rose on screen
    const sun = new THREE.Vector3(ROSE.x, ROSE.y, W_Z).project(cam)
    this.rays.uniforms.uSun.value.set(sun.x * 0.5 + 0.5, sun.y * 0.5 + 0.5)
    this.rays.uniforms.uStrength.value = (0.28 + e * 0.35 + this.flare * 0.6) * this.reveal
    this.renderer.toneMappingExposure = 1 + this.flare * 0.8 + Math.pow(e, 4) * 2.2
    this.composer.render(dt)
  }
}
