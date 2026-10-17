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

}
