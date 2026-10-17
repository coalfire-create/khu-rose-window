import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { stoneMaterial } from './stone.js'
import { pixelRatio, tier } from '../device.js'

// 본관 (the Main Hall, 1956), modelled after photographs: a four-storey
// granite block behind a giant colonnade of ten columns under a sculpted
// pediment, two forward wings with their own porticoes and pediments, a broad
// stair down to the fountain. Ground (the terrace) at y = 0, facing +z.

const W = 64 // main block width
const D = 18
const H = 21
const WING = { w: 19, d: 30, x: W / 2 + 9.5 }

// warm lit windows, or dark glass
const winMats = () => [
  new THREE.MeshStandardMaterial({ color: '#1a1d2a', roughness: 0.2, metalness: 0.4, emissive: '#000000' }),
  new THREE.MeshStandardMaterial({ color: '#2a2018', emissive: '#ffc67e', emissiveIntensity: 1.25 }),
]

export function bongwanModel({ lit = 0.55 } = {}) {
  const group = new THREE.Group()
  const bins = { stone: [], trim: [] }
  const wins = [[], []]
  const put = (bin, geo, x, y, z, ry = 0) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone()
    if (ry) g.rotateY(ry)
    g.translate(x, y, z)
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k)
    bins[bin].push(g)
  }
  const box = (bin, w, h, d, x, y, z) => put(bin, new THREE.BoxGeometry(w, h, d), x, y + h / 2, z)
  let seed = 3
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  // a row of tall windows on a face at z (facing +z), from x0 to x1
  const windows = (x0, x1, z, floors, y0 = 1.6, fh = 4.6, bay = 3.4, ry = 0, ox = 0) => {
    const n = Math.floor((x1 - x0) / bay)
    const off = (x1 - x0 - n * bay) / 2
    for (let f = 0; f < floors; f++)
      for (let i = 0; i < n; i++) {
        const g = new THREE.PlaneGeometry(1.5, 2.7)
        const x = x0 + off + bay * (i + 0.5)
        if (ry) g.rotateY(ry)
        g.translate(ry ? ox : x, y0 + f * fh + 1.6, ry ? x : z)
        wins[rnd() < lit ? 1 : 0].push(g)
        // a sill and a lintel
        const s = new THREE.BoxGeometry(2.1, 0.22, 0.4)
        const t = new THREE.BoxGeometry(2.1, 0.32, 0.4)
        if (ry) (s.rotateY(ry), t.rotateY(ry))
        put('trim', s, ry ? ox : x, y0 + f * fh + 0.18, ry ? x : z)
        put('trim', t, ry ? ox : x, y0 + f * fh + 3.12, ry ? x : z)
      }
  }
  // a giant order column: base, fluted-looking shaft, capital
  const column = (x, z, h, r = 0.85) => {
    put('trim', new THREE.BoxGeometry(r * 2.6, 0.7, r * 2.6), x, 0.35, z)
    put('trim', new THREE.CylinderGeometry(r * 0.88, r, h - 1.7, 16), x, 0.7 + (h - 1.7) / 2, z)
    put('trim', new THREE.CylinderGeometry(r * 1.35, r * 0.9, 0.7, 16), x, h - 0.85, z)
    put('trim', new THREE.BoxGeometry(r * 2.9, 0.35, r * 2.9), x, h - 0.32, z)
  }
  const pediment = (w, h, depth, x, y, z) => {
    const s = new THREE.Shape()
    s.moveTo(-w / 2, 0)
    s.lineTo(w / 2, 0)
    s.lineTo(0, h)
    s.lineTo(-w / 2, 0)
    put('trim', new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }), x, y, z - depth / 2)
    // the raking cornice
    const c = new THREE.Shape()
    c.moveTo(-w / 2 - 0.6, -0.1)
    c.lineTo(w / 2 + 0.6, -0.1)
    c.lineTo(0, h + 0.5)
    c.lineTo(-w / 2 - 0.6, -0.1)
    const hole = new THREE.Path()
    hole.moveTo(-w / 2 + 1.2, 0.6)
    hole.lineTo(w / 2 - 1.2, 0.6)
    hole.lineTo(0, h - 0.9)
    hole.lineTo(-w / 2 + 1.2, 0.6)
    c.holes.push(hole)
    put('trim', new THREE.ExtrudeGeometry(c, { depth: 0.8, bevelEnabled: false }), x, y, z + depth / 2 - 0.2)
    // the relief: a row of figures in the tympanum
    for (let i = -5; i <= 5; i++) {
      const fh = (h - 1.4) * (1 - Math.abs(i) / 6.2)
      if (fh < 0.8) continue
      put('trim', new THREE.CapsuleGeometry(0.32, fh - 0.6, 3, 6), x + i * (w / 13.5), y + 0.7 + fh / 2, z + depth / 2 - 0.05)
    }
  }
  const cornice = (w, d, x, y, z) => {
    box('trim', w + 1.2, 0.9, d + 1.2, x, y, z)
    box('trim', w + 0.6, 0.5, d + 0.6, x, y - 0.5, z)
    // balustrade on the roof edge
    box('trim', w + 0.4, 0.25, 0.5, x, y + 0.9, z + d / 2 + 0.2)
    box('trim', w + 0.4, 0.25, 0.5, x, y + 2.0, z + d / 2 + 0.2)
    for (let i = 0; i <= Math.floor(w / 0.9); i++) box('trim', 0.28, 0.9, 0.28, x - w / 2 + 0.2 + i * 0.9, y + 1.15, z + d / 2 + 0.2)
  }

  /* main block */
  box('stone', W, H, D, 0, 0, 0)
  box('trim', W + 0.6, 1.4, D + 0.6, 0, 0, 0) // plinth
  cornice(W, D, 0, H, 0)
  windows(-W / 2 + 1, -14, D / 2 + 0.01, 4)
  windows(14, W / 2 - 1, D / 2 + 0.01, 4)
  // central portico: projecting, ten giant columns
  const PZ = D / 2 + 5
  box('stone', 28, H, 5, 0, 0, D / 2 + 1.5) // the wall behind the columns
  windows(-12.5, 12.5, D / 2 + 4.01, 4)
  for (let i = 0; i < 10; i++) column(-13.05 + i * 2.9, PZ + 1.6, H - 0.4)
  box('trim', 30, 1.6, 7.4, 0, H - 0.4, D / 2 + 2.9) // entablature
  pediment(30.5, 6.4, 7, 0, H + 1.2, D / 2 + 2.9)
  // wings, brought forward, each with its portico and pediment
  for (const sx of [-1, 1]) {
    const x = sx * WING.x
    const z = (WING.d - D) / 2
    box('stone', WING.w, H, WING.d, x, 0, z)
    box('trim', WING.w + 0.6, 1.4, WING.d + 0.6, x, 0, z)
    cornice(WING.w, WING.d, x, H, z)
    for (let i = 0; i < 4; i++) column(x - 6.3 + i * 4.2, z + WING.d / 2 + 2.2, H - 0.4, 0.75)
    box('trim', WING.w + 1, 1.5, 4.6, x, H - 0.4, z + WING.d / 2 + 1.6)
    pediment(WING.w + 1.2, 4.6, 4.6, x, H + 1.1, z + WING.d / 2 + 1.6)
    windows(x - WING.w / 2 + 1, x + WING.w / 2 - 1, z + WING.d / 2 + 0.01, 4, 1.6, 4.6, 3.6)
  }
  // the stair down from the portico, flanked by plinths
  for (let i = 0; i < 10; i++) box('stone', 26 - i * 0.2, 0.3, 1.2, 0, -3 + i * 0.3, PZ + 15 - i * 1.15)
  box('stone', 34, 0.3, 7, 0, -0.3, PZ + 6)
  for (const sx of [-1, 1]) {
    box('trim', 2.4, 2.6, 3, sx * 14.2, -3, PZ + 11)
    put('trim', new THREE.CapsuleGeometry(0.7, 1.0, 4, 8), sx * 14.2, -0.4 + 1.0, PZ + 11) // the lions, as forms
  }
  // terrace edge
  box('stone', 2 * WING.x + WING.w + 10, 3, 2, 0, -3, PZ + 12.5)

  const stone = stoneMaterial('#ddd7cd', { scale: 0.16 })
  const trim = stoneMaterial('#ece7de', { scale: 0.24, roughness: 0.82 })
  for (const [k, mat] of [['stone', stone], ['trim', trim]]) group.add(new THREE.Mesh(mergeGeometries(bins[k].map((g) => (g.index ? g.toNonIndexed() : g)), false), mat))
  const wm = winMats()
  wins.forEach((list, i) => list.length && group.add(new THREE.Mesh(mergeGeometries(list.map((g) => g.toNonIndexed()), false), wm[i])))
  group.userData.front = PZ + 15
  return group
}

