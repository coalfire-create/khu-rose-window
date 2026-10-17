import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { stoneMaterial } from './stone.js'
import { magnolias } from './bongwan.js'
import { pixelRatio, MOBILE } from '../device.js'

// 경희 NOW: a night walk down a street of 경희's granite halls — classical
// fronts with giant columns, gothic blocks with towers and battlements —
// packed shoulder to shoulder. At each stop the hall's face lights up with
// a projection of what 경희 leads in today.

export const NOW = [
  {
    key: 'space', kicker: 'SPACE · 우주과학', big: '다누리', line: '한국 첫 달 탐사선, 탑재체 중 유일한 대학 개발품',
    name: '달까지 간 경희', en: 'Danuri · Chollian 2A · Artemis', kind: '우주과학',
    body: '경희대 연구팀이 7년에 걸쳐 만든 자기장 측정기가 달 탐사선 다누리에 실렸습니다. 천리안 2A의 우주기상탑재체 KSEM, NASA 민간 달 착륙선(CLPS)에 실릴 달 우주환경 모니터 LUSEM도 경희에서 나왔습니다.',
    icon: 'moon',
  },
  {
    key: 'hospitality', kicker: 'HOSPITALITY & TOURISM · 2026 상하이랭킹', big: '세계 3위', line: '국내 1위 · 1년 만에 17위에서 3위로',
    name: '호텔관광, 세계 3위', en: 'ShanghaiRanking GRAS 2026', kind: '세계 학문분야평가',
    body: '2026 상하이랭킹 세계 학문분야평가 호텔관광 부문에서 홍콩이공대, 영국 서리대에 이어 세계 3위. 국내 대학 가운데 가장 높은 순위입니다.',
    icon: 'bars',
  },
  {
    key: 'the', kicker: 'THE WORLD UNIVERSITY RANKINGS 2027', big: '237위', line: '세계 237위 · 국내 종합대학 5위 · 15계단 상승',
    name: '역대 최고 순위', en: 'Times Higher Education', kind: '세계대학평가',
    body: '2,297개 대학이 참여한 2027 THE 세계대학평가에서 세계 237위. 피인용 80.3점, 국제공동연구 비율 40.6%로 연구의 질과 국제화가 함께 올랐습니다.',
    icon: 'rise',
  },
  {
    key: 'impact', kicker: 'THE IMPACT RANKINGS 2025', big: '사립대 1위', line: '세계 19위 · 전 세계 사립대학 가운데 1위',
    name: '세상을 바꾸는 대학', en: 'UN SDGs · Social Impact', kind: '대학 영향력 평가',
    body: '유엔 지속가능발전목표(SDGs)로 대학의 사회적 책무를 재는 THE 영향력 평가에서 2025년 세계 19위, 전 세계 사립대 1위. 평화를 세계의 날로 만든 대학다운 결과입니다.',
    icon: 'dove',
  },
  {
    key: 'future', kicker: 'SIX FRONTIERS · 6대 중점분야', big: '6대 중점분야', line: '바이오헬스 · 인류문명 · 양자과학 · 첨단소재 · AI · 우주과학',
    name: '다음을 여는 여섯 분야', en: 'Bio-health · AI · Quantum', kind: '중장기 발전계획',
    body: '의학·한의학·치의학·약학·간호학을 국내 최초로 하나의 의료체계로 묶은 바이오헬스, ‘AI 융합혁신 인재 양성사업’에 선정된 AI 교육까지. 경희는 여섯 분야에 미래를 겁니다.',
    icon: 'hex',
  },
  {
    key: 'students', kicker: 'FOR STUDENTS', big: '1위 · 1위', line: '학생 창업기업 매출 국내 1위 · 교내 장학금 규모 전국 1위',
    name: '마음껏 배우고, 마음껏 꿈꾸는', en: 'Startups · Scholarships', kind: '학생 지원',
    body: '학생 창업기업 매출액 국내 1위, 교내 장학금 규모 전국 1위. 학생 10명 중 6명이 장학금을 받고, 서울 최대 규모 캠퍼스타운에서 80여 개 창업팀이 자랍니다.',
    icon: 'spark',
  },
]

const GAP = 78 // street length per stop
const STREET = 16 // half-width of the street to the façades

