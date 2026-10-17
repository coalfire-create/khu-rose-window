import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { stoneMaterial } from './stone.js'

// 경희's halls, built in detail from a footprint's box: the castle-like
// granite of 중앙도서관 (octagonal twin turrets, battlements, a clock, pointed
// windows), the granite grids of 법과대학 with their gothic towers, the
// white modern colleges with ribbon windows, 크라운관's crown of arches, and
// small classical lodges. Every hall writes into shared bins so a whole
// campus is a handful of draw calls.
//
// const kit = hallKit(); kit.hall(style, w, d, h, matrix, seed); kit.meshes()
// Local space: centred on the footprint, ground at y = 0, front face at
// z = +d/2 facing +z, width along x.

export function hallKit() {
  const bins = { stone: [], trim: [], white: [], dark: [], roof: [], lit: [], unlit: [], stained: [] }
  let M = new THREE.Matrix4()
  let seed = 1
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const put = (bin, geo) => {
    const g = (geo.index ? geo.toNonIndexed() : geo).applyMatrix4(M)
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k)
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
    bins[bin].push(g)
  }
  const box = (bin, w, h, d, x, y, z) => put(bin, new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z))
  // a window pane on one of the four faces; side 0 front (+z), 1 back, 2 right (+x), 3 left
  const pane = (bin, w, h, u, y, side, W, D, inset = 0.02) => {
    const g = new THREE.PlaneGeometry(w, h)
    const rot = [0, Math.PI, Math.PI / 2, -Math.PI / 2][side]
    g.rotateY(rot)
    const off = side < 2 ? D / 2 + inset : W / 2 + inset
    const [x, z] = side === 0 ? [u, off] : side === 1 ? [-u, -off] : side === 2 ? [off, -u] : [-off, u]
    g.translate(x, y + h / 2, z)
    put(bin, g)
  }
  const lw = (p = 0.5) => (rnd() < p ? 'lit' : 'unlit')
  // a pointed head over a window
  const head = (w, u, y, side, W, D, bin = 'trim') => {
    const g = new THREE.ConeGeometry(w * 0.72, w * 0.75, 4).rotateY(Math.PI / 4).scale(1, 1, 0.18)
    const rot = [0, Math.PI, Math.PI / 2, -Math.PI / 2][side]
    g.rotateY(rot)
    const off = (side < 2 ? D / 2 : W / 2) + 0.05
    const [x, z] = side === 0 ? [u, off] : side === 1 ? [-u, -off] : side === 2 ? [off, -u] : [-off, u]
    g.translate(x, y + w * 0.37, z)
    put(bin, g)
  }
  const battlements = (bin, w, d, y, step = 1.6, ox = 0, oz = 0) => {
    for (const [len, ax, fixed] of [[w, 'x', d / 2], [w, 'x', -d / 2], [d, 'z', w / 2], [d, 'z', -w / 2]]) {
      const n = Math.floor(len / step)
      for (let i = 0; i < n; i += 2) {
        const t = -len / 2 + (i + 0.5) * (len / n)
        if (ax === 'x') box(bin, len / n, 1.1, 0.6, ox + t, y, oz + fixed - Math.sign(fixed) * 0.3)
        else box(bin, 0.6, 1.1, len / n, ox + fixed - Math.sign(fixed) * 0.3, y, oz + t)
      }
    }
  }
  // windows on all four faces in a regular grid
  const grid = (W, D, H, { bay = 3.4, floor = 3.8, ww = 1.5, wh = 2.4, pointed = false, lit = 0.45, bin, y0 = 1.8, top = 1.6 } = {}) => {
    const floors = Math.max(1, Math.floor((H - y0 - top) / floor))
    for (let side = 0; side < 4; side++) {
      const len = side < 2 ? W : D
      const n = Math.max(1, Math.floor((len - 2) / bay))
      for (let f = 0; f < floors; f++)
        for (let i = 0; i < n; i++) {
          const u = -((n - 1) * bay) / 2 + i * bay
          const y = y0 + f * floor + (floor - wh) * 0.45
          pane(bin || lw(lit), ww, wh, u, y, side, W, D)
          if (pointed) head(ww, u, y + wh, side, W, D)
        }
    }
  }

  const styles = {
    // 중앙도서관: a broad granite block, a projecting central tower front
    // between two octagonal turrets, battlements all round, a clock.
    library(W, D, H) {
      box('stone', W, H, D, 0, 0, 0)
      box('trim', W + 0.5, 1.6, D + 0.5, 0, 0, 0)
      box('trim', W + 0.6, 0.7, D + 0.6, 0, H - 0.7, 0)
      box('roof', W - 1.4, 0.12, D - 1.4, 0, H, 0)
      battlements('stone', W, D, H)
      grid(W, D, H, { pointed: true, lit: 0.55, bay: 3.6 })
      const cw = Math.min(16, W * 0.38)
      const ch = H + 9
      const z = D / 2 + 2
      box('stone', cw, ch, 4, 0, 0, z - 1.5)
      battlements('stone', cw, 4, ch, 1.4, 0, z - 1.5)
      // tall pointed windows up the tower front, the top row in stained glass
      for (let f = 0; f < 3; f++)
        for (const u of [-cw / 4, 0, cw / 4]) {
          const y = 5 + f * ((ch - 9) / 3)
          pane(f === 2 ? 'stained' : lw(0.7), 1.7, (ch - 12) / 3 - 1.2, u, y, 0, cw, 2 * z + 1)
        }
      // clock
      const clock = new THREE.CircleGeometry(1.6, 32).translate(0, ch - 3.4, z + 0.55)
      put('lit', clock)
      put('trim', new THREE.TorusGeometry(1.7, 0.18, 6, 32).translate(0, ch - 3.4, z + 0.6))
      // the portal
      box('dark', 3.2, 4.6, 0.4, 0, 0.8, z + 0.42)
      put('trim', new THREE.TorusGeometry(1.9, 0.35, 6, 20, Math.PI).translate(0, 5.4, z + 0.55))
      // octagonal turrets with crenellated crowns
      for (const sx of [-1, 1]) {
        const x = sx * (cw / 2 + 1.6)
        put('stone', new THREE.CylinderGeometry(2.4, 2.6, ch + 4, 8).translate(x, (ch + 4) / 2, z - 0.6))
        put('trim', new THREE.CylinderGeometry(2.9, 2.6, 0.9, 8).translate(x, ch + 3.6, z - 0.6))
        for (let k = 0; k < 8; k += 1) {
          if (k % 2) continue
          const a = (k / 8) * Math.PI * 2
          box('stone', 1.0, 1.1, 1.0, x + Math.cos(a) * 2.4, ch + 4, z - 0.6 + Math.sin(a) * 2.4)
        }
      }
      // slit windows on the turrets (front-facing)
      for (const sx of [-1, 1])
        for (let f = 0; f < 5; f++) {
          const g = new THREE.PlaneGeometry(0.7, 2.0).translate(sx * (cw / 2 + 1.6), 4 + f * ((ch - 4) / 5), z + 1.95)
          put(lw(0.6), g)
        }
    },
    // 법과대학: a granite grid of piers and spandrels; a gothic tower.
    granite(W, D, H, opts) {
      box('stone', W, H, D, 0, 0, 0)
      box('trim', W + 0.5, 1.6, D + 0.5, 0, 0, 0)
      const bay = 3.2
      for (let side = 0; side < 4; side++) {
        const len = side < 2 ? W : D
        const n = Math.floor(len / bay)
        for (let i = 0; i <= n; i++) {
          const u = -len / 2 + i * (len / n)
          const g = new THREE.BoxGeometry(0.55, H - 2.2, 0.45)
          const rot = [0, Math.PI, Math.PI / 2, -Math.PI / 2][side]
          g.rotateY(rot)
          const off = (side < 2 ? D : W) / 2 + 0.2
          const [x, z] = side === 0 ? [u, off] : side === 1 ? [-u, -off] : side === 2 ? [off, -u] : [-off, u]
          g.translate(x, 1.6 + (H - 2.2) / 2, z)
          put('trim', g)
        }
      }
      grid(W, D, H, { bay: 3.2, ww: 2.1, wh: 2.2, lit: 0.42 })
      box('trim', W + 0.8, 1.1, D + 0.8, 0, H - 0.6, 0)
      box('trim', W - 0.2, 0.7, D - 0.2, 0, H + 0.5, 0)
      box('roof', W - 1.2, 0.12, D - 1.2, 0, H + 1.2, 0)
      if (opts.tower) {
        const tw = Math.min(10, W * 0.25)
        const th = H + 10
        const x = W / 2 - tw / 2 - 1
        box('stone', tw, th, tw, x, 0, D / 2 - tw / 2 + 1)
        battlements('stone', tw, tw, th, 1.3, x, D / 2 - tw / 2 + 1)
        for (const sx of [-1, 1]) {
          put('stone', new THREE.CylinderGeometry(0.9, 1.1, th + 3, 8).translate(x + sx * (tw / 2), (th + 3) / 2, D / 2 + 1))
          put('stone', new THREE.ConeGeometry(1.1, 2.4, 8).translate(x + sx * (tw / 2), th + 4.2, D / 2 + 1))
        }
        for (let f = 0; f < 2; f++)
          for (const u of [-tw / 4, tw / 4]) {
            const g = new THREE.PlaneGeometry(1.4, 4.2).translate(x + u, H + 1.5 + f * 4.6, D / 2 + 1.05)
            put(f ? 'stained' : lw(0.7), g)
            put('trim', new THREE.ConeGeometry(1.0, 1.0, 4).rotateY(Math.PI / 4).scale(1, 1, 0.2).translate(x + u, H + 1.5 + f * 4.6 + 4.6, D / 2 + 1.1))
          }
      }
    },
    // the white colleges: ribbon windows, a stair core, rooftop plant
    modern(W, D, H) {
      box('white', W, H, D, 0, 0, 0)
      const floor = 3.6
      const floors = Math.floor((H - 2) / floor)
      for (let f = 0; f < floors; f++) {
        const y = 1.8 + f * floor + 0.9
        for (let side = 0; side < 4; side++) {
          const len = (side < 2 ? W : D) - 2.4
          const n = Math.max(1, Math.floor(len / 2.2))
          for (let i = 0; i < n; i++) pane(lw(0.4), len / n - 0.25, 1.7, -len / 2 + (i + 0.5) * (len / n), y, side, W, D)
        }
      }
      box('white', W + 0.4, 0.6, D + 0.4, 0, H, 0)
      box('roof', W - 0.6, 0.12, D - 0.6, 0, H + 0.6, 0)
      // stair core, glazed
      const cx = (rnd() - 0.5) * W * 0.6
      box('white', 5, H + 3.5, 5, cx, 0, D / 2 - 1)
      for (let f = 0; f < floors; f++) {
        const g = new THREE.PlaneGeometry(3.2, floor - 0.5).translate(cx, 1.8 + f * floor + floor / 2, D / 2 + 1.52)
        put('lit', g)
      }
      box('dark', W * 0.3, 2.2, D * 0.3, (rnd() - 0.5) * W * 0.3, H + 0.6, (rnd() - 0.5) * D * 0.3)
    },
    // 크라운관: a long low hall crowned with a row of arches, a curved tower
    crown(W, D, H) {
      const lowH = Math.min(H, 12)
      box('white', W, lowH, D, 0, 0, 0)
      const n = Math.max(4, Math.floor(W / 4.4))
      for (let i = 0; i < n; i++) {
        const x = -W / 2 + (i + 0.5) * (W / n)
        put('white', new THREE.CylinderGeometry(W / n / 2, W / n / 2, D, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(x, lowH, 0))
        // the scallop's tip
        put('white', new THREE.ConeGeometry(0.5, 2.2, 8).translate(-W / 2 + i * (W / n), lowH + 1.6, D / 2 - 0.4))
      }
      // arcade at the ground
      for (let i = 0; i < n; i++) put('dark', new THREE.PlaneGeometry(W / n - 1.2, 4).translate(-W / 2 + (i + 0.5) * (W / n), 3, D / 2 + 0.02))
      // the curved-top tower block at one end
      const tw = Math.min(16, W * 0.35)
      const th = Math.max(H, 24)
      const tx = W / 2 - tw / 2
      box('white', tw, th, D * 0.8, tx, 0, -D * 0.1)
      const sh = new THREE.Shape()
      sh.moveTo(-tw / 2, 0)
      sh.lineTo(tw / 2, 0)
      sh.lineTo(tw / 2, 4)
      sh.quadraticCurveTo(0, -1, -tw / 2, 3)
      sh.lineTo(-tw / 2, 0)
      put('white', new THREE.ExtrudeGeometry(sh, { depth: D * 0.8, bevelEnabled: false }).translate(tx, th, -D * 0.5))
      for (let f = 0; f < Math.floor(th / 3.6) - 1; f++)
        for (let i = 0; i < 4; i++) {
          const g = new THREE.PlaneGeometry(tw / 4 - 0.8, 1.6).translate(tx - tw / 2 + (i + 0.5) * (tw / 4), 2.4 + f * 3.6, D * 0.3 + 0.02)
          put(lw(0.45), g)
        }
    },
    // a small classical lodge: columns and a pediment
    classic(W, D, H) {
      box('stone', W, H, D, 0, 0, 0)
      box('trim', W + 0.5, 1.4, D + 0.5, 0, 0, 0)
      grid(W, D, H, { bay: 3.4, ww: 1.4, wh: 2.5, lit: 0.5 })
      const cols = Math.max(4, Math.min(8, Math.floor(W / 3.4)))
      for (let i = 0; i < cols; i++) {
        const x = -((cols - 1) * 2.8) / 2 + i * 2.8
        put('trim', new THREE.CylinderGeometry(0.5, 0.58, H - 1.4, 12).translate(x, 1.4 + (H - 1.4) / 2, D / 2 + 1.8))
      }
      box('trim', cols * 2.8 + 1.4, 1.2, 3.2, 0, H - 0.2, D / 2 + 1)
      const s = new THREE.Shape()
      const pw = cols * 2.8 + 1.6
      s.moveTo(-pw / 2, 0)
      s.lineTo(pw / 2, 0)
      s.lineTo(0, pw * 0.2)
      s.lineTo(-pw / 2, 0)
      put('trim', new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: false }).translate(0, H + 1, D / 2 - 0.4))
      box('trim', W + 1, 0.8, D + 1, 0, H, 0)
      box('roof', W - 0.4, 0.12, D - 0.4, 0, H + 0.8, 0)
    },
  }

  return {
    hall(style, w, d, h, matrix, s = 1, opts = {}) {
      M = matrix
      seed = Math.max(1, Math.floor(s * 2147483646))
      ;(styles[style] || styles.granite)(w, d, h, opts)
    },
    meshes({ lit = 1.15, night = 0 } = {}) {
      // (night: a faint warm glow in the stone, as if floodlit, for scenes
      // with little light of their own)
      const glow = (c) => new THREE.Color(c).multiplyScalar(night)
      const mats = {
        stone: stoneMaterial('#d6cfc4', { scale: 0.2, emissive: glow('#4a3c2c') }),
        trim: stoneMaterial('#e7e1d7', { scale: 0.28, roughness: 0.82, emissive: glow('#55473a') }),
        white: new THREE.MeshStandardMaterial({ color: '#e4e2dc', roughness: 0.9, emissive: glow('#3a3a40') }),
        dark: new THREE.MeshStandardMaterial({ color: '#25222a', roughness: 0.9 }),
        roof: new THREE.MeshStandardMaterial({ color: '#34363d', roughness: 0.7, metalness: 0.2 }),
        lit: new THREE.MeshStandardMaterial({ color: '#2a2018', emissive: '#ffc47a', emissiveIntensity: lit }),
        unlit: new THREE.MeshStandardMaterial({ color: '#141824', roughness: 0.15, metalness: 0.5 }),
        stained: new THREE.MeshStandardMaterial({ color: '#1a1020', emissive: '#d0607e', emissiveIntensity: 0.9 }),
      }
      const group = new THREE.Group()
      for (const [k, list] of Object.entries(bins)) if (list.length) group.add(new THREE.Mesh(mergeGeometries(list, false), mats[k]))
      return group
    },
  }
}

