import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { GLASS_GLSL } from './glass.js'
import { stoneMaterial } from './stone.js'
import { buildPlaza } from './plaza.js'
import { pixelRatio, tier } from '../device.js'

// 평화의전당 (Grand Peace Palace) by night, modelled after photographs: two
// square granite towers with buttressed corners, pinnacles and crenellated
// tops; between them a gabled bay with the rose over a tall lancet; three
// gabled portals over a broad stair. Floodlit from the plaza, every window
// glowing with stained glass. Scroll cranes the camera up the front to the
// rose.

const TW = 13 // tower width
const TH = 50 // tower height to the parapet
const TX = 12.2 // tower centre x
const CW = 11.4 // centre bay width
const CH = 41 // centre bay gable apex
const ROSE = { y: 30.5, r: 3.7 }

const GLASS_MAT = (u, strength = 1) =>
  new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */ `attribute vec4 aWin; varying vec2 vUv; varying vec4 vWin; void main(){ vUv = uv; vWin = aWin; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uGlow;
      varying vec2 vUv; varying vec4 vWin;
      ${GLASS_GLSL}
      void main(){
        vec4 g;
        if (vWin.x > 0.5) {
          g = roseGlass(vUv * 2.0 - 1.0, 16.0, uTime);
          if (length(vUv * 2.0 - 1.0) > 1.0) discard;
        } else {
          // pointed head over the top fifth
          float hh = vWin.z;
          if (vUv.y > 1.0 - hh) {
            float k = (vUv.y - (1.0 - hh)) / hh;
            if (abs(vUv.x - 0.5) > 0.5 * sqrt(max(0.0, 1.0 - k * k))) discard;
          }
          g = lancetGlass(vUv, vWin.y);
          // mullions
          float m = vWin.w;
          if (m > 0.5) { float f = fract(vUv.x * m); g.a *= smoothstep(0.0, 0.05, min(f, 1.0 - f)); }
        }
        // lit from inside: warm, flickering a little, strongest low down
        float warm = 0.85 + 0.15 * sin(uTime * 0.9 + vWin.y * 7.0);
        vec3 c = mix(g.rgb, vec3(1.0, 0.78, 0.45), 0.18) * g.a * uGlow * ${strength.toFixed(2)} * warm;
        gl_FragColor = vec4(c + vec3(0.02, 0.012, 0.01), 1.0);
      }`,
  })


