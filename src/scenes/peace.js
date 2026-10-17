import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { palaceModel } from './palace.js'
import { stoneMaterial } from './stone.js'
import { hallKit } from './halls.js'
import { magnolias } from './bongwan.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { pixelRatio, tier, MOBILE } from '../device.js'

// 1981, the International Day of Peace: before 평화의전당 at night a flock
// of doves of light lifts off the plaza, wheels round the twin towers and,
// as you scroll, gathers in the sky into the word 平和. Pointer: the flock
// leans away from it.

const WORD = '平和'

// Points inside the word, rasterised, on a plane in the sky (x, y).
function wordPoints(n) {
  const cv = document.createElement('canvas')
  cv.width = 480
  cv.height = 240
  const g = cv.getContext('2d', { willReadFrequently: true })
  g.fillStyle = '#fff'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = '900 210px "Noto Serif KR", serif'
  g.fillText(WORD, 240, 128)
  const d = g.getImageData(0, 0, 480, 240).data
  const inside = []
  for (let y = 0; y < 240; y += 2) for (let x = 0; x < 480; x += 2) if (d[(y * 480 + x) * 4] > 128) inside.push([x, y])
  const out = []
  for (let i = 0; i < n; i++) {
    const [x, y] = inside[Math.floor(Math.random() * inside.length)] || [240, 120]
    out.push(new THREE.Vector3((x - 240) * 0.28, (120 - y) * 0.28, 0))
  }
  return out
}