// Which kind of hall a campus building is, by name.
export function styleFor(name = '') {
  if (/중앙도서관/.test(name)) return ['library']
  if (/^법과대학$|네오르네상스관/.test(name)) return ['granite', { tower: true }]
  if (/한의과대학|법학|제2법학관/.test(name)) return ['granite', { tower: /^한의과대학$/.test(name) }]
  if (/음악대학/.test(name)) return ['crown']
  if (/교수회관|공관/.test(name)) return ['classic']
  if (/문과|이과|정경|학생회관|생활과학|호텔관광|미술|무용|의과|약학|치의학|치과|청운관|의료원|병원|국제|사이버|약학/.test(name)) return ['modern']
  return null
}

// Oriented box of a footprint: centre, width (long side), depth, angle of the
// long side, and how much of the box the footprint fills.
export function footprintBox(pts) {
  const area = Math.abs(pts.reduce((a, [x, z], i) => {
    const [x2, z2] = pts[(i + 1) % pts.length]
    return a + x * z2 - x2 * z
  }, 0)) / 2
  let best = null
  for (let i = 0; i < pts.length - 1; i++) {
    const a = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0])
    const c = Math.cos(a)
    const s = Math.sin(a)
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity
    for (const [x, z] of pts) {
      const u = x * c + z * s
      const v = -x * s + z * c
      u0 = Math.min(u0, u)
      u1 = Math.max(u1, u)
      v0 = Math.min(v0, v)
      v1 = Math.max(v1, v)
    }
    const A = (u1 - u0) * (v1 - v0)
    if (!best || A < best.A) {
      const uc = (u0 + u1) / 2
      const vc = (v0 + v1) / 2
      best = { A, a, w: u1 - u0, d: v1 - v0, cx: uc * c - vc * s, cz: uc * s + vc * c }
    }
  }
  if (best.d > best.w) ((best.a += Math.PI / 2), ([best.w, best.d] = [best.d, best.w]))
  best.fill = area / best.A
  return best
}