// The fountain before 본관: a round basin, jets, lit water.
export function fountain() {
  const g = new THREE.Group()
  const rim = new THREE.Mesh(new THREE.TorusGeometry(11, 0.7, 8, 64), stoneMaterial('#e6e0d6', { scale: 0.3 }))
  rim.rotation.x = -Math.PI / 2
  rim.position.y = 0.6
  const water = new THREE.Mesh(new THREE.CircleGeometry(11, 64), new THREE.MeshStandardMaterial({ color: '#2a5f8f', emissive: '#3c8ad0', emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.3 }))
  water.rotation.x = -Math.PI / 2
  water.position.y = 0.4
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, 3, 24), stoneMaterial('#e6e0d6', { scale: 0.3 }))
  plinth.position.y = 1.8
  g.add(rim, water, plinth)
  // jets: additive particle arcs
  const N = tier(2400, 1000)
  const a = new Float32Array(N * 4)
  for (let i = 0; i < N; i++) a.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
  geo.setAttribute('aR', new THREE.BufferAttribute(a, 4))
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPx: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec4 aR; uniform float uTime; uniform float uPx; varying float vA;
      void main(){
        // a ring of jets arcing inward to the centre, and one tall plume
        float t = fract(uTime * (0.45 + aR.z * 0.2) + aR.w);
        vec3 p;
        if (aR.x < 0.3) {
          float r = 0.3 * aR.y;
          p = vec3(cos(aR.y * 40.0) * r, 3.4 + t * 9.0 - t * t * 8.5, sin(aR.y * 40.0) * r);
          p.xz *= 1.0 + t * 6.0;
        } else {
          float ang = floor(aR.y * 16.0) / 16.0 * 6.2832;
          float r = mix(10.0, 2.5, t);
          p = vec3(cos(ang) * r, 0.6 + t * 6.0 - t * t * 6.0, sin(ang) * r);
        }
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uPx * 60.0 / max(-mv.z, 1.0);
        vA = (1.0 - t) * 0.6;
      }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(vec3(0.75, 0.88, 1.0) * a, a); }`,
  })
  const pts = new THREE.Points(geo, mat)
  pts.frustumCulled = false
  g.add(pts)
  g.userData.tick = (t, px) => ((mat.uniforms.uTime.value = t), (mat.uniforms.uPx.value = px))
  return g
}

// Magnolia trees: dark trunks under clouds of white-pink blossom.
export function magnolias(spots, { glow = 0.5 } = {}) {
  const g = new THREE.Group()
  const blossom = new THREE.IcosahedronGeometry(1, 1)
  const n = spots.length * 9
  const flowers = new THREE.InstancedMesh(blossom, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, emissive: '#5b3a44', emissiveIntensity: glow, flatShading: true }), n)
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#2a1f1c', roughness: 1 })
  const m = new THREE.Matrix4()
  const c = new THREE.Color()
  let k = 0
  let seed = 9
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (const [x, z, s = 1] of spots) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * s, 0.4 * s, 4.5 * s, 6), trunkMat)
    trunk.position.set(x, 2.25 * s, z)
    g.add(trunk)
    for (let i = 0; i < 9; i++) {
      const a = rnd() * 6.28
      const r = rnd() * 2.6 * s
      const sc = (1.4 + rnd() * 1.2) * s
      m.compose(new THREE.Vector3(x + Math.cos(a) * r, (4.6 + rnd() * 2.8) * s, z + Math.sin(a) * r), new THREE.Quaternion(), new THREE.Vector3(sc, sc * 0.85, sc))
      flowers.setMatrixAt(k, m)
      c.setHSL(0.96 + rnd() * 0.03, 0.55, 0.86 + rnd() * 0.08)
      flowers.setColorAt(k++, c)
    }
  }
  g.add(flowers)
  return g
}

// The magnolia chapter's backdrop: 본관 at spring dusk, magnolias in bloom
// along the terrace, the fountain playing. Scroll cranes the camera slowly.
export class Bongwan {
  constructor(canvas) {
    this.canvas = canvas
    this.progress = 0
    this.time = 0
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }))
    r.setPixelRatio(pixelRatio(1, 1.4))
    r.toneMapping = THREE.ACESFilmicToneMapping
    r.toneMappingExposure = 1.0
    const scene = (this.scene = new THREE.Scene())
    scene.fog = new THREE.Fog('#2a2033', 90, 360)
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.5, 2000)
    scene.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(900, 32, 16),
        new THREE.ShaderMaterial({
          side: THREE.BackSide,
          fog: false,
          depthWrite: false,
          vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
          fragmentShader: `varying vec3 vD; void main(){ float y = vD.y; vec3 c = mix(vec3(0.55, 0.38, 0.5), vec3(0.16, 0.14, 0.32), smoothstep(0.0, 0.45, y)); c = mix(c, vec3(0.05, 0.05, 0.14), smoothstep(0.45, 0.95, y)); c += vec3(0.5, 0.28, 0.2) * pow(max(dot(vD, normalize(vec3(0.6, 0.05, -1.0))), 0.0), 8.0) * 0.5; gl_FragColor = vec4(c, 1.0); }`,
        }),
      ),
    )
    scene.add(new THREE.HemisphereLight('#8a8ccc', '#2a1c22', 0.5))
    const dusk = new THREE.DirectionalLight('#ffb38a', 0.45)
    dusk.position.set(120, 40, -200)
    scene.add(dusk)
    for (const [x, z, i] of [[-34, 62, 11000], [34, 62, 11000], [0, 70, 7000], [-70, 50, 6000], [70, 50, 6000]]) {
      const s = new THREE.SpotLight('#ffe6c8', i, 260, 0.5, 0.75, 2)
      s.position.set(x, -2, z)
      s.target.position.set(x * 0.7, 12, 0)
      scene.add(s, s.target)
    }
    const hall = bongwanModel({ lit: 0.6 })
    scene.add(hall)
    const f = (this.fountain = fountain())
    f.position.set(0, -3, hall.userData.front + 28)
    scene.add(f)
    const plaza = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), stoneMaterial('#76706a', { scale: 0.3, roughness: 0.6 }))
    plaza.rotation.x = -Math.PI / 2
    plaza.position.set(0, -3, 120)
    scene.add(plaza)
    const spots = []
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 7; i++) spots.push([sx * (22 + (i % 2) * 7), 30 + i * 9, 1.1])
      for (let i = 0; i < 5; i++) spots.push([sx * (52 + i * 6), 36 + (i % 2) * 6, 1.2])
    }
    const mg = magnolias(spots, { glow: 0.55 })
    mg.position.y = -3
    scene.add(mg)
    // trees and hillside behind
    const back = []
    for (let i = 0; i < 70; i++) {
      const s = 5 + Math.random() * 6
      back.push(new THREE.IcosahedronGeometry(s, 1).toNonIndexed().translate((Math.random() - 0.5) * 300, 10 + Math.random() * 20, -30 - Math.random() * 60))
    }
    scene.add(new THREE.Mesh(mergeGeometries(back, false), new THREE.MeshStandardMaterial({ color: '#1a2a22', roughness: 1, flatShading: true })))
    const composer = (this.composer = new EffectComposer(r))
    composer.addPass(new RenderPass(scene, this.camera))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.5, 0.8)
    composer.addPass(this.bloom)
    composer.addPass(new OutputPass())
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
    this.camera.fov = w / h < 0.8 ? 60 : 40
    this.camera.updateProjectionMatrix()
  }

  render(dt) {
    this.resize()
    this.time += dt
    const p = this.progress
    const e = p * p * (3 - 2 * p)
    this.fountain.userData.tick(this.time, this.renderer.getPixelRatio())
    this.camera.position.set(-38 + e * 30, 2 + e * 10, 150 - e * 40)
    this.camera.lookAt(-4 + e * 4, 12, 0)
    this.composer.render(dt)
  }
}
