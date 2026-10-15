import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { stoneMaterial } from './stone.js'
import { pixelRatio, tier } from '../device.js'

// The finale: 경희's castle-like main gate at night, modelled after
// photographs — a broad round arch between two crenellated towers, the left
// one taller, a smaller arch to the right. The canvas is transparent: the
// light behind the arch is the prism burst underneath. Scroll walks up the
// road and through the arch into that light.

export class Gate {
  constructor(canvas) {
    this.canvas = canvas
    this.progress = 0
    this.time = 0
    this.pointer = new THREE.Vector2()
    this.ps = new THREE.Vector2()
    addEventListener('pointermove', (e) => this.pointer.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1), { passive: true })

    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true }))
    r.setPixelRatio(pixelRatio(1.25, 1.75))
    r.setClearColor(0x000000, 0)
    r.toneMapping = THREE.ACESFilmicToneMapping
    r.toneMappingExposure = 1.05
    const scene = (this.scene = new THREE.Scene())
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.2, 400)

    /* the gate */
    const parts = []
    const box = (w, h, d, x, y, z) => parts.push(new THREE.BoxGeometry(w, h, d).toNonIndexed().translate(x, y + h / 2, z))
    const battlements = (x0, x1, y, z, d) => {
      const n = Math.max(3, Math.round((x1 - x0) / 1.1))
      for (let i = 0; i < n; i += 2) box((x1 - x0) / n, 1.1, d, x0 + ((i + 0.5) * (x1 - x0)) / n, y, z)
    }
    // the wall with its arches cut out
    const wall = new THREE.Shape()
    wall.moveTo(-15, 0)
    wall.lineTo(17, 0)
    wall.lineTo(17, 9)
    wall.lineTo(9.5, 9)
    wall.lineTo(9.5, 11)
    wall.lineTo(-15, 11)
    wall.lineTo(-15, 0)
    const main = new THREE.Path()
    main.moveTo(-4.6, 0)
    main.lineTo(4.6, 0)
    main.lineTo(4.6, 5.6)
    main.absarc(0, 5.6, 4.6, 0, Math.PI, false)
    main.lineTo(-4.6, 0)
    wall.holes.push(main)
    const side = new THREE.Path()
    side.moveTo(10.6, 0)
    side.lineTo(14.2, 0)
    side.lineTo(14.2, 4)
    side.absarc(12.4, 4, 1.8, 0, Math.PI, false)
    side.lineTo(10.6, 0)
    wall.holes.push(side)
    parts.push(new THREE.ExtrudeGeometry(wall, { depth: 5, bevelEnabled: false, curveSegments: 24 }).translate(0, 0, -2.5))
    // arch voussoir rings
    parts.push(new THREE.TorusGeometry(4.95, 0.42, 8, 32, Math.PI).toNonIndexed().translate(0, 5.6, 2.6))
    parts.push(new THREE.TorusGeometry(2.1, 0.3, 8, 24, Math.PI).toNonIndexed().translate(12.4, 4, 2.6))
    // towers: the left taller and broader
    box(7.4, 15.5, 7, -10.2, 0, 0)
    box(6.4, 13.5, 6.4, 7.6, 0, 0)
    // corbelled tops and battlements
    box(8.2, 0.8, 7.8, -10.2, 14.2, 0)
    box(7.2, 0.8, 7.2, 7.6, 12.2, 0)
    battlements(-14.3, -6.1, 15, 3.6, 0.8)
    battlements(-14.3, -6.1, 15, -3.6, 0.8)
    battlements(4.0, 11.2, 13, 3.3, 0.8)
    battlements(4.0, 11.2, 13, -3.3, 0.8)
    battlements(-6.4, 4.2, 11, 2.2, 0.7)
    battlements(11.2, 17, 9, 2.2, 0.6)
    // a plinth course
    box(32.5, 0.9, 5.6, 1, 0, 0)
    const stone = stoneMaterial('#cbbfae', { scale: 0.33, roughness: 0.92 })
    const gate = new THREE.Mesh(mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => {
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k)
      return g
    }), false), stone)
    scene.add(gate)
    this.gateMesh = gate

    // lanterns on the gate, warm
    const lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffcf8a').multiplyScalar(2.2) })
    for (const [x, y] of [[-6.4, 7.6], [6.0, 7.6], [9.8, 6.4], [-13.4, 8.6]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.7, 0.45), lamp)
      m.position.set(x, y, 3.8)
      scene.add(m)
      const pl = new THREE.PointLight('#ffc27a', 26, 16, 2)
      pl.position.set(x, y, 4.6)
      scene.add(pl)
    }
    // light from beyond the arch: a warm wash on the soffit and the road
    const through = new THREE.PointLight('#ffd9a0', 220, 60, 1.6)
    through.position.set(0, 5, -6)
    scene.add(through)
    this.through = through
    scene.add(new THREE.HemisphereLight('#5b6aa8', '#120c12', 0.45))
    const key = new THREE.SpotLight('#ffe3c0', 900, 90, 0.6, 0.8, 2)
    key.position.set(-8, 1, 26)
    key.target.position.set(-2, 8, 0)
    scene.add(key, key.target)
    const key2 = new THREE.SpotLight('#ffe3c0', 700, 90, 0.6, 0.8, 2)
    key2.position.set(12, 1, 24)
    key2.target.position.set(8, 7, 0)
    scene.add(key2, key2.target)

    // the road up to it, wet and catching the light
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 100),
      new THREE.MeshStandardMaterial({ color: '#17151b', roughness: 0.35, metalness: 0.2 }),
    )
    road.rotation.x = -Math.PI / 2
    road.position.set(0, 0, 47)
    scene.add(road)
    const marks = new THREE.MeshBasicMaterial({ color: '#6b6258' })
    for (let z = 8; z < 80; z += 6) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 2.6), marks)
      m.rotation.x = -Math.PI / 2
      m.position.set(0, 0.01, z)
      scene.add(m)
    }
    // trees either side, dark masses
    const tm = new THREE.MeshStandardMaterial({ color: '#0e1712', roughness: 1, flatShading: true })
    const trees = []
    for (let i = 0; i < 26; i++) {
      const sx = i % 2 ? 1 : -1
      const s = 3 + Math.random() * 3
      trees.push(new THREE.IcosahedronGeometry(s, 1).toNonIndexed().scale(1, 1.2, 1).translate(sx * (19 + Math.random() * 10), s * 1.3, 6 + Math.random() * 50))
    }
    scene.add(new THREE.Mesh(mergeGeometries(trees, false), tm))

    // motes of light drifting out through the arch
    const N = tier(900, 400)
    const pos = new Float32Array(N * 3)
    const seed = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30
      pos[i * 3 + 1] = Math.random() * 14
      pos[i * 3 + 2] = -10 + Math.random() * 50
      seed[i] = Math.random()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    this.motes = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPx: { value: r.getPixelRatio() }, uOpen: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aSeed; uniform float uTime; uniform float uPx; varying float vA;
        void main(){
          vec3 p = position;
          p.z = mod(p.z + uTime * (0.6 + aSeed * 1.4) + 10.0, 50.0) - 10.0;
          p.y += sin(uTime * 0.5 + aSeed * 30.0) * 0.6;
          p.x += cos(uTime * 0.4 + aSeed * 20.0) * 0.6;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uPx * (1.0 + aSeed * 2.5) * 30.0 / max(-mv.z, 0.5);
          vA = 0.4 + 0.6 * sin(uTime * (1.0 + aSeed * 2.0) + aSeed * 40.0) * 0.5 + 0.3;
        }`,
      fragmentShader: `uniform float uOpen; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vec3(1.0, 0.82, 0.55) * a * vA * (0.35 + uOpen), a * vA * (0.35 + uOpen)); }`,
    })
    scene.add(new THREE.Points(g, this.motes))

    this.path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-9, 2.6, 52),
      new THREE.Vector3(-4, 3.2, 34),
      new THREE.Vector3(-0.5, 3.6, 18),
      new THREE.Vector3(0, 3.8, 6),
      new THREE.Vector3(0, 4.2, -6),
    ])
    this.resize()
  }

  resize() {
    const w = this.canvas.clientWidth || innerWidth
    const h = this.canvas.clientHeight || innerHeight
    if (w === this._w && h === this._h) return
    this._w = w
    this._h = h
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.fov = w / h < 0.8 ? 66 : 46
    this.camera.updateProjectionMatrix()
  }

  render(dt) {
    this.resize()
    this.time += dt
    const p = this.progress
    // the walk: most of it while the story plays, then through the arch
    const walk = p < 0.56 ? (p / 0.56) * 0.62 : 0.62 + Math.min(1, (p - 0.56) / 0.3) * 0.38
    const t = walk * walk * (3 - 2 * walk)
    this.ps.lerp(this.pointer, Math.min(1, dt * 2))
    const pos = this.path.getPointAt(Math.min(1, t))
    pos.x += this.ps.x * 1.2 * (1 - t)
    pos.y -= this.ps.y * 0.6 * (1 - t)
    this.camera.position.copy(pos)
    this.camera.lookAt(0, 5.6 - t * 1.2, -20)
    const open = Math.min(1, Math.max(0, (p - 0.5) / 0.3))
    this.motes.uniforms.uTime.value = this.time
    this.motes.uniforms.uOpen.value = open
    this.through.intensity = 220 + open * 900
    // once through, the stone falls away into the light
    this.canvas.style.opacity = (1 - Math.min(1, Math.max(0, (p - 0.7) / 0.1))).toFixed(3)
    this.renderer.render(this.scene, this.camera)
  }
}
