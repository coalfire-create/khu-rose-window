import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import DATA from '../data/campus.json'
import { pixelRatio, tier, MOBILE } from '../device.js'

// A flight over the real Hoegi campus at blue hour, built only from free open
// data: OpenStreetMap footprints, paths and green areas (© OSM contributors)
// on AWS Terrain Tiles elevation. Windows light up floor by floor, the paths
// glow with lamps, magnolias bloom pale along the walks. Scroll flies from
// the castle gate up the hill, stop by stop, to 평화의전당 at the top.

const R = DATA.size
const L = DATA.landmarks

export const STOPS = [
  { key: 'gate', name: '정문', en: 'Main Gate', kind: '캠퍼스의 시작', body: '성곽을 닮은 석조 아치. 경희대로를 따라 언덕 위 캠퍼스로 오르는 모든 이야기가 여기서 시작됩니다.', r: 105, h: 58, a: 2.6 },
  { key: 'motto', name: '교시탑', en: 'Motto Tower', kind: '기념탑', body: '교시 ‘문화세계의 창조’를 새긴 탑. 정문에서 본관으로 오르는 길 한가운데에 서 있습니다.', r: 95, h: 58, a: 2.2 },
  { key: 'main', name: '본관', en: 'Main Hall', kind: '1956 · 석조 신고전주의', body: '열주와 박공 부조로 지은 경희의 얼굴. 앞마당의 분수 너머로 캠퍼스 전체를 내려다봅니다.', r: 150, h: 75, a: 1.9, hall: '본관' },
  { key: 'library', name: '중앙도서관', en: 'Central Library', kind: '도서관 · 중앙박물관', body: '밤늦도록 불이 꺼지지 않는 지성의 심장. 같은 건물에 경희대학교 중앙박물관이 있습니다.', r: 160, h: 85, a: 1.0, hall: '중앙도서관' },
  { key: 'theatre', name: '노천극장', en: 'Open-air Theatre', kind: '축제의 무대', body: '언덕을 계단 삼아 앉는 야외 극장. 축제와 공연, 졸업의 순간이 이 무대 위에서 펼쳐집니다.', r: 130, h: 70, a: 0.5, hall: '노천극장 무대' },
  { key: 'palace', name: '평화의전당', en: 'Grand Peace Palace', kind: '1999 · 고딕 · 4,250석', body: '캠퍼스 가장 높은 곳, 쌍탑의 고딕 전당. 개교 50주년을 맞아 스물한 해 만에 문을 열었습니다.', r: 170, h: 70, a: 1.75, hall: '평화의전당' },
]

const hash = (n) => {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}

