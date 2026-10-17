import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { palaceModel } from './palace.js'
import { buildPlaza, palaceLights } from './plaza.js'
import { pixelRatio } from '../device.js'

// The finale: back where the site began, at 평화의전당 — now from outside,
// at night, among the halls on its plaza. Scroll walks across the plaza and
// up the stair; the great doors of the central portal swing open on light;
// the camera goes through them, and the page gives way to that light (the
// prism burst underneath this canvas).

const TW = 13
const CZ = TW / 2 - 1.6 // the centre bay's face
const DOOR = { w: 4.4, h: 8.0, y: 0.6, z: CZ + 1.15 }

export class Gate {
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
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.2, 3000)
    this.u = { uTime: { value: 0 }, uGlow: { value: 1.2 } }

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
              vec3 c = mix(vec3(0.22, 0.15, 0.3), vec3(0.03, 0.04, 0.12), smoothstep(0.0, 0.5, y));
              float s = h(floor(vD * 320.0));
              c += vec3(step(0.9978, s)) * (0.5 + 0.5 * sin(uTime * 1.6 + s * 80.0)) * smoothstep(0.1, 0.5, y);
              gl_FragColor = vec4(c, 1.0); }`,
        }),
      ),
    )
    palaceLights(scene)
    scene.add(palaceModel(this.u))
    buildPlaza(scene, this.u)

    /* the doors: two oak leaves on hinges, and the light behind them */
    const wood = new THREE.MeshStandardMaterial({ color: '#4a2c1c', roughness: 0.7 })
    const iron = new THREE.MeshStandardMaterial({ color: '#1c1a1e', roughness: 0.5, metalness: 0.6 })
    this.leaves = []
    for (const sx of [-1, 1]) {
      const hinge = new THREE.Group()
      hinge.position.set(sx * (DOOR.w / 2), DOOR.y, DOOR.z)
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(DOOR.w / 2, DOOR.h, 0.22), wood)
      leaf.position.set(-sx * (DOOR.w / 4), DOOR.h / 2, 0)
      hinge.add(leaf)
      for (const yy of [1.4, 4, 6.6]) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(DOOR.w / 2 - 0.2, 0.14, 0.26), iron)
        band.position.set(-sx * (DOOR.w / 4), yy, 0.02)
        hinge.add(band)
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.04, 6, 16), iron)
      ring.position.set(-sx * 0.35, 3.6, 0.16)
      hinge.add(ring)
      scene.add(hinge)
      this.leaves.push({ hinge, sx })
    }
    // the light within: a bright plane in the doorway, and a beam out across the stair
    this.inside = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.w, DOOR.h + 0.6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff1d6') }))
    this.inside.position.set(0, DOOR.y + DOOR.h / 2, CZ + 0.95)
    scene.add(this.inside)
    this.beam = new THREE.SpotLight('#ffd9a0', 0, 120, 0.42, 0.6, 1.6)
    this.beam.position.set(0, 5, CZ + 0.5)
    this.beam.target.position.set(0, -3, 60)
    scene.add(this.beam, this.beam.target)
    // a wash of light that spills out over the stair as the doors part
    this.spill = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 40),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uOpen: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform float uOpen; varying vec2 vUv; void main(){ float w = 1.0 - abs(vUv.x - 0.5) * 2.0; float a = pow(w, 2.0) * pow(vUv.y, 1.6) * uOpen * 0.55; gl_FragColor = vec4(vec3(1.0, 0.82, 0.55) * a, a); }`,
      }),
    )
    this.spill.rotation.x = -Math.PI / 2
    this.spill.position.set(0, -1.2, CZ + 20)
    scene.add(this.spill)

    // across the plaza, up the stair, through the door
    this.path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-18, 3, 150),
      new THREE.Vector3(-6, 2.5, 95),
      new THREE.Vector3(0, 2.2, 50),
      new THREE.Vector3(0, 3.0, 24),
      new THREE.Vector3(0, 4.2, 10),
      new THREE.Vector3(0, 4.6, CZ - 4),
    ])

    const composer = (this.composer = new EffectComposer(r))
    composer.addPass(new RenderPass(scene, this.camera))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 0.8)
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
    this.camera.fov = w / h < 0.8 ? 64 : 46
    this.camera.updateProjectionMatrix()
  }

  render(dt) {
    this.resize()
    this.time += dt
    this.u.uTime.value = this.time
    const p = this.progress
    const sm = (a, b) => {
      const x = Math.min(1, Math.max(0, (p - a) / (b - a)))
      return x * x * (3 - 2 * x)
    }
    // the walk takes the story's length; the doors open; then through
    const walk = p < 0.56 ? (p / 0.56) * 0.7 : 0.7 + sm(0.56, 0.84) * 0.3
    const open = sm(0.46, 0.66)
    this.ps.lerp(this.pointer, Math.min(1, dt * 2))
    const pos = this.path.getPointAt(Math.min(1, walk))
    pos.x += this.ps.x * 2 * (1 - walk)
    pos.y -= this.ps.y * 0.8 * (1 - walk)
    this.camera.position.copy(pos)
    // looking up at the towers at first, down to the door as we near it
    const lookY = 26 - walk * 21
    this.camera.lookAt(0, lookY, CZ - 10)
    for (const { hinge, sx } of this.leaves) hinge.rotation.y = sx * open * 1.75
    this.inside.material.color.setRGB(1, 0.94, 0.84).multiplyScalar(1.2 + open * 6)
    this.beam.intensity = open * 3500
    this.spill.material.uniforms.uOpen.value = open
    this.u.uGlow.value = 1.2 + open * 0.8
    this.renderer.toneMappingExposure = 1 + sm(0.66, 0.84) * 1.8
    // once through, the stone falls away into the light
    this.canvas.style.opacity = (1 - sm(0.76, 0.86)).toFixed(3)
    this.composer.render(dt)
  }
}