export class Peace {
  constructor(canvas) {
    this.canvas = canvas
    this.progress = 0
    this.time = 0
    this.pointer = new THREE.Vector2()
    this.ps = new THREE.Vector2()
    addEventListener('pointermove', (e) => this.pointer.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1), { passive: true })

    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }))
    r.setPixelRatio(pixelRatio(1, 1.4))
    r.toneMapping = THREE.ACESFilmicToneMapping
    const scene = (this.scene = new THREE.Scene())
    scene.fog = new THREE.Fog('#0d1330', 160, 700)
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.5, 3000)
    this.u = { uTime: { value: 0 }, uGlow: { value: 1.1 } }

    scene.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(1500, 32, 16),
        new THREE.ShaderMaterial({
          side: THREE.BackSide,
          fog: false,
          depthWrite: false,
          uniforms: this.u,
          vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
          fragmentShader: /* glsl */ `varying vec3 vD; uniform float uTime;
            float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
            void main(){ float y = vD.y;
              vec3 c = mix(vec3(0.2, 0.16, 0.32), vec3(0.03, 0.05, 0.14), smoothstep(0.0, 0.5, y));
              vec3 cell = floor(vD * 320.0); float s = h(cell);
              c += vec3(step(0.9978, s)) * (0.5 + 0.5 * sin(uTime * 1.6 + s * 80.0)) * smoothstep(0.1, 0.5, y);
              gl_FragColor = vec4(c, 1.0); }`,
        }),
      ),
    )
    scene.add(new THREE.HemisphereLight('#5566a8', '#141018', 0.4))
    for (const [x, z, t, i] of [[-26, 30, -12, 2600], [26, 30, 12, 2600], [0, 36, 0, 1600]]) {
      const s = new THREE.SpotLight('#ffe2bf', i, 170, 0.5, 0.7, 2)
      s.position.set(x, 0.5, z)
      s.target.position.set(t, 30, 0)
      scene.add(s, s.target)
    }
    scene.add(palaceModel(this.u))

    /* the campus around it: granite halls either side, more behind */
    const kit = hallKit()
    const place = (style, w, d, h, x, z, ry, opts) => {
      const m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, -3, z)
      kit.hall(style, w, d, h, m, Math.abs(Math.sin(x * 12.9 + z)), opts)
    }
    place('granite', 52, 20, 22, -74, 6, 0.32, { tower: true })
    place('library', 46, 22, 21, 76, 4, -0.32)
    place('modern', 44, 18, 26, -138, -46, 0.5)
    place('granite', 40, 18, 18, 136, -40, -0.5)
    place('classic', 30, 16, 14, -112, 52, 0.9)
    place('granite', 34, 16, 17, 114, 54, -0.9)
    place('modern', 50, 20, 30, -60, -110, 0.15)
    place('granite', 46, 20, 24, 64, -112, -0.15, { tower: true })
    scene.add(kit.meshes({ night: 0.6 }))

    /* the hill behind (천장산), wooded, and the city's lights below it */
    const hill = new THREE.Mesh(
      new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#141e1a', roughness: 1 }),
    )
    hill.scale.set(520, 120, 260)
    hill.position.set(0, -20, -420)
    scene.add(hill)
    const woods = []
    for (let i = 0; i < 260; i++) {
      const a = Math.random() * Math.PI
      const x = Math.cos(a) * 480 * Math.random()
      const z = -420 + Math.sin(a) * 240 * Math.random() * 0.9
      const yy = 120 * Math.sqrt(Math.max(0, 1 - (x / 520) ** 2 - ((z + 420) / 260) ** 2)) - 20
      const r = 9 + Math.random() * 10
      woods.push(new THREE.IcosahedronGeometry(r, 1).toNonIndexed().translate(x, yy + r * 0.6, z))
    }
    scene.add(new THREE.Mesh(mergeGeometries(woods, false), new THREE.MeshStandardMaterial({ color: '#1b2a22', roughness: 1, flatShading: true })))
    {
      const n = 1600
      const pos = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) {
        const side = Math.random() < 0.5 ? -1 : 1
        pos.set([side * (180 + Math.random() * 520), -6 + Math.random() * 30, -80 - Math.random() * 400], i * 3)
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffcf8a', size: 2.2, sizeAttenuation: true, transparent: true, opacity: 0.85 })))
    }

    /* the plaza: granite paving in rings, flower beds, lamps, magnolias */
    const paving = new THREE.Mesh(
      new THREE.CircleGeometry(150, 96),
      new THREE.ShaderMaterial({
        uniforms: { uTime: this.u.uTime },
        vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: /* glsl */ `varying vec3 vW;
          void main(){
            vec2 p = vW.xz - vec2(0.0, 70.0);
            float r = length(p);
            float a = atan(p.y, p.x);
            float ring = abs(fract(r / 6.0) - 0.5);
            float ray = abs(fract(a * 24.0 / 6.2832) - 0.5);
            float joint = smoothstep(0.0, 0.03, ring) * smoothstep(0.0, 0.04, ray * r / 40.0);
            vec3 c = mix(vec3(0.16, 0.15, 0.16), vec3(0.24, 0.22, 0.22), step(0.5, fract(r / 12.0)));
            c *= 0.75 + 0.25 * joint;
            // warm pools from the floodlights and lamps, a soft sheen toward the hall
            c += vec3(0.32, 0.22, 0.12) * exp(-pow(r - 0.0, 2.0) / 3000.0) * 0.6;
            c += vec3(0.22, 0.15, 0.08) * smoothstep(80.0, 0.0, abs(vW.z - 10.0)) * 0.25;
            c *= smoothstep(150.0, 110.0, r) * 0.8 + 0.2;
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    )
    paving.rotation.x = -Math.PI / 2
    paving.position.y = -2.98
    scene.add(paving)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshStandardMaterial({ color: '#17181c', roughness: 0.95 }))
    ground.rotation.x = -Math.PI / 2
    ground.position.set(0, -3.05, 0)
    scene.add(ground)
    const beds = []
    const shrubs = []
    for (const sx of [-1, 1])
      for (let i = 0; i < 4; i++) {
        const x = sx * (28 + i * 16)
        const z = 40 + (i % 2) * 18
        beds.push(new THREE.BoxGeometry(12, 0.8, 6).toNonIndexed().translate(x, -2.6, z))
        for (let k = 0; k < 5; k++) shrubs.push(new THREE.IcosahedronGeometry(1.4, 1).toNonIndexed().scale(1, 0.7, 1).translate(x - 4.5 + k * 2.2, -1.5, z))
      }
    scene.add(new THREE.Mesh(mergeGeometries(beds, false), stoneMaterial('#cfc8bd', { scale: 0.3 })))
    scene.add(new THREE.Mesh(mergeGeometries(shrubs, false), new THREE.MeshStandardMaterial({ color: '#21402c', roughness: 1, flatShading: true })))
    const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a0').multiplyScalar(2.4) })
    const postMat = new THREE.MeshStandardMaterial({ color: '#1c1a20' })
    for (let i = 0; i < 7; i++)
      for (const sx of [-1, 1]) {
        const x = sx * 22
        const z = 24 + i * 14
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 6, 6), postMat)
        post.position.set(x, 0, z)
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), lampMat)
        head.position.set(x, 3.2, z)
        scene.add(post, head)
      }
    const spots = []
    for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) spots.push([sx * (34 + (i % 2) * 8), 30 + i * 13, 1])
    const mg = magnolias(spots, { glow: 0.5 })
    mg.position.y = -3
    scene.add(mg)

    /* the flock: instanced doves, wings flapping in the vertex shader */
    const N = (this.N = tier(1250, 620))
    const bird = new THREE.BufferGeometry()
    // body + two wings (wing vertices carry aWing = ±1 to flap)
    const v = [
      // left wing
      0, 0, 0.35, -1.6, 0.1, -0.1, 0, 0, -0.45,
      // right wing
      0, 0, 0.35, 0, 0, -0.45, 1.6, 0.1, -0.1,
      // tail
      0, 0, -0.3, -0.35, 0, -1.0, 0.35, 0, -1.0,
    ]
    const wing = [0, -1, 0, 0, 0, 1, 0, 0, 0]
    bird.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
    bird.setAttribute('aWing', new THREE.Float32BufferAttribute(wing, 1))
    bird.computeVertexNormals()
    const phase = new Float32Array(N)
    for (let i = 0; i < N; i++) phase[i] = Math.random() * 6.28
    bird.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1))
    this.birdMat = new THREE.ShaderMaterial({
      uniforms: { uTime: this.u.uTime, uFlap: { value: 1 } },
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        attribute float aWing; attribute float aPhase; uniform float uTime; uniform float uFlap; varying float vL;
        void main(){
          vec3 p = position;
          float f = sin(uTime * 11.0 + aPhase) * uFlap;
          p.y += abs(p.x) * f * 0.9;
          vec4 w = instanceMatrix * vec4(p, 1.0);
          vL = 0.75 + 0.25 * f;
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * w;
        }`,
      fragmentShader: `varying float vL; void main(){ gl_FragColor = vec4(vec3(1.0, 0.9, 0.74) * (0.95 * vL), 1.0); }`,
    })
    this.flock = new THREE.InstancedMesh(bird, this.birdMat, N)
    this.flock.frustumCulled = false
    scene.add(this.flock)
    // start (perched on the plaza and the towers), wander, and word slots
    this.birds = []
    this.word = null
    const ledges = [[-12, 51], [12, 51], [0, 41], [-12, 35.5], [12, 35.5]]
    for (let i = 0; i < N; i++) {
      const perch = Math.random() < 0.4 ? ledges[i % ledges.length] : null
      const start = perch
        ? new THREE.Vector3(perch[0] + (Math.random() - 0.5) * 12, perch[1] + 0.6, 4 + Math.random() * 3)
        : new THREE.Vector3((Math.random() - 0.5) * 70, -2.4, 20 + Math.random() * 60)
      this.birds.push({ start, a: Math.random() * 6.28, r: 26 + Math.random() * 46, h: 30 + Math.random() * 50, sp: 0.25 + Math.random() * 0.35, k: Math.random(), pos: start.clone(), dir: new THREE.Vector3(0, 0, 1) })
    }
    this.dummy = new THREE.Object3D()

    const composer = (this.composer = new EffectComposer(r))
    composer.addPass(new RenderPass(scene, this.camera))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.35, 0.85)
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
    this.camera.fov = w / h < 0.8 ? 66 : 46
    this.camera.updateProjectionMatrix()
  }

  render(dt) {
    this.resize()
    this.time += dt
    this.u.uTime.value = this.time
    // the word's points, once the serif font has loaded
    if (!this.word && document.fonts.check('900 40px "Noto Serif KR"', WORD)) this.word = wordPoints(this.N)
    const p = this.progress
    const sm = (a, b) => {
      const x = Math.min(1, Math.max(0, (p - a) / (b - a)))
      return x * x * (3 - 2 * x)
    }
    const lift = sm(0.08, 0.35) // off the ground
    const form = sm(0.5, 0.82) // into the word
    this.ps.lerp(this.pointer, Math.min(1, dt * 2))
    const sky = new THREE.Vector3(0, MOBILE ? 86 : 80, 10)
    const scale = MOBILE ? 0.55 : 1
    const t = this.time
    const tmp = new THREE.Vector3()
    this.birds.forEach((b, i) => {
      // circling the towers
      const ang = b.a + t * b.sp
      tmp.set(Math.cos(ang) * b.r, b.h + Math.sin(t * 0.7 + b.k * 9) * 4, Math.sin(ang) * b.r * 0.6 + 6)
      const wander = b.start.clone().lerp(tmp, Math.min(1, lift * (1.2 + b.k * 0.6)))
      let target = wander
      if (this.word && form > 0) {
        const w = this.word[i].clone().multiplyScalar(scale).add(sky)
        w.y += Math.sin(t * 1.3 + b.k * 20) * 0.35
        target = wander.lerp(w, Math.min(1, form * (1 + b.k * 0.5)))
      }
      // lean away from the pointer
      target.x += this.ps.x * -6 * (1 - form)
      const prev = b.pos.clone()
      b.pos.lerp(target, Math.min(1, dt * 3.2))
      const d = b.pos.clone().sub(prev)
      if (d.lengthSq() > 1e-6) b.dir.lerp(d.normalize(), Math.min(1, dt * 6))
      this.dummy.position.copy(b.pos)
      this.dummy.lookAt(b.pos.clone().add(b.dir.lengthSq() > 1e-4 ? b.dir : new THREE.Vector3(0, 0, 1)))
      const s = (0.7 + b.k * 0.35) * (1 - form * 0.35)
      this.dummy.scale.setScalar(s)
      this.dummy.updateMatrix()
      this.flock.setMatrixAt(i, this.dummy.matrix)
    })
    this.flock.instanceMatrix.needsUpdate = true
    // the formed word holds still: wings gently glide
    this.birdMat.uniforms.uFlap.value = 1 - form * 0.75
    // camera: down on the plaza, tilting up after the flock
    const cam = this.camera
    cam.position.set(this.ps.x * 4 - 6 + lift * 6, 4 + lift * 6 - this.ps.y * 2, 150 - lift * 30 - form * 10)
    cam.lookAt(0, 28 + lift * 24 + form * 8, 0)
    this.composer.render(dt)
  }
}