// The building itself, shared with the campus flight: granite, trim, dark
// recesses and the stained glass (lit by u.uGlow / u.uTime), in metres with
// the towers' front face at z = TW / 2 and the ground at y = 0.
export function palaceModel(u, { stair = true } = {}) {
  const group = new THREE.Group()
  /* --- building geometry, gathered per material and merged --- */
  const bins = { stone: [], dark: [], trim: [] }
  const winGeos = []
  const put = (bin, geo, x = 0, y = 0, z = 0, ry = 0) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone()
    if (ry) g.rotateY(ry)
    g.translate(x, y, z)
    // keep attributes identical for merging
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k)
    bins[bin].push(g)
  }
  const box = (bin, w, h, d, x, y, z) => put(bin, new THREE.BoxGeometry(w, h, d), x, y + h / 2, z)
  // a pointed-arch outline (width w, straight sides to `spring`, then the head)
  const arch = (w, spring, steep = 1) => {
    const s = new THREE.Shape()
    const r = w * steep
    const c = r - w / 2
    const ang = Math.acos(c / r)
    s.moveTo(-w / 2, 0)
    s.lineTo(w / 2, 0)
    s.lineTo(w / 2, spring)
    s.absarc(-c, spring, r, 0, ang, false)
    s.absarc(c, spring, r, Math.PI - ang, Math.PI, false)
    s.lineTo(-w / 2, 0)
    return { shape: s, top: spring + Math.sqrt(r * r - c * c) }
  }
  // A moulded frame around an arch opening: an extruded ring.
  const archFrame = (bin, w, spring, depth, band, x, y, z) => {
    const outer = arch(w + band * 2, spring + band)
    const inner = arch(w, spring)
    const sh = outer.shape
    const hole = new THREE.Path(inner.shape.getPoints(24).map((p) => new THREE.Vector2(p.x, p.y + 0.02)))
    sh.holes.push(hole)
    const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 12 })
    put(bin, g, x, y - 0.001, z)
  }
  // A glowing window: glass plane + recess + frame. kind 0 lancet, 1 rose.
  const windowAt = (x, y, z, w, h, seed, mull = 0, frame = true) => {
    const a = arch(w, h - w * 0.75)
    const g = new THREE.PlaneGeometry(w, a.top, 1, 1)
    g.translate(x, y + a.top / 2, z)
    const n = g.attributes.position.count
    const win = new Float32Array(n * 4)
    for (let i = 0; i < n; i++) win.set([0, seed, (a.top - (h - w * 0.75)) / a.top, mull], i * 4)
    g.setAttribute('aWin', new THREE.BufferAttribute(win, 4))
    winGeos.push(g)
    // recess sides
    box('dark', 0.25, a.top, 0.9, x - w / 2 - 0.12, y, z - 0.2)
    box('dark', 0.25, a.top, 0.9, x + w / 2 + 0.12, y, z - 0.2)
    if (frame) {
      archFrame('trim', w + 0.1, h - w * 0.75, 0.55, 0.35, x, y, z + 0.05)
      // slender shafts either side, rising to the arch's springing
      for (const sx of [-1, 1]) box('trim', 0.22, h - w * 0.75, 0.3, x + sx * (w / 2 + 0.55), y, z + 0.32)
      for (const sx of [-1, 1]) box('trim', 0.5, 0.3, 0.45, x + sx * (w / 2 + 0.55), y + h - w * 0.75, z + 0.3)
    }
    return a.top
  }
  const roseAt = (x, y, z, rad) => {
    const g = new THREE.PlaneGeometry(rad * 2, rad * 2)
    g.translate(x, y, z)
    const n = g.attributes.position.count
    const win = new Float32Array(n * 4)
    for (let i = 0; i < n; i++) win.set([1, 0, 0, 0], i * 4)
    g.setAttribute('aWin', new THREE.BufferAttribute(win, 4))
    winGeos.push(g)
    // tracery: rings and spokes in stone
    const ring = (rr, t) => put('trim', new THREE.TorusGeometry(rr, t, 6, 64), x, y, z + 0.12)
    ring(rad, 0.32)
    ring(rad * 0.84, 0.09)
    ring(rad * 0.46, 0.1)
    ring(rad * 0.16, 0.09)
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      const b = new THREE.BoxGeometry(0.08, rad * 0.68, 0.12)
      b.rotateZ(a - Math.PI / 2)
      put('trim', b, x + Math.cos(a) * rad * 0.5, y + Math.sin(a) * rad * 0.5, z + 0.12)
    }
  }
  // A pinnacle: a slim shaft with a pyramid cap and a ball finial.
  const pinnacle = (x, y, z, s = 1) => {
    box('stone', 0.9 * s, 3.2 * s, 0.9 * s, x, y, z)
    const c = new THREE.ConeGeometry(0.75 * s, 3.4 * s, 4)
    c.rotateY(Math.PI / 4)
    put('stone', c, x, y + 3.2 * s + 1.7 * s, z)
  }
  // Crenellations along an edge from (x0,z0) to (x1,z1) at height y.
  const crenel = (x0, z0, x1, z1, y) => {
    const len = Math.hypot(x1 - x0, z1 - z0)
    const n = Math.max(2, Math.round(len / 1.3))
    const ry = -Math.atan2(z1 - z0, x1 - x0)
    for (let i = 0; i < n; i += 2) {
      const t = (i + 0.5) / n
      const g = new THREE.BoxGeometry(len / n, 1.1, 0.7)
      g.rotateY(ry)
      put('stone', g, x0 + (x1 - x0) * t, y + 0.55, z0 + (z1 - z0) * t)
    }
  }

  /* --- the two towers --- */
  const front = TW / 2 // the towers' front face z
  for (const sx of [-1, 1]) {
    const cx = sx * TX
    // main mass, stepping in a little as it rises
    box('stone', TW, 18, TW, cx, 0, 0)
    box('stone', TW - 0.4, 17, TW - 0.4, cx, 18, -0.2)
    box('stone', TW - 0.8, TH - 35, TW - 0.8, cx, 35, -0.4)
    // corner buttresses, each set back at the string courses
    for (const bx of [-1, 1]) {
      const x = cx + bx * (TW / 2 - 0.4)
      box('stone', 2.4, 18, 2.6, x, 0, front - 0.2)
      box('stone', 2.1, 17, 2.2, x, 18, front - 0.5)
      box('stone', 1.8, TH - 35 + 1.2, 1.9, x, 35, front - 0.8)
      // side face buttress too
      box('stone', 2.4, 18, 2.4, x, 0, -TW / 2 + 1.2)
      box('stone', 1.8, TH - 18 + 1.2, 1.8, x, 18, -TW / 2 + 1.4)
      // gabled offsets on the buttress at the courses
      for (const yy of [18, 35]) {
        const w = new THREE.ConeGeometry(1.5, 1.8, 4)
        w.rotateY(Math.PI / 4)
        put('trim', w, x, yy + 0.6, front - 0.1)
      }
      // pinnacles on the corners, over the parapet
      pinnacle(x, TH + 1.2, front - 0.8, 1.15)
      pinnacle(x, TH + 1.2, -TW / 2 + 1.4, 1.15)
      // little pinnacles up the buttress faces
      pinnacle(x + bx * 0.0, 28, front + 0.4, 0.45)
      pinnacle(x, 44, front - 0.1, 0.45)
    }
    // string courses with a band of blind arcading under the parapet
    for (const yy of [17.6, 34.6]) box('trim', TW + 0.8, 0.7, TW + 0.8, cx, yy, 0)
    // blind arcades under the courses, rows of little pointed arches
    for (const [yy, zz] of [[15.4, front + 0.05], [32.4, front - 0.35]])
      for (let i = 0; i < 7; i++) archFrame('trim', 0.8, 1.0, 0.22, 0.12, cx - TW / 2 + 2.2 + i * ((TW - 4.4) / 6), yy, zz)
    box('trim', TW, 0.8, TW, cx, TH - 0.3, -0.4)
    for (let i = 0; i < 8; i++) {
      const ax = cx - TW / 2 + 1.3 + i * ((TW - 2.6) / 7)
      archFrame('trim', 0.7, 1.0, 0.25, 0.12, ax, TH - 3.4, front - 0.38)
    }
    crenel(cx - TW / 2 + 0.6, front - 0.6, cx + TW / 2 - 0.6, front - 0.6, TH + 0.5)
    crenel(cx - TW / 2 + 0.6, -TW / 2 + 0.6, cx + TW / 2 - 0.6, -TW / 2 + 0.6, TH + 0.5)
    crenel(cx - TW / 2 + 0.6, front - 0.6, cx - TW / 2 + 0.6, -TW / 2 + 0.6, TH + 0.5)
    crenel(cx + TW / 2 - 0.6, front - 0.6, cx + TW / 2 - 0.6, -TW / 2 + 0.6, TH + 0.5)
    // front windows: a side portal, two tall lancets, two more above
    const portal = arch(3.2, 4.6)
    archFrame('trim', 3.2, 4.6, 0.9, 0.55, cx, 0.6, front + 0.05)
    box('dark', 3.2, portal.top, 0.4, cx, 0.6, front - 0.3)
    windowAt(cx, 7.4, front + 0.02, 3.6, 8.4, sx + 3, 3)
    windowAt(cx - 2.2, 20.5, front - 0.18, 2.1, 12, sx + 5, 2)
    windowAt(cx + 2.2, 20.5, front - 0.18, 2.1, 12, sx + 6, 2)
    windowAt(cx - 2.2, 37.4, front - 0.38, 2.0, 9.8, sx + 7, 2)
    windowAt(cx + 2.2, 37.4, front - 0.38, 2.0, 9.8, sx + 8, 2)
    // the towers' outer flank: tall lancets too (seen as the camera turns)
    const side = sx * (TX + TW / 2)
    for (const [yy, hh] of [[20.5, 12], [37.4, 9.8]]) {
      const g = new THREE.Group()
      g.position.set(side + sx * 0.05, 0, 0)
      winGeos.push(
        (() => {
          const a = arch(2.2, hh - 1.6)
          const pg = new THREE.PlaneGeometry(2.2, a.top)
          pg.rotateY(sx * Math.PI / 2)
          pg.translate(side + sx * 0.03, yy + a.top / 2, 0)
          const n = pg.attributes.position.count
          const win = new Float32Array(n * 4)
          for (let i = 0; i < n; i++) win.set([0, yy, (a.top - (hh - 1.6)) / a.top, 2], i * 4)
          pg.setAttribute('aWin', new THREE.BufferAttribute(win, 4))
          return pg
        })(),
      )
    }
  }

  /* --- the centre bay: rose over a tall lancet, a gable, the portal --- */
  const cz = front - 1.6
  box('stone', CW, 36, 3, 0, 0, cz - 1.5)
  // gable with a little arcade
  {
    const gs = new THREE.Shape()
    gs.moveTo(-CW / 2, 0)
    gs.lineTo(CW / 2, 0)
    gs.lineTo(0, CH - 36)
    gs.lineTo(-CW / 2, 0)
    put('stone', new THREE.ExtrudeGeometry(gs, { depth: 3, bevelEnabled: false }), 0, 36, cz - 3)
    for (let i = 0; i < 5; i++) archFrame('trim', 0.8, 1.4, 0.25, 0.14, -2.4 + i * 1.2, 36.8, cz + 0.02)
    pinnacle(0, CH - 0.4, cz - 1.5, 0.7)
    // gallery across the bay under the gable
    box('trim', CW, 0.6, 3.6, 0, 35.6, cz - 1.5)
    for (let i = 0; i < 9; i++) archFrame('trim', 0.7, 0.9, 0.2, 0.1, -CW / 2 + 1.1 + i * 1.15, 33.9, cz + 0.02)
  }
  // the great window frame: a pointed arch round rose + lancet
  archFrame('trim', 8.6, 18.6, 1.0, 0.7, 0, 13.4, cz + 0.02)
  roseAt(0, ROSE.y, cz + 0.05, ROSE.r)
  // spandrel fill between the rose and the arch head, a darker plate
  box('trim', 8.6, 0.6, 0.4, 0, ROSE.y - ROSE.r - 0.9, cz + 0.1)
  for (let i = 0; i < 4; i++) windowAt(-3.15 + i * 2.1, 14.0, cz + 0.05, 1.75, 11.2, 20 + i, 0, false)
  // mullions between the lancets
  for (let i = 0; i < 5; i++) box('trim', 0.34, 12.6, 0.5, -4.2 + i * 2.1, 13.8, cz)
  // central portal under a tall gable (wimperg), statues before it
  {
    const p = arch(4.4, 6.2)
    archFrame('trim', 4.4, 6.2, 1.6, 0.8, 0, 0.6, cz + 1.2)
    archFrame('trim', 6.2, 6.6, 1.0, 0.45, 0, 0.6, cz + 1.0)
    archFrame('trim', 7.4, 7.0, 0.7, 0.35, 0, 0.6, cz + 0.8)
    box('dark', 4.4, p.top, 0.6, 0, 0.6, cz + 0.6)
    const ws = new THREE.Shape()
    ws.moveTo(-3.6, 0)
    ws.lineTo(3.6, 0)
    ws.lineTo(0, 6.4)
    ws.lineTo(-3.6, 0)
    const hole = new THREE.Path()
    hole.moveTo(-2.4, 0.7)
    hole.lineTo(2.4, 0.7)
    hole.lineTo(0, 4.9)
    hole.lineTo(-2.4, 0.7)
    ws.holes.push(hole)
    put('trim', new THREE.ExtrudeGeometry(ws, { depth: 0.8, bevelEnabled: false }), 0, p.top + 0.5, cz + 1.9)
    pinnacle(-3.9, 0.6, cz + 2.4, 0.9)
    pinnacle(3.9, 0.6, cz + 2.4, 0.9)
    pinnacle(0, p.top + 6.6, cz + 2.3, 0.45)
    // tympanum relief: a lit plate in the arch head
    box('trim', 3.2, 2.2, 0.2, 0, 4.4, cz + 0.95)
    // the statue group on its plinth
    box('stone', 2.6, 1.6, 2.2, 0, -0.2, cz + 9.2)
    for (const [dx, hgt] of [[-0.6, 2.2], [0.2, 2.5], [0.8, 2.0]]) {
      const fig = new THREE.CapsuleGeometry(0.28, hgt - 0.6, 4, 8)
      put('dark', fig, dx, 1.4 + hgt / 2, cz + 9.2)
    }
  }
  // the bays beside the centre (between tower and gable) get a tall lancet each
  // (already covered by the towers' inner buttresses)

  /* --- the nave behind, with buttresses and pinnacles --- */
  box('stone', CW + 2 * TW - 2, 30, 60, 0, 0, -TW / 2 - 30)
  for (let i = 0; i < 6; i++) {
    const z = -TW / 2 - 6 - i * 9
    for (const sx of [-1, 1]) {
      const x = sx * (CW / 2 + TW - 1)
      box('stone', 2.4, 24, 2.2, x + sx * 1.0, 0, z)
      pinnacle(x + sx * 1.0, 24, z, 0.8)
      const a = arch(2.6, 9)
      const pg = new THREE.PlaneGeometry(2.6, a.top)
      pg.rotateY(sx * Math.PI / 2)
      pg.translate(x + sx * 0.05, 10 + a.top / 2, z - 4.5)
      const n = pg.attributes.position.count
      const win = new Float32Array(n * 4)
      for (let k = 0; k < n; k++) win.set([0, 30 + i + sx, (a.top - 9) / a.top, 2], k * 4)
      pg.setAttribute('aWin', new THREE.BufferAttribute(win, 4))
      winGeos.push(pg)
    }
  }
  // pitched roof
  {
    const rs = new THREE.Shape()
    const hw = CW / 2 + TW - 1
    rs.moveTo(-hw, 0)
    rs.lineTo(hw, 0)
    rs.lineTo(0, 12)
    rs.lineTo(-hw, 0)
    const rg = new THREE.ExtrudeGeometry(rs, { depth: 58, bevelEnabled: false })
    put('dark', rg, 0, 30, -TW / 2 - 60)
  }

  /* --- the stair --- */
  if (stair) for (let i = 0; i < 12; i++) box('stone', CW + 2 * TW + 6 - i * 0.2, 0.25, 2.2, 0, -3 + i * 0.25, front + 25 - i * 1.6)
  box('stone', CW + 2 * TW + 6, 0.6, 7, 0, -0.6, front + 3.5)
  // balustrades along the central flight
  if (stair) for (const sx of [-1, 1]) {
    box('trim', 0.5, 1.2, 20, sx * 4.4, -1.6, front + 15)
    for (let i = 0; i < 10; i++) box('trim', 0.7, 1.6, 0.7, sx * 4.4, -2.8 + i * 0.28, front + 6 + i * 2)
  }

  const stone = stoneMaterial('#e4e0da', { scale: 0.26 })
  const trim = stoneMaterial('#f0ece5', { scale: 0.38, roughness: 0.8 })
  const dark = new THREE.MeshStandardMaterial({ color: '#2d2a33', roughness: 0.9 })
  const mats = { stone, dark, trim }
  for (const [k, list] of Object.entries(bins)) {
    const geo = mergeGeometries(list, false)
    const mesh = new THREE.Mesh(geo, mats[k])
    group.add(mesh)
  }
  const glass = new THREE.Mesh(mergeGeometries(winGeos, false), GLASS_MAT(u, 1.25))
  group.add(glass)
  group.userData.rose = new THREE.Vector3(0, ROSE.y, TW / 2 - 1.6)
  return group
}