// The projection on a façade, drawn once.
function projection(s) {
  const W = 1400
  const H = 900
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const g = cv.getContext('2d')
  g.fillStyle = '#000'
  g.fillRect(0, 0, W, H)
  const gold = '#ffd58a'
  // frame
  g.strokeStyle = 'rgba(255, 213, 138, 0.55)'
  g.lineWidth = 3
  g.strokeRect(40, 40, W - 80, H - 80)
  g.strokeRect(56, 56, W - 112, H - 112)
  // icon
  g.save()
  g.translate(W / 2, 250)
  g.strokeStyle = gold
  g.fillStyle = gold
  g.lineWidth = 6
  if (s.icon === 'moon') {
    g.beginPath()
    g.arc(0, 0, 90, 0, Math.PI * 2)
    g.stroke()
    g.beginPath()
    g.ellipse(0, 0, 200, 50, -0.25, 0, Math.PI * 2)
    g.stroke()
    g.fillRect(150, -70, 22, 22)
    g.fillRect(124, -64, 20, 10)
    g.fillRect(178, -64, 20, 10)
  } else if (s.icon === 'bars') {
    ;[0.45, 0.7, 1].forEach((h, i) => g.fillRect(-120 + i * 90, 90 - 180 * h, 60, 180 * h))
  } else if (s.icon === 'rise') {
    g.beginPath()
    g.moveTo(-200, 80)
    g.lineTo(-80, 10)
    g.lineTo(10, 40)
    g.lineTo(200, -90)
    g.stroke()
    g.beginPath()
    g.moveTo(200, -90)
    g.lineTo(160, -90)
    g.moveTo(200, -90)
    g.lineTo(200, -50)
    g.stroke()
  } else if (s.icon === 'dove') {
    g.beginPath()
    g.moveTo(-160, 20)
    g.quadraticCurveTo(-40, -110, 30, -10)
    g.quadraticCurveTo(80, -120, 190, -60)
    g.quadraticCurveTo(80, 20, 30, 30)
    g.quadraticCurveTo(-60, 70, -160, 20)
    g.stroke()
  } else if (s.icon === 'hex') {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2
      g.beginPath()
      g.arc(Math.cos(a) * 110, Math.sin(a) * 70, 28, 0, Math.PI * 2)
      g.stroke()
    }
    g.beginPath()
    g.arc(0, 0, 36, 0, Math.PI * 2)
    g.fill()
  } else {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2
      g.beginPath()
      g.moveTo(Math.cos(a) * 40, Math.sin(a) * 40)
      g.lineTo(Math.cos(a) * (k % 2 ? 90 : 130), Math.sin(a) * (k % 2 ? 90 : 130))
      g.stroke()
    }
  }
  g.restore()
  g.textAlign = 'center'
  g.fillStyle = gold
  g.font = '500 30px "JetBrains Mono", monospace'
  g.fillText(s.kicker, W / 2, 440)
  const len = [...s.big].length
  g.font = `900 ${len > 5 ? 150 : 200}px "Noto Serif KR", serif`
  g.fillStyle = '#fff2d8'
  g.fillText(s.big, W / 2, len > 5 ? 640 : 660)
  g.font = '500 40px "Pretendard Variable", sans-serif'
  g.fillStyle = gold
  g.fillText(s.line, W / 2, 780)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