export class Campus {
  constructor(canvas) {
    this.canvas = canvas
    this.progress = 0
    this.active = false
    this.time = 0
    this.stops = STOPS
    this.labels = []
    this.pointer = new THREE.Vector2()
    this.ps = new THREE.Vector2()
    addEventListener('pointermove', (e) => this.pointer.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1), { passive: true })

    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }))
    r.setPixelRatio(pixelRatio(1, 1.5))
    r.toneMapping = THREE.ACESFilmicToneMapping
    r.toneMappingExposure = 1.1
    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.FogExp2('#18213f', 0.0011)
    this.camera = new THREE.PerspectiveCamera(45, 1, 1, 6000)
    this.u = { uTime: { value: 0 }, uFocus: { value: -1 }, uFocusK: { value: 0 } }

    const composer = (this.composer = new EffectComposer(r))
    composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.5, 0.82)
    composer.addPass(this.bloom)
    composer.addPass(new OutputPass())

    this.ready = this.load()
    this.resize()
  }

  async load() {
    // Terrain heights: 16-bit in R/G, centimetres above hmin.
    const img = new Image()
    img.src = '/terrain.png'
    await img.decode()
    const T = DATA.terrain
    const cv = document.createElement('canvas')
    cv.width = cv.height = T.n
    const cx = cv.getContext('2d', { willReadFrequently: true })
    cx.drawImage(img, 0, 0)
    const px = cx.getImageData(0, 0, T.n, T.n).data
    const H = (this.H = new Float32Array(T.n * T.n))
    for (let i = 0; i < H.length; i++) H[i] = (px[i * 4] * 256 + px[i * 4 + 1]) / 100 + T.hmin
    this.build()
  }

  // Ground height at (x, z), bilinear.
  ground(x, z) {
    const T = DATA.terrain
    const fx = Math.min(T.n - 1.001, Math.max(0, (x + R) / T.step))
    const fz = Math.min(T.n - 1.001, Math.max(0, (z + R) / T.step))
    const i = Math.floor(fx)
    const j = Math.floor(fz)
    const tx = fx - i
    const tz = fz - j
    const h = (a, b) => this.H[b * T.n + a]
    return (h(i, j) * (1 - tx) + h(i + 1, j) * tx) * (1 - tz) + (h(i, j + 1) * (1 - tx) + h(i + 1, j + 1) * tx) * tz
  }

  build() {
    const scene = this.scene
    const T = DATA.terrain

    /* --- sky: blue hour, the city's glow at the horizon, stars --- */
    scene.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(5000, 32, 16),
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
              float y = vD.y;
              vec3 top = vec3(0.03, 0.05, 0.14), mid = vec3(0.12, 0.17, 0.36), low = vec3(0.42, 0.3, 0.42);
              vec3 c = mix(mid, top, smoothstep(0.05, 0.6, y));
              c = mix(low, c, smoothstep(-0.02, 0.12, y));
              // last light in the west
              c += vec3(0.5, 0.25, 0.15) * pow(max(dot(normalize(vec3(-1.0, 0.0, 0.3)), vD), 0.0), 6.0) * smoothstep(0.25, 0.0, y);
              vec3 cell = floor(vD * 300.0);
              float s = h(cell);
              c += vec3(step(0.998, s)) * (0.5 + 0.5 * sin(uTime * 2.0 + s * 90.0)) * smoothstep(0.15, 0.6, y);
              gl_FragColor = vec4(c, 1.0);
            }`,
        }),
      ),
    )
    scene.add(new THREE.HemisphereLight('#7385c0', '#1a1420', 0.38))
    const moon = new THREE.DirectionalLight('#b8c6ff', 0.32)
    moon.position.set(-400, 600, -300)
    scene.add(moon)

    /* --- the ground: an illustrated night map draped on the terrain --- */
    const S = MOBILE ? 2048 : 4096
    const map = document.createElement('canvas')
    map.width = map.height = S
    const glow = document.createElement('canvas')
    glow.width = glow.height = S
    const g = map.getContext('2d')
    const gg = glow.getContext('2d')
    const k = S / (2 * R)
    const P = ([x, z]) => [(x + R) * k, (z + R) * k]
    const poly = (ctx, pts) => {
      ctx.beginPath()
      pts.forEach((p, i) => (i ? ctx.lineTo(...P(p)) : ctx.moveTo(...P(p))))
      ctx.closePath()
    }
    g.fillStyle = '#1b1d26'
    g.fillRect(0, 0, S, S)
    gg.fillStyle = '#000'
    gg.fillRect(0, 0, S, S)
    const AREA = { w: '#14281c', g: '#1d3a26', p: '#24432c', a: '#0f2240' }
    for (const k2 of ['w', 'g', 'p', 'a'])
      for (const a of DATA.areas.filter((a) => a.k === k2)) {
        g.fillStyle = AREA[k2]
        poly(g, a.p)
        g.fill()
      }
    // the campus itself, a little warmer
    g.fillStyle = 'rgba(70, 58, 52, 0.28)'
    poly(g, DATA.campus)
    g.fill()
    const WID = { w: 13, r: 7, p: 4, f: 2.4 }
    const COL = { w: '#3b3a44', r: '#33323b', p: '#6b5a44', f: '#5c4e3c' }
    for (const kk of ['r', 'w', 'p', 'f'])
      for (const path of DATA.paths.filter((p) => p.k === kk)) {
        g.strokeStyle = COL[kk]
        g.lineWidth = WID[kk] * k
        g.lineCap = g.lineJoin = 'round'
        g.beginPath()
        path.p.forEach((p, i) => (i ? g.lineTo(...P(p)) : g.moveTo(...P(p))))
        g.stroke()
        // lamplight along the way: warm on campus walks, sodium on roads
        gg.strokeStyle = kk === 'w' ? 'rgba(255,170,90,0.55)' : kk === 'r' ? 'rgba(255,170,90,0.28)' : 'rgba(255,214,150,0.42)'
        gg.lineWidth = WID[kk] * k * 1.6
        gg.lineCap = gg.lineJoin = 'round'
        gg.beginPath()
        path.p.forEach((p, i) => (i ? gg.lineTo(...P(p)) : gg.moveTo(...P(p))))
        gg.stroke()
      }
    // soft footprint shadows
    g.fillStyle = 'rgba(5, 6, 12, 0.55)'
    for (const b of DATA.buildings) {
      poly(g, b.p.map(([x, z]) => [x + 2.5, z + 2.5]))
      g.fill()
    }
    const mapTex = new THREE.CanvasTexture(map)
    mapTex.colorSpace = THREE.SRGBColorSpace
    mapTex.anisotropy = 8
    const glowTex = new THREE.CanvasTexture(glow)
    glowTex.colorSpace = THREE.SRGBColorSpace
    const tg = new THREE.PlaneGeometry(2 * R, 2 * R, T.n - 1, T.n - 1)
    tg.rotateX(-Math.PI / 2)
    const pos = tg.attributes.position
    for (let i = 0; i < pos.count; i++) pos.setY(i, this.ground(pos.getX(i), pos.getZ(i)))
    tg.computeVertexNormals()
    const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ map: mapTex, emissiveMap: glowTex, emissive: '#ffffff', emissiveIntensity: 0.9, roughness: 0.95 }))
    scene.add(terrain)

    /* --- buildings: extruded footprints on the hillside, windows lit --- */
    const stopOf = Object.fromEntries(STOPS.filter((s) => s.hall).map((s, i) => [s.hall, STOPS.indexOf(s)]))
    const geos = []
    this.halls = []
    let palaceB = null
    DATA.buildings.forEach((b, idx) => {
      let base = Infinity
      let top = -Infinity
      for (const [x, z] of b.p) {
        const h = this.ground(x, z)
        base = Math.min(base, h)
        top = Math.max(top, h)
      }
      const shape = new THREE.Shape(b.p.map(([x, z]) => new THREE.Vector2(x, -z)))
      const height = b.h + (top - base)
      const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false })
      geo.rotateX(-Math.PI / 2)
      geo.translate(0, base - 0.5, 0)
      const n = geo.attributes.position.count
      const info = new Float32Array(n * 4)
      const stop = b.n in stopOf ? stopOf[b.n] : -1
      for (let i = 0; i < n; i++) info.set([b.c, hash(idx + 1), base, stop], i * 4)
      geo.setAttribute('aInfo', new THREE.BufferAttribute(info, 4))
      geos.push(geo)
      if (b.n) {
        const cxz = b.p.reduce((a, [x, z]) => [a[0] + x / b.p.length, a[1] + z / b.p.length], [0, 0])
        this.halls.push({ name: b.n, anchor: new THREE.Vector3(cxz[0], base + height + 6, cxz[1]), stop })
      }
      if (b.n === '평화의전당') palaceB = { b, base, height }
    })
    // 평화의전당: twin towers at its south corners, pinnacles, a glowing rose.
    if (palaceB) {
      const { b, base } = palaceB
      const xs = b.p.map((p) => p[0])
      const zs = b.p.map((p) => p[1])
      const x0 = Math.min(...xs), x1 = Math.max(...xs), zf = Math.max(...zs)
      const tw = 15
      const add = (geo) => {
        const n = geo.attributes.position.count
        const info = new Float32Array(n * 4)
        for (let i = 0; i < n; i++) info.set([1, 0.37, base, STOPS.findIndex((s) => s.key === 'palace')], i * 4)
        geo.setAttribute('aInfo', new THREE.BufferAttribute(info, 4))
        const g2 = geo.index ? geo.toNonIndexed() : geo
        geos.push(g2)
      }
      for (const tx of [x0 + 12 + tw / 2, x1 - 12 - tw / 2]) {
        const t = new THREE.BoxGeometry(tw, 50, tw)
        t.translate(tx, base + 25, zf - tw / 2 - 1)
        add(t)
        for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const c = new THREE.ConeGeometry(1.4, 7, 4)
          c.rotateY(Math.PI / 4)
          c.translate(tx + (dx * tw) / 2.2, base + 53.5, zf - tw / 2 - 1 + (dz * tw) / 2.2)
          add(c)
        }
      }
      const gable = new THREE.ConeGeometry(14, 14, 4)
      gable.rotateY(Math.PI / 4)
      gable.scale(1, 1, 0.3)
      gable.translate((x0 + x1) / 2, base + 36, zf - 4)
      add(gable)
      // the rose, lit
      const rose = new THREE.Mesh(new THREE.CircleGeometry(4.2, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb36b').multiplyScalar(2.4) }))
      rose.position.set((x0 + x1) / 2, base + 27, zf + 0.4)
      scene.add(rose)
      this.palacePos = new THREE.Vector3((x0 + x1) / 2, base + 26, zf)
    }
    const flat = geos.map((g2) => {
      const out = g2.index ? g2.toNonIndexed() : g2
      for (const key of Object.keys(out.attributes)) if (!['position', 'normal', 'uv', 'aInfo'].includes(key)) out.deleteAttribute(key)
      if (!out.attributes.uv) out.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(out.attributes.position.count * 2), 2))
      return out
    })
    const bmat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 })
    const U = this.u
    bmat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U)
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 aInfo;\nvarying vec4 vInfo;\nvarying vec3 vWP;\nvarying vec3 vWN;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvInfo = aInfo;\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);')
      sh.fragmentShader = sh.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec4 vInfo; varying vec3 vWP; varying vec3 vWN;
           uniform float uTime; uniform float uFocus; uniform float uFocusK;
           float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           // campus halls in pale granite, the city around in cooler concrete
           diffuseColor.rgb *= mix(vec3(0.42, 0.45, 0.55), vec3(0.86, 0.82, 0.76), vInfo.x);
           if (vWN.y > 0.5) diffuseColor.rgb *= 0.55;`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
           if (abs(vWN.y) < 0.5) {
             vec2 t = normalize(vec2(-vWN.z, vWN.x));
             float s = dot(vWP.xz, t);
             float fl = (vWP.y - vInfo.z) / 3.7;
             vec2 cell = vec2(floor(s / 3.3), floor(fl));
             vec2 f = vec2(fract(s / 3.3), fract(fl));
             float win = step(0.22, f.x) * step(f.x, 0.78) * step(0.3, f.y) * step(f.y, 0.82) * step(1.0, fl);
             float on = step(hh(cell + vInfo.y * 91.0), mix(0.32, 0.62, vInfo.x));
             vec3 warm = mix(vec3(1.0, 0.72, 0.42), vec3(0.85, 0.9, 1.0), step(0.8, hh(cell * 1.7 + 3.0)));
             float focus = step(abs(vInfo.w - uFocus), 0.1) * uFocusK;
             totalEmissiveRadiance += warm * win * on * (0.75 + 0.5 * focus);
             // the hall on screen glows gold along its walls
             totalEmissiveRadiance += vec3(1.0, 0.72, 0.38) * focus * 0.05;
           }`,
        )
    }
    scene.add(new THREE.Mesh(mergeGeometries(flat, false), bmat))

    /* --- trees: dark woods on the hill, magnolias along the walks --- */
    const rnd = ((s) => () => ((s = (s * 16807) % 2147483647) / 2147483647))(11)
    const pts = []
    const inPoly = (x, z, ring) => {
      let c = false
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, zi] = ring[i]
        const [xj, zj] = ring[j]
        if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c
      }
      return c
    }
    const maxTrees = tier(9000, 3500)
    for (const a of DATA.areas) {
      if (a.k !== 'w' && a.k !== 'g') continue
      const xs = a.p.map((p) => p[0])
      const zs = a.p.map((p) => p[1])
      const bx0 = Math.max(-R, Math.min(...xs)), bx1 = Math.min(R, Math.max(...xs))
      const bz0 = Math.max(-R, Math.min(...zs)), bz1 = Math.min(R, Math.max(...zs))
      const area = (bx1 - bx0) * (bz1 - bz0)
      const n = Math.min(1500, Math.round(area / (a.k === 'w' ? 140 : 600)))
      for (let i = 0; i < n && pts.length < maxTrees; i++) {
        const x = bx0 + rnd() * (bx1 - bx0)
        const z = bz0 + rnd() * (bz1 - bz0)
        if (inPoly(x, z, a.p)) pts.push([x, z, 0])
      }
    }
    // magnolias beside the campus walks
    for (const path of DATA.paths) {
      if (path.k !== 'p' && path.k !== 'f') continue
      for (let i = 1; i < path.p.length; i++) {
        const [ax, az] = path.p[i - 1]
        const [bx, bz] = path.p[i]
        const len = Math.hypot(bx - ax, bz - az)
        for (let d = 0; d < len; d += 26) {
          const t = d / len
          const nx = -(bz - az) / len
          const nz = (bx - ax) / len
          const side = rnd() < 0.5 ? -1 : 1
          const x = ax + (bx - ax) * t + nx * side * 5
          const z = az + (bz - az) * t + nz * side * 5
          if (inPoly(x, z, DATA.campus) && pts.length < maxTrees + 1500) pts.push([x, z, 1])
        }
      }
    }
    // woods in deep green; magnolias pale and faintly lit, like blossom under lamps
    const treeGeo = new THREE.IcosahedronGeometry(1, 1)
    const kinds = [pts.filter((p) => !p[2]), pts.filter((p) => p[2])]
    const mats = [
      new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }),
      new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true, emissive: '#6a3a46', emissiveIntensity: 0.55 }),
    ]
    const m = new THREE.Matrix4()
    const col = new THREE.Color()
    kinds.forEach((list, kind) => {
      const trees = new THREE.InstancedMesh(treeGeo, mats[kind], list.length)
      list.forEach(([x, z], i) => {
        const s = kind ? 2.2 + rnd() * 1.2 : 3 + rnd() * 3
        const y = this.ground(x, z) + s * 1.1
        m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * 6.28, 0)), new THREE.Vector3(s, s * 1.3, s))
        trees.setMatrixAt(i, m)
        if (kind) col.setHSL(0.97 + rnd() * 0.02, 0.5, 0.78 + rnd() * 0.1)
        else col.setHSL(0.28 + rnd() * 0.1, 0.5, 0.12 + rnd() * 0.08)
        trees.setColorAt(i, col)
      })
      scene.add(trees)
    })

    /* --- lamps: points of warm light along the campus walks --- */
    const lamps = []
    for (const path of DATA.paths) {
      const step = path.k === 'w' ? 26 : path.k === 'r' ? 34 : 20
      for (let i = 1; i < path.p.length; i++) {
        const [ax, az] = path.p[i - 1]
        const [bx, bz] = path.p[i]
        const len = Math.hypot(bx - ax, bz - az)
        for (let d = rnd() * step; d < len; d += step) {
          const x = ax + ((bx - ax) * d) / len
          const z = az + ((bz - az) * d) / len
          lamps.push(x, this.ground(x, z) + 5, z)
        }
      }
    }
    const lg = new THREE.BufferGeometry()
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lamps, 3))
    const lampMat = new THREE.ShaderMaterial({
      uniforms: { ...this.u, uPx: { value: this.renderer.getPixelRatio() } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `uniform float uPx; varying float vF; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * clamp(900.0 / -mv.z, 1.5, 14.0); vF = clamp(1.0 - (-mv.z) / 2600.0, 0.2, 1.0); }`,
      fragmentShader: `varying float vF; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vec3(1.0, 0.78, 0.5) * a * a * 1.6 * vF, 1.0); }`,
    })
    scene.add(new THREE.Points(lg, lampMat))

    /* --- monuments: the castle gate, the motto tower, the fountain --- */
    {
      const stone = new THREE.MeshStandardMaterial({ color: '#d8cfc0', roughness: 0.9, emissive: '#7a5a34', emissiveIntensity: 0.55 })
      const parts = []
      const put = (geo, x, y, z) => parts.push((geo.index ? geo.toNonIndexed() : geo).translate(x, y, z))
      // the gate spans the road: find the road's direction at the gate
      const [gx, gz] = L.gate
      let best = { d: Infinity, a: 0 }
      for (const path of DATA.paths) {
        if (path.k !== 'w' && path.k !== 'r') continue
        for (let i = 1; i < path.p.length; i++) {
          const [ax, az] = path.p[i - 1]
          const [bx, bz] = path.p[i]
          const d = Math.hypot((ax + bx) / 2 - gx, (az + bz) / 2 - gz)
          if (d < best.d) best = { d, a: Math.atan2(bz - az, bx - ax) }
        }
      }
      const gy = this.ground(gx, gz)
      // towers either side of an 8 m arch, with battlements
      for (const sx of [-1, 1]) {
        put(new THREE.BoxGeometry(6, 13, 6), sx * 8, 6.5, 0)
        for (let k = 0; k < 4; k++) put(new THREE.BoxGeometry(1.2, 1.4, 6.2), sx * 8 - 2.4 + k * 1.6, 13.7, 0)
      }
      put(new THREE.BoxGeometry(10.5, 3.2, 5), 0, 9.6, 0)
      for (let k = 0; k < 4; k++) put(new THREE.BoxGeometry(1.1, 1.1, 5.2), -3.6 + k * 2.4, 11.8, 0)
      // the arch soffit
      const arch = new THREE.TorusGeometry(5, 0.6, 6, 24, Math.PI)
      put(arch, 0, 3.4, 2.2)
      const gate = new THREE.Mesh(mergeGeometries(parts, false), stone)
      gate.position.set(gx, gy - 0.5, gz)
      gate.rotation.y = -best.a
      scene.add(gate)
      // 교시탑: a slender stone shaft with a lit crown
      const [mx, mz] = L.motto
      const my = this.ground(mx, mz)
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.6, 18, 8), stone)
      shaft.position.set(mx, my + 9, mz)
      scene.add(shaft)
      const crown = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd28a').multiplyScalar(3) }))
      crown.position.set(mx, my + 18.8, mz)
      scene.add(crown)
      // the fountain before 본관: a ring of lit water
      const [fx, fz] = L.fountain
      const fy = this.ground(fx, fz)
      const pool = new THREE.Mesh(new THREE.CircleGeometry(9, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color('#6fb4ff').multiplyScalar(1.1) }))
      pool.rotation.x = -Math.PI / 2
      pool.position.set(fx, fy + 0.6, fz)
      const rim = new THREE.Mesh(new THREE.TorusGeometry(9, 0.6, 6, 40), stone)
      rim.rotation.x = -Math.PI / 2
      rim.position.copy(pool.position)
      const jet = new THREE.Mesh(new THREE.ConeGeometry(2.2, 7, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color('#bfe0ff').multiplyScalar(1.4), transparent: true, opacity: 0.55, depthWrite: false }))
      jet.position.set(fx, fy + 4, fz)
      scene.add(pool, rim, jet)
    }

    /* --- tour --- */
    for (const s of STOPS) {
      const [x, z] = s.key === 'palace' && this.palacePos ? [this.palacePos.x, this.palacePos.z] : L[s.key]
      const gy = this.ground(x, z)
      s.target = new THREE.Vector3(x, gy + (s.key === 'palace' ? 24 : s.key === 'gate' || s.key === 'motto' ? 6 : 10), z)
    }
    this.labels = [
      ...STOPS.map((s, i) => ({ name: s.name, anchor: s.target.clone().add(new THREE.Vector3(0, s.key === 'palace' ? 36 : 14, 0)), stop: true, i })),
      ...this.halls.filter((h) => h.stop < 0 && !/^\d|동$/.test(h.name)).map((h) => ({ name: h.name, anchor: h.anchor, stop: false })),
    ]
    this.labels.forEach((l) => (l.alpha = 0))
    this.built = true
  }

  // Where the tour stands: which stop, and how far into its shot.
  segment() {
    const p = this.progress
    const A = 0.08
    const B = 0.94
    const n = STOPS.length
    if (p < A) return { i: -1, t: p / A }
    if (p > B) return { i: n, t: (p - B) / (1 - B) }
    const f = ((p - A) / (B - A)) * n
    const i = Math.min(n - 1, Math.floor(f))
    return { i, t: f - i }
  }

  stopIndex() {
    const { i, t } = this.segment()
    return i >= 0 && i < STOPS.length && t > 0.22 && t < 0.92 ? i : -1
  }

  // Camera for a stop at angle offset `spin`.
  shot(s, spin) {
    const a = s.a + spin
    return {
      pos: new THREE.Vector3(s.target.x + Math.cos(a) * s.r, s.target.y + s.h, s.target.z + Math.sin(a) * s.r),
      look: s.target.clone(),
    }
  }

  overview(k) {
    // The whole campus from the south-west, high.
    return {
      pos: new THREE.Vector3(-520 + k * 120, 520 - k * 80, 720 - k * 120),
      look: new THREE.Vector3(0, 0, -120),
    }
  }

  finale(k) {
    const pp = this.palacePos || new THREE.Vector3(0, 30, -330)
    const a = 1.75 + k * 0.9
    return { pos: new THREE.Vector3(pp.x + Math.cos(a) * (220 + k * 260), pp.y + 90 + k * 200, pp.z + Math.sin(a) * (220 + k * 260)), look: pp.clone().add(new THREE.Vector3(0, -10, 80 * k)) }
  }

  cameraAt() {
    const { i, t } = this.segment()
    const n = STOPS.length
    const sm = (x) => x * x * (3 - 2 * x)
    const lerpShot = (a, b, k) => ({ pos: a.pos.clone().lerp(b.pos, k), look: a.look.clone().lerp(b.look, k) })
    if (i < 0) return lerpShot(this.overview(0), this.overview(1), sm(t))
    if (i >= n) return lerpShot(this.shot(STOPS[n - 1], 0.5), this.finale(sm(t)), sm(Math.min(1, t * 1.4)))
    // within a stop: fly in over the first fifth, then a slow arc round it
    const s = STOPS[i]
    const prev = i === 0 ? this.overview(1) : this.shot(STOPS[i - 1], 0.5)
    const here = this.shot(s, ((t - 0.22) / 0.78) * 0.5)
    if (t < 0.22) {
      const k = sm(t / 0.22)
      const c = lerpShot(prev, this.shot(s, 0), k)
      // lift over the hill between stops
      c.pos.y += Math.sin(Math.PI * k) * 40
      return c
    }
    return here
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
    this.camera.fov = w / h < 0.8 ? 62 : 45
    this.camera.updateProjectionMatrix()
  }

  screen(v) {
    const p = v.clone().project(this.camera)
    if (p.z > 1) return null
    return { x: (p.x * 0.5 + 0.5) * this._w, y: (-p.y * 0.5 + 0.5) * this._h }
  }

  placeLabels(els, w, h) {
    if (!this.built) return
    const stop = this.stopIndex()
    const cam = this.camera.position
    const cand = []
    this.labels.forEach((l, i) => {
      const d = cam.distanceTo(l.anchor)
      const sc = d < (l.stop ? 3000 : 520) && this.screen(l.anchor)
      if (sc && sc.x > 20 && sc.x < w - 20 && sc.y > 80 && sc.y < h - 40) cand.push({ i, d: l.stop ? d * 0.2 : d, sc })
    })
    cand.sort((a, b) => a.d - b.d)
    const placed = []
    const shown = new Set()
    const max = MOBILE ? 6 : 16
    for (const c of cand) {
      if (placed.length >= max) break
      const el = els[c.i]
      const lw = el.offsetWidth || 70
      if (placed.some((p) => Math.abs(p.x - c.sc.x) < (p.w + lw) / 2 + 6 && Math.abs(p.y - c.sc.y) < 26)) continue
      placed.push({ x: c.sc.x, y: c.sc.y, w: lw })
      shown.add(c.i)
      el.style.transform = `translate(${c.sc.x.toFixed(1)}px, ${c.sc.y.toFixed(1)}px) translate(-50%, -100%)`
    }
    this.labels.forEach((l, i) => {
      const want = shown.has(i) ? (l.stop && l.i !== stop && stop >= 0 ? 0.55 : 1) : 0
      l.alpha += (want - l.alpha) * 0.15
      els[i].style.opacity = l.alpha.toFixed(2)
    })
  }

  render(dt) {
    this.resize()
    if (!this.built) return
    this.time += dt
    this.u.uTime.value = this.time
    const si = this.stopIndex()
    const { i } = this.segment()
    const fi = i >= 0 && i < STOPS.length ? i : -1
    this.u.uFocus.value = fi
    this.u.uFocusK.value += ((si >= 0 ? 1 : 0) - this.u.uFocusK.value) * Math.min(1, dt * 3)
    this.ps.lerp(this.pointer, Math.min(1, dt * 2))
    const c = this.cameraAt()
    c.pos.x += this.ps.x * 8
    c.pos.y -= this.ps.y * 5
    this.camera.position.copy(c.pos)
    this.camera.lookAt(c.look)
    this.composer.render(dt)
  }
}