export class Palace {
  constructor(canvas) {
    this.canvas = canvas
    this.progress = 0
    this.time = 0
    this.pointer = new THREE.Vector2()
    this.ps = new THREE.Vector2()

    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }))
    r.setPixelRatio(pixelRatio(1.25, 1.5))
    r.toneMapping = THREE.ACESFilmicToneMapping
    r.toneMappingExposure = 1.05
    const scene = (this.scene = new THREE.Scene())
    const cam = (this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 900))
    scene.fog = new THREE.Fog('#141c3a', 120, 520)

    this.u = { uTime: { value: 0 }, uGlow: { value: 1 } }

    /* sky: blue hour over 회기, a few stars, the moon's halo */
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(600, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: this.u,
        vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          varying vec3 vD; uniform float uTime;
          float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
          void main(){
            float y = clamp(vD.y, -0.1, 1.0);
            vec3 c = mix(vec3(0.09, 0.12, 0.27), vec3(0.02, 0.03, 0.09), pow(max(y, 0.0), 0.6));
            c = mix(vec3(0.24, 0.18, 0.3), c, smoothstep(-0.02, 0.18, y)); // the city's glow at the horizon
            vec3 moon = normalize(vec3(-0.55, 0.42, -0.72));
            float md = max(dot(vD, moon), 0.0);
            c += vec3(0.55, 0.62, 0.85) * (pow(md, 900.0) * 3.0 + pow(md, 40.0) * 0.12);
            vec3 cell = floor(vD * 260.0);
            float s = h(cell);
            c += vec3(step(0.9975, s)) * (0.5 + 0.5 * sin(uTime * 2.0 + s * 90.0)) * smoothstep(0.1, 0.5, y) * 0.9;
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    )
    scene.add(sky)

    /* lights: moonlight, sky fill and the floodlights on the plaza */
    scene.add(new THREE.HemisphereLight('#4b5d9a', '#141018', 0.35))
    const moon = new THREE.DirectionalLight('#a9b9ff', 0.3)
    moon.position.set(-60, 80, -40)
    scene.add(moon)
    const flood = (x, z, tx, ty, col, int) => {
      const s = new THREE.SpotLight(col, int, 160, 0.5, 0.7, 2)
      s.position.set(x, 0.5, z)
      s.target.position.set(tx, ty, 0)
      scene.add(s, s.target)
      return s
    }
    this.floods = [
      flood(-24, 26, -12, 30, '#ffe4c4', 2400),
      flood(24, 26, 12, 30, '#ffe4c4', 2400),
      flood(0, 30, 0, 26, '#ffe2bf', 1500),
      flood(-6, 10, -12, 46, '#ffcf96', 900),
      flood(6, 10, 12, 46, '#ffcf96', 900),
    ]

    const front = TW / 2
    const dark = new THREE.MeshStandardMaterial({ color: '#2d2a33', roughness: 0.9 })
    scene.add(palaceModel(this.u))


    buildPlaza(scene, this.u)

    /* post: bloom on the glass and lamps */
    const composer = (this.composer = new EffectComposer(r))
    composer.addPass(new RenderPass(scene, cam))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.55, 0.78)
    composer.addPass(this.bloom)
    composer.addPass(new OutputPass())

    // Camera path: low on the plaza → up the façade → into the rose.
    this.path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-26, 1.5, 78),
      new THREE.Vector3(-14, 6, 58),
      new THREE.Vector3(2, 18, 44),
      new THREE.Vector3(6, 27, 30),
      new THREE.Vector3(0, ROSE.y, 15),
    ])
    this.look = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 26, 0),
      new THREE.Vector3(0, 27, 0),
      new THREE.Vector3(0, 29, 0),
      new THREE.Vector3(0, ROSE.y, 0),
      new THREE.Vector3(0, ROSE.y, 0),
    ])
    addEventListener('pointermove', (e) => this.pointer.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1), { passive: true })
    this.resize()
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
    this.camera.fov = w / h < 0.8 ? 62 : 42
    this.camera.updateProjectionMatrix()
  }

  render(dt) {
    this.resize()
    this.time += dt
    this.u.uTime.value = this.time
    const p = this.progress
    const t = p * p * (3 - 2 * p)
    this.ps.lerp(this.pointer, Math.min(1, dt * 2))
    const pos = this.path.getPointAt(t)
    const look = this.look.getPointAt(t)
    pos.x += this.ps.x * 2.5 * (1 - t)
    pos.y -= this.ps.y * 1.2 * (1 - t)
    this.camera.position.copy(pos)
    this.camera.lookAt(look)
    // the rose brightens as we arrive
    this.u.uGlow.value = 1 + Math.pow(t, 3) * 1.6
    this.composer.render(dt)
  }
}