export class Boulevard {
  constructor(canvas) {
    this.canvas = canvas
    this.progress = 0
    this.time = 0
    this.stops = NOW
    this.pointer = new THREE.Vector2()
    this.ps = new THREE.Vector2()
    addEventListener('pointermove', (e) => this.pointer.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1), { passive: true })
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }))
    r.setPixelRatio(pixelRatio(1, 1.4))
    r.toneMapping = THREE.ACESFilmicToneMapping
    r.toneMappingExposure = 1.05
    const scene = (this.scene = new THREE.Scene())
    scene.fog = new THREE.Fog('#161a33', 60, 260)
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.3, 1500)
    this.u = { uTime: { value: 0 } }

    scene.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(1000, 32, 16),
        new THREE.ShaderMaterial({
          side: THREE.BackSide,
          fog: false,
          depthWrite: false,
          uniforms: this.u,
          vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
          fragmentShader: `varying vec3 vD; uniform float uTime; float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
            void main(){ float y = vD.y; vec3 c = mix(vec3(0.2, 0.17, 0.32), vec3(0.03, 0.04, 0.12), smoothstep(0.0, 0.5, y));
              float s = h(floor(vD * 300.0)); c += vec3(step(0.998, s)) * smoothstep(0.15, 0.5, y) * (0.6 + 0.4 * sin(uTime + s * 60.0));
              gl_FragColor = vec4(c, 1.0); }`,
        }),
      ),
    )
    scene.add(new THREE.HemisphereLight('#7d8cc8', '#2a2026', 0.85))

    /* --- the halls, both sides, shoulder to shoulder --- */
    const bins = { stone: [], trim: [], dark: [] }
    const lit = []
    const unlit = []
    const stained = []
    let seed = 5
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const put = (bin, geo, m) => {
      const g = (geo.index ? geo.toNonIndexed() : geo).applyMatrix4(m)
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k)
      ;(Array.isArray(bin) ? bin : bins[bin]).push(g)
    }
    // Build one hall in local space (front face at z = 0 facing +z, x across),
    // then place it with matrix M.
    const hall = (style, w, h, M, screen = false) => {
      const B = (bin, bw, bh, bd, x, y, z) => put(bin, new THREE.BoxGeometry(bw, bh, bd).translate(x, y + bh / 2, z), M)
      const d = 22
      B('stone', w, h, d, 0, 0, -d / 2)
      B('trim', w + 0.5, 1.4, d + 0.5, 0, 0, -d / 2)
      const floors = Math.floor((h - 3) / 4.4)
      const bay = style === 'gothic' ? 3.8 : 3.4
      const n = Math.floor((w - 4) / bay)
      const x0 = -((n - 1) * bay) / 2
      for (let f = 0; f < floors; f++)
        for (let i = 0; i < n; i++) {
          const x = x0 + i * bay
          const y = 2.2 + f * 4.4
          if (style === 'gothic') {
            // pointed windows; the top floor in stained glass
            const g = new THREE.PlaneGeometry(1.5, 3.0).translate(x, y + 1.5, 0.02)
            put(f === floors - 1 && !screen ? stained : !screen && rnd() < 0.5 ? lit : unlit, g, M)
            put('trim', new THREE.ConeGeometry(1.05, 1.1, 4).rotateY(Math.PI / 4).scale(1, 1, 0.25).translate(x, y + 3.5, 0.05), M)
          } else {
            put(!screen && rnd() < 0.5 ? lit : unlit, new THREE.PlaneGeometry(1.5, 2.6).translate(x, y + 1.3, 0.02), M)
            B('trim', 2.0, 0.25, 0.4, x, y - 0.2, 0.1)
            B('trim', 2.0, 0.35, 0.4, x, y + 2.75, 0.1)
          }
        }
      if (style === 'gothic') {
        // corner towers, battlements, pinnacles
        for (const sx of [-1, 1]) {
          B('stone', 5, h + 7, 5, sx * (w / 2 - 2.2), 0, 0.4)
          for (let k = 0; k < 3; k++) B('stone', 1.1, 1.1, 1.1, sx * (w / 2 - 2.2) - 1.8 + k * 1.8, h + 7, 2.5)
          put('stone', new THREE.ConeGeometry(1.4, 6, 4).rotateY(Math.PI / 4).translate(sx * (w / 2 - 2.2), h + 10.5, 0.4), M)
        }
        const m = Math.floor(w / 1.6)
        for (let i = 0; i < m; i += 2) B('stone', 0.8, 1.0, 0.8, -w / 2 + 0.8 + i * 1.6, h, -0.2)
        B('trim', w, 0.7, 0.8, 0, h - 0.7, 0.2)
      } else {
        // pilasters, a deep cornice with a balustrade
        for (let i = 0; i <= n; i++) B('trim', 0.7, h - 2, 0.5, x0 - bay / 2 + i * bay, 1.4, 0.1)
        B('trim', w + 1.2, 1.0, 2.2, 0, h, 0.2)
        B('trim', w + 0.4, 0.25, 0.5, 0, h + 1.9, 0.7)
        for (let i = 0; i < w / 0.9; i++) B('trim', 0.26, 0.85, 0.26, -w / 2 + 0.3 + i * 0.9, h + 1.05, 0.7)
        if (style === 'temple') {
          // giant columns and a pediment
          const cols = Math.max(4, Math.floor(w / 4.2))
          for (let i = 0; i < cols; i++) {
            const x = -((cols - 1) * 4.2) / 2 + i * 4.2
            put('trim', new THREE.CylinderGeometry(0.75, 0.85, h - 1.4, 14).translate(x, 1.4 + (h - 1.4) / 2, 3.2), M)
            B('trim', 2.1, 0.6, 2.1, x, h - 0.6, 3.2)
          }
          B('trim', w, 1.4, 4.4, 0, h, 2.2)
          const s = new THREE.Shape()
          s.moveTo(-w / 2, 0)
          s.lineTo(w / 2, 0)
          s.lineTo(0, w * 0.18)
          s.lineTo(-w / 2, 0)
          put('trim', new THREE.ExtrudeGeometry(s, { depth: 4, bevelEnabled: false }).translate(0, h + 1.4, 0.2), M)
        }
      }
    }
    const styles = ['temple', 'gothic', 'classic', 'gothic', 'temple', 'classic']
    const end = -(NOW.length + 0.6) * GAP
    // lay the halls out first, then pick the one facing each stop as its
    // screen: plain classical front, windows dark, so the projection reads
    this.slots = []
    for (const side of [-1, 1]) {
      let z = 30
      let k = side > 0 ? 1 : 0
      while (z > end - 60) {
        const w = 26 + rnd() * 14
        const style = styles[k++ % styles.length]
        const h = style === 'gothic' ? 22 + rnd() * 6 : 18 + rnd() * 6
        this.slots.push({ side, zc: z - w / 2, z0: z, w, h, style })
        z -= w + 0.8
      }
    }
    NOW.forEach((s, i) => {
      const z = -(i + 0.5) * GAP
      const side = i % 2 ? 1 : -1
      const slot = this.slots.filter((q) => q.side === side).reduce((a, b) => (Math.abs(b.zc - z) < Math.abs(a.zc - z) ? b : a))
      slot.screen = true
      slot.style = 'classic'
      slot.h = Math.max(slot.h, 22)
      s.slot = slot
    })
    for (const q of this.slots) {
      const M = new THREE.Matrix4().makeRotationY((q.side * -Math.PI) / 2).setPosition(q.side * STREET, 0, q.zc)
      hall(q.style, q.w, q.h, M, q.screen)
    }
    const stone = stoneMaterial('#dad3c8', { scale: 0.18 })
    const trim = stoneMaterial('#e9e3d9', { scale: 0.26, roughness: 0.82 })
    const dark = new THREE.MeshStandardMaterial({ color: '#2b2830' })
    for (const [k, mat] of [['stone', stone], ['trim', trim], ['dark', dark]]) if (bins[k].length) scene.add(new THREE.Mesh(mergeGeometries(bins[k], false), mat))
    scene.add(new THREE.Mesh(mergeGeometries(lit, false), new THREE.MeshStandardMaterial({ color: '#2a2018', emissive: '#ffc47a', emissiveIntensity: 1.15 })))
    scene.add(new THREE.Mesh(mergeGeometries(unlit, false), new THREE.MeshStandardMaterial({ color: '#141824', roughness: 0.15, metalness: 0.5 })))
    scene.add(new THREE.Mesh(mergeGeometries(stained, false), new THREE.MeshStandardMaterial({ color: '#1a1020', emissive: '#c85a7a', emissiveIntensity: 0.9 })))

    /* --- the street: wet granite setts, lamps, magnolias --- */
    const road = new THREE.Mesh(new THREE.PlaneGeometry(STREET * 2, -end + 200), new THREE.MeshStandardMaterial({ color: '#4a4448', roughness: 0.3, metalness: 0.25 }))
    road.rotation.x = -Math.PI / 2
    road.position.z = end / 2
    scene.add(road)
    const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a0').multiplyScalar(2.5) })
    const postMat = new THREE.MeshStandardMaterial({ color: '#1a171c' })
    const spots = []
    for (let z = 20; z > end - 40; z -= 26) {
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5, 6), postMat)
        post.position.set(sx * (STREET - 2.2), 2.5, z)
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), lampMat)
        l.position.set(sx * (STREET - 2.2), 5.2, z)
        scene.add(post, l)
        spots.push([sx * (STREET - 2.4), z - 13, 0.65])
      }
      const pl = new THREE.PointLight('#ffc98a', 110, 34, 2)
      pl.position.set(0, 7, z)
      scene.add(pl)
    }
    scene.add(magnolias(spots, { glow: 0.6 }))

    /* --- the projections, one per stop, on the hall it faces --- */
    this.proj = []
    NOW.forEach((s, i) => {
      const slot = s.slot
      const side = slot.side
      const pw = Math.min(slot.w * 0.78, 22)
      const ph = Math.min(slot.h * 0.85, pw * (900 / 1400))
      const mat = new THREE.ShaderMaterial({
        uniforms: { tMap: { value: projection(s) }, uOn: { value: 0 }, uTime: this.u.uTime },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `uniform sampler2D tMap; uniform float uOn; uniform float uTime; varying vec2 vUv;
          void main(){
            vec3 c = texture2D(tMap, vUv).rgb;
            // the projector sweeps on from the left, with a bright leading edge
            float edge = uOn * 1.3 - 0.15;
            float m = smoothstep(edge, edge - 0.15, vUv.x);
            float lead = exp(-pow((vUv.x - edge) * 22.0, 2.0)) * step(0.02, uOn) * step(uOn, 0.98);
            float scan = 0.92 + 0.08 * sin(vUv.y * 600.0 + uTime * 4.0);
            vec3 col = c * m * scan * 1.7 + vec3(1.0, 0.85, 0.6) * lead * 0.6;
            // a soft wash of light over the whole façade
            col += vec3(0.35, 0.22, 0.12) * uOn * 0.12;
            gl_FragColor = vec4(col, 1.0);
          }`,
      })
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), mat)
      // (the drawings over the street now tell each stop; the façade keeps
      // only a soft wash of light)
      mat.uniforms.tMap.value = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1)
      mat.uniforms.tMap.value.needsUpdate = true
      plane.rotation.y = (side * -Math.PI) / 2
      plane.position.set(side * (STREET - 0.35), slot.h * 0.52, slot.zc)
      scene.add(plane)
      s.center = new THREE.Vector3(side * STREET, slot.h * 0.52, slot.zc)
      // a soft warm uplight grazing that hall from its foot
      const up = new THREE.SpotLight('#ffd7a8', 900, 60, 0.9, 0.9, 2)
      up.position.set(side * (STREET - 1.5), 0.3, slot.zc)
      up.target.position.set(side * STREET, slot.h, slot.zc)
      scene.add(up, up.target)
      s.side = side
      this.proj.push(mat)
    })

    const composer = (this.composer = new EffectComposer(r))
    composer.addPass(new RenderPass(scene, this.camera))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.4, 0.86)
    composer.addPass(this.bloom)
    composer.addPass(new OutputPass())
    this.resize()
  }

  segment() {
    const n = NOW.length
    const f = Math.min(n - 0.0001, Math.max(0, (this.progress - 0.04) / 0.92) * n)
    return { i: Math.floor(f), t: f - Math.floor(f) }
  }

  stopIndex() {
    if (this.progress < 0.04 || this.progress > 0.985) return -1
    const { i, t } = this.segment()
    return t > 0.25 && t < 0.95 ? i : -1
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
    this.camera.fov = w / h < 0.8 ? 70 : 48
    this.camera.updateProjectionMatrix()
  }

  render(dt) {
    this.resize()
    this.time += dt
    this.u.uTime.value = this.time
    const { i, t } = this.segment()
    const sm = (x) => x * x * (3 - 2 * x)
    // per stop: walk up over the first quarter, then hold and turn to the wall
    const shotOf = (k) => {
      const s = NOW[k]
      const back = MOBILE ? 20 : 13
      return {
        pos: new THREE.Vector3(-s.side * (STREET - 6.5), 5.5, s.center.z + back),
        look: s.center.clone().add(new THREE.Vector3(0, 1.5, 0)),
      }
    }
    const a = i === 0 ? { pos: new THREE.Vector3(0, 3.5, 60), look: new THREE.Vector3(0, 8, -60) } : shotOf(i - 1)
    const b = shotOf(i)
    const k = sm(Math.min(1, t / 0.28))
    const pos = a.pos.clone().lerp(b.pos, k)
    const look = a.look.clone().lerp(b.look, k)
    // a slow drift while holding
    pos.z -= sm(Math.max(0, (t - 0.28) / 0.72)) * 4
    this.ps.lerp(this.pointer, Math.min(1, dt * 2))
    pos.x += this.ps.x * 1.2
    pos.y -= this.ps.y * 0.6
    this.camera.position.copy(pos)
    this.camera.lookAt(look)
    // projections come on as each stop is reached, and stay on
    this.proj.forEach((m, j) => {
      const want = j < i ? 1 : j === i ? sm(Math.min(1, Math.max(0, (t - 0.2) / 0.35))) : 0
      m.uniforms.uOn.value += (want - m.uniforms.uOn.value) * Math.min(1, dt * 4)
    })
    this.composer.render(dt)
  }
}
