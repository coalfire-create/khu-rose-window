import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { stoneMaterial } from './stone.js'
import { hallKit } from './halls.js'
import { magnolias } from './bongwan.js'

// The setting of 평화의전당, shared by every chapter that stands before it:
// granite halls either side and behind, 천장산's woods with the city's lights
// below, and the plaza — granite paving in rings, flower beds, lamps,
// magnolias. The palace's front is at z ≈ 6.5, the plaza at y = -3.
export function buildPlaza(scene, u) {
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

  /* behind: 천장산's ridges fading into the night, layer on layer */
  let seed = 11
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const ridge = (z, base, amp, color, rough, glow) => {
    const pts = []
    const n = 90
    const ph = rnd() * 10
    for (let i = 0; i <= n; i++) {
      const x = -1100 + (2200 * i) / n
      const t = i / n
      // a broad hump behind the palace, smaller hills either side
      const hump = Math.exp(-((x / 520) ** 2)) * amp
      const y = base + hump + Math.sin(t * 9 + ph) * rough + Math.sin(t * 23 + ph * 2) * rough * 0.4 + Math.sin(t * 61) * rough * 0.15
      pts.push(new THREE.Vector2(x, y))
    }
    pts.push(new THREE.Vector2(1100, -40), new THREE.Vector2(-1100, -40))
    const m = new THREE.Mesh(
      new THREE.ShapeGeometry(new THREE.Shape(pts)),
      new THREE.ShaderMaterial({
        fog: false,
        depthWrite: true,
        uniforms: { uC: { value: new THREE.Color(color) }, uG: { value: glow } },
        vertexShader: `varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        // a faint warm glow along the foot from the city below
        fragmentShader: `uniform vec3 uC; uniform float uG; varying float vY; void main(){ vec3 c = uC + vec3(0.32, 0.18, 0.1) * uG * smoothstep(60.0, -30.0, vY); gl_FragColor = vec4(c, 1.0); }`,
      }),
    )
    m.position.z = z
    scene.add(m)
  }
  ridge(-900, 40, 120, '#3a3a5c', 18, 0.15)
  ridge(-640, 18, 105, '#2a2c46', 22, 0.25)
  ridge(-420, -4, 92, '#1a2230', 16, 0.35)
  // woods on the near ridge, lit faintly from below
  const woods = []
  for (let i = 0; i < 340; i++) {
    const x = (rnd() - 0.5) * 1200
    const top = -4 + Math.exp(-((x / 520) ** 2)) * 92
    const y = -10 + rnd() * (top + 6)
    const r = 6 + rnd() * 8
    woods.push(new THREE.IcosahedronGeometry(r, 1).toNonIndexed().scale(1, 1.15, 0.6).translate(x, y, -405 + rnd() * 10))
  }
  scene.add(new THREE.Mesh(mergeGeometries(woods, false), new THREE.MeshStandardMaterial({ color: '#203428', roughness: 1, flatShading: true, emissive: '#0c1410' })))

  /* the city either side: towers of lit windows going back into the haze */
  {
    const W = 64
    const cv = document.createElement('canvas')
    cv.width = cv.height = W * 4
    const g = cv.getContext('2d')
    g.fillStyle = '#05060a'
    g.fillRect(0, 0, W * 4, W * 4)
    for (let yy = 0; yy < 32; yy++)
      for (let xx = 0; xx < 16; xx++) {
        const r = rnd()
        g.fillStyle = r < 0.42 ? (r < 0.08 ? '#cfe0ff' : '#ffcf8a') : '#11131c'
        g.fillRect(xx * 16 + 4, yy * 8 + 2, 8, 4)
      }
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    const towers = []
    for (let i = 0; i < 240; i++) {
      const side = rnd() < 0.5 ? -1 : 1
      const x = side * (190 + rnd() * 700)
      const z = -120 - rnd() * 520
      const w = 14 + rnd() * 26
      const h = 18 + rnd() * (Math.abs(x) > 400 ? 90 : 50)
      const geo = new THREE.BoxGeometry(w, h, w).toNonIndexed()
      // tile the window texture by size
      const uv = geo.attributes.uv
      for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (w / 16), uv.getY(k) * (h / 16))
      towers.push(geo.translate(x, -3 + h / 2, z))
    }
    const mat = new THREE.MeshStandardMaterial({ color: '#0d0f16', emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.9, roughness: 0.8 })
    scene.add(new THREE.Mesh(mergeGeometries(towers, false), mat))
  }

  /* the moon, and a few thin clouds catching its light */
  {
    const moon = new THREE.Mesh(new THREE.CircleGeometry(16, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color('#f4ecd8').multiplyScalar(1.6), fog: false }))
    moon.position.set(-360, 300, -980)
    moon.lookAt(0, 0, 0)
    scene.add(moon)
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(260, 260),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        fog: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; float a = exp(-d * 4.0) * 0.5; gl_FragColor = vec4(vec3(0.7, 0.72, 0.9) * a, a); }`,
      }),
    )
    halo.position.copy(moon.position).add(new THREE.Vector3(0, 0, 1))
    halo.lookAt(0, 0, 0)
    scene.add(halo)
    for (let i = 0; i < 9; i++) {
      const c = new THREE.Mesh(
        new THREE.PlaneGeometry(260 + rnd() * 200, 40 + rnd() * 30),
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          fog: false,
          uniforms: { uSeed: { value: rnd() * 10 } },
          vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
          fragmentShader: `uniform float uSeed; varying vec2 vUv; float n(vec2 p){ return fract(sin(dot(p, vec2(12.9, 78.2))) * 43758.5); }
            float sn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(n(i), n(i+vec2(1,0)), f.x), mix(n(i+vec2(0,1)), n(i+vec2(1,1)), f.x), f.y); }
            void main(){ vec2 p = vUv * vec2(6.0, 1.5) + uSeed; float v = sn(p) * 0.6 + sn(p * 2.3) * 0.4;
              float edge = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.55, vUv.y) * smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
              float a = smoothstep(0.45, 0.8, v) * edge * 0.45; gl_FragColor = vec4(vec3(0.42, 0.42, 0.6) * 1.2, a); }`,
        }),
      )
      c.position.set((rnd() - 0.5) * 1400, 200 + rnd() * 220, -700 - rnd() * 250)
      c.lookAt(0, c.position.y, 0)
      scene.add(c)
    }
  }

  /* the plaza: granite paving in rings, flower beds, lamps, magnolias */
  const paving = new THREE.Mesh(
    new THREE.CircleGeometry(150, 96),
    new THREE.ShaderMaterial({
      uniforms: { uTime: u.uTime },
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
          c *= (smoothstep(150.0, 110.0, r) * 0.8 + 0.2) * 0.6;
          // a wet sheen, catching the floodlit front
          c += vec3(0.28, 0.2, 0.12) * pow(max(0.0, 1.0 - abs(vW.x) / 30.0), 3.0) * smoothstep(90.0, 10.0, vW.z) * 0.35;
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

}

// Floodlights for 평화의전당 at night: high lamps for the towers, low ones
// for the portals, the base and the stair, so no part of the front falls
// into the dark.
export function palaceLights(scene) {
  scene.add(new THREE.HemisphereLight('#6170b0', '#2a2024', 0.5))
  const spot = (x, y, z, tx, ty, tz, i, angle = 0.5, color = '#ffe2bf') => {
    const s = new THREE.SpotLight(color, i, 200, angle, 0.75, 2)
    s.position.set(x, y, z)
    s.target.position.set(tx, ty, tz)
    scene.add(s, s.target)
  }
  spot(-26, 0.5, 34, -12, 30, 0, 2800)
  spot(26, 0.5, 34, 12, 30, 0, 2800)
  spot(0, 0.5, 40, 0, 26, 0, 1500)
  // the base, the portals and the stair
  spot(-16, -2.5, 46, -10, 7, 4, 520, 0.42, '#ffd9b0')
  spot(16, -2.5, 46, 10, 7, 4, 520, 0.42, '#ffd9b0')
  spot(0, -2.5, 52, 0, 6, 5, 380, 0.3, '#ffe6c4')
  const fill = new THREE.PointLight('#ffcf9a', 60, 40, 1.8)
  fill.position.set(0, 3, 26)
  scene.add(fill)
  // the halls round the plaza, washed from their feet
  for (const [x, z, tx] of [[-60, 30, -74], [60, 30, 76], [-100, 70, -112], [100, 70, 114]]) spot(x, -2.5, z, tx, 14, z - 26, 1400, 0.6, '#ffd9b0')
}
