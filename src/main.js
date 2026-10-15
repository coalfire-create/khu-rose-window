import './style.css'
import gsap from 'gsap'
import Lenis from 'lenis'
import { MOBILE } from './device.js'

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const ease = (t) => t * t * (3 - 2 * t)
const range = (p, a, b) => clamp01((p - a) / (b - a))

const YEARS = [
  [1949, '신흥초급대학으로 출발'],
  [1951, '조영식, 학교를 인수 · 『문화세계의 창조』'],
  [1955, '종합대학 ‘경희대학교’로'],
  [1956, '서울캠퍼스 본관 완공'],
  [1965, '세계대학총장회(IAUP) 창설 주도'],
  [1981, '유엔 ‘세계평화의 날’ 제정'],
  [1999, '개교 50주년, 평화의전당 개관'],
  [2026, '그리고 지금, 당신의 차례'],
]

function splitChars(el) {
  el.setAttribute('aria-label', el.textContent)
  const words = el.textContent.split(' ')
  el.textContent = ''
  words.forEach((w, n) => {
    const word = document.createElement('span')
    word.className = 'word'
    word.setAttribute('aria-hidden', 'true')
    for (const ch of w) {
      const c = document.createElement('span')
      c.className = 'char'
      c.textContent = ch
      word.appendChild(c)
    }
    el.appendChild(word)
    if (n < words.length - 1) el.appendChild(document.createTextNode(' '))
  })
}

// Headlines rise line by line behind a mask.
function splitLines(el) {
  const parts = el.innerHTML.split(/<br\s*\/?>/i)
  el.innerHTML = parts.map((p) => `<span class="line"><span class="line__in">${p.trim()}</span></span>`).join('')
}

async function boot() {
  const num = document.getElementById('loaderNum')
  const bar = document.getElementById('loaderBar')
  const fill = document.getElementById('loaderFill')
  const c = { v: 0, target: 6 }
  const setLoad = (v) => (c.target = Math.max(c.target, v))
  const paint = () => {
    c.v += (c.target - c.v) * 0.07
    num.textContent = Math.round(c.v)
    bar.style.transform = `scaleX(${c.v / 100})`
    fill.style.clipPath = `inset(${100 - c.v}% 0 0 0)`
  }
  gsap.ticker.add(paint)
  const creep = setInterval(() => setLoad(Math.min(c.target + 1.2, 92)), 380)

  const mods = Promise.all([
    import('./scenes/nave.js'),
    import('./scenes/palace.js'),
    import('./scenes/campus.js'),
    import('./scenes/gate.js'),
    import('./scenes/petals.js'),
    import('./ok/shadow-play.js'),
    import('./ok/lantern-lotus.js'),
    import('./ok/atlas-sash.js'),
    import('./ok/glyph-wall.js'),
    import('./ok/prism-burst.js'),
  ])
  await Promise.race([
    Promise.all([
      document.fonts.load('900 100px "Noto Serif KR"', '慶熙文化世界創造'),
      document.fonts.load('700 60px "Noto Serif KR"', '문화세계의 창조'),
      document.fonts.load('italic 500 40px "Cormorant Garamond"', 'Creation'),
      document.fonts.load('500 12px "JetBrains Mono"', 'KHU'),
    ]),
    new Promise((r) => setTimeout(r, 2500)),
  ])
  setLoad(24)

  let viewH = innerHeight
  let viewW = innerWidth
  addEventListener('resize', () => innerWidth !== viewW && ((viewW = innerWidth), (viewH = innerHeight)))
  const touch = matchMedia('(hover: none)').matches

  const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 })
  gsap.ticker.add((t) => lenis.raf(t * 1000))
  gsap.ticker.lagSmoothing(0)
  lenis.stop()
  scrollTo(0, 0)
  document.querySelectorAll('a[href^="#"]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault()
      lenis.start()
      lenis.scrollTo(a.getAttribute('href'), { duration: 2.2, force: true })
    }),
  )

  document.querySelectorAll('.split').forEach(splitChars)
  document.querySelectorAll('.scene .h2, .gate__title').forEach(splitLines)

  const [{ Nave }, { Palace }, { Campus }, { Gate }, { Petals }, { mountShadowPlay }, { mountLantern }, { mountAtlasSash }, { mountGlyphWall }, { mountPrismBurst }] = await mods
  setLoad(40)
  await new Promise((r) => requestAnimationFrame(r))

  /* ---------- build every chapter behind the loader ---------- */
  const nave = new Nave(document.getElementById('cvNave'))
  setLoad(50)

  // 01 교시: light pours through the motto, like sun through glass.
  const shadow = mountShadowPlay(document.getElementById('shadowHost'), {
    text: MOBILE ? '文化世界의\n創造' : '文化世界의 創造',
    font: { fontFamily: '"Noto Serif KR", serif', fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.02em' },
    textColor: '#a40f16',
    backgroundColor: '#f1e8d8',
    shadowColor: '#3a1418',
    fitPadding: MOBILE ? 8 : 6,
    lightSize: 22,
    lightFalloff: 45,
    shadowStrength: 100,
    rainbow: 330,
    dither: 2,
    samples: MOBILE ? 40 : 64,
    quality: MOBILE ? 70 : 100,
    // No pointer: the sun crosses the sky above the words by itself.
    auto: (t) => [0.5 + 0.4 * Math.sin(t * 0.35), 1.05 + 0.08 * Math.sin(t * 0.6)],
  })

  const palace = new Palace(document.getElementById('cvPalace'))
  setLoad(60)

  // 03 목련: a white magnolia, lit from within, opens with scroll.
  const lotus = mountLantern(document.getElementById('lotusHost'), {
    petals: 9,
    layers: 3,
    flowerSize: MOBILE ? 150 : 185,
    colors: { petal: '#FFEFF1', light: '#FFE2BC', sheen: '#C9B8FF' },
    glow: 5.5,
    spin: 0.6,
    float: 4,
    open: 0,
    offsetX: MOBILE ? 0 : 0.55,
    advanced: { cup: 150, tipCurl: 60, elevation: 22, absorption: 70, iridescence: 70, bloom: 120, motes: 40, breath: 2 },
  })
  const petals = new Petals(document.getElementById('cvPetals'))

  const campus = new Campus(document.getElementById('cvCampus'))
  setLoad(70)

  // 05 세계평화의 날: the Earth, wrapped in the school song's refrain.
  const atlas = mountAtlasSash(document.getElementById('atlasHost'), {
    text: '인류 위해 일하고 평화 위해 싸우세 · INTERNATIONAL DAY OF PEACE · 1981 · 문화세계의 창조 · THE CREATION OF A CULTURAL WORLD · 학문과 평화 · KYUNG HEE ·',
    font: { fontFamily: '"Noto Serif KR", serif', fontWeight: 700, fontSize: 30, lineHeight: '1.35em', letterSpacing: '0.04em' },
    textColor: '#E8CF8E',
    stars: 6,
    size: MOBILE ? 260 : 470,
    ring: { lines: 3, radius: 118, tilt: 40, damping: 5, drift: 2 },
    look: { clouds: 4, lights: 6, atmosphere: '#5C8DFF' },
    sun: { source: 'cursor', angle: 150, daylight: 60 },
    speed: 4,
  })

  // 06 연표: hanja carved in stone, lit year by year.
  const wall = mountGlyphWall(document.getElementById('wallHost'), {
    background: '#231a1f',
    glyphColor: '#b9a99a',
    accent: '#E8B860',
    size: MOBILE ? 52 : 70,
    reach: 170,
    sweep: 0,
  })

  // 07 정문: light through the gate.
  const burst = mountPrismBurst(document.getElementById('burstHost'), {
    background: '#07040a',
    baseColor: '#6b0c14',
    accentColor: '#e8b860',
    highlight: '#fff4dc',
    rays: 110,
    speed: 60,
    hover: 120,
    reach: 30,
    burst: { dispersion: 120, core: 14, falloff: 70, bend: 90 },
    center: [0, -0.06],
    power: 0,
  })
  const gate = new Gate(document.getElementById('cvGate'))
  setLoad(80)

  /* ---------- the chapter list ---------- */
  const $ = (id) => document.getElementById(id)
  const scenes = ['hero', 'motto', 'palace', 'magnolia', 'campus', 'peace', 'history', 'gate'].map((id, i) => {
    const el = $(id)
    const sticky = el.querySelector('.scene__sticky')
    const shade = document.createElement('div')
    shade.className = 'scene__shade'
    sticky.append(shade)
    el.style.zIndex = i + 1
    return { id, el, sticky, shade, p: 0, on: false, lines: el.querySelectorAll('.line__in'), extras: el.querySelectorAll('.kicker, .body, .facts, .peace__stat, .years, .bloom-meter') }
  })
  const S = Object.fromEntries(scenes.map((s) => [s.id, s]))
  scenes.slice(1).forEach((s) => {
    if (s.lines.length) gsap.set(s.lines, { yPercent: 130 })
    if (s.extras.length) gsap.set(s.extras, { opacity: 0, y: 18 })
    s.shown = false
  })
  const reveal = (s, on) => {
    if (on === s.shown) return
    s.shown = on
    if (on) {
      if (s.lines.length) gsap.to(s.lines, { yPercent: 0, duration: 1.2, stagger: 0.09, ease: 'expo.out', overwrite: true })
      if (s.extras.length) gsap.to(s.extras, { opacity: 1, y: 0, duration: 1, stagger: 0.08, delay: 0.25, ease: 'power3.out', overwrite: true })
    } else {
      if (s.lines.length) gsap.to(s.lines, { yPercent: 130, duration: 0.4, ease: 'power2.in', overwrite: true })
      if (s.extras.length) gsap.to(s.extras, { opacity: 0, y: 18, duration: 0.3, overwrite: true })
    }
  }

  /* ---------- per-chapter UI ---------- */
  const facts = [...$('palaceFacts').children]
  const yearsEl = $('years')
  const yearItems = YEARS.map(([y, t]) => {
    const li = document.createElement('li')
    li.innerHTML = `<b>${y}</b><span>${t}</span>`
    yearsEl.appendChild(li)
    return li
  })
  const story = [...$('gateStory').children]
  const gateBody = document.querySelector('.gate__body')
  if (touch) {
    $('mottoHint').textContent = '빛이 글자 사이로 쏟아집니다'
    document.querySelector('.hint--wall').lastChild.textContent = '벽을 문지르면 글자에 불이 켜집니다'
  }

  // Campus tour card.
  const stopEl = $('stop')
  const stopDots = campus.stops.map(() => {
    const li = document.createElement('li')
    $('stopDots').appendChild(li)
    return li
  })
  let stopIdx = -2
  const showStop = (i) => {
    if (i === stopIdx) return
    stopIdx = i
    stopEl.classList.toggle('is-on', i >= 0)
    stopDots.forEach((d, k) => d.classList.toggle('is-on', k === i))
    if (i < 0) return
    const s = campus.stops[i]
    $('stopNo').textContent = `${String(i + 1).padStart(2, '0')} / ${String(campus.stops.length).padStart(2, '0')}`
    $('stopKind').textContent = s.kind
    $('stopName').textContent = s.name
    $('stopEn').textContent = s.en
    $('stopBody').textContent = s.body
    gsap.fromTo(['#stopName', '#stopEn', '#stopBody'], { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.05, ease: 'expo.out', overwrite: true })
  }
  // Name tags over the campus.
  // (made once the campus has been built, which waits for the terrain)
  const tagsEl = $('tags')
  const tagEls = []
  const makeTags = () =>
    campus.labels.forEach((l) => {
      const el = document.createElement('span')
      el.className = 'tag' + (l.stop ? ' is-stop' : '')
      el.textContent = l.name
      tagsEl.appendChild(el)
      tagEls.push(el)
    })

  const navLinks = [...document.querySelectorAll('.nav__links a')]
  const progressLine = $('progressLine')
  const heroBody = document.querySelector('.hero__body')
  const campusHead = document.querySelector('.campus__head')

  // Everything scroll-driven, once a frame.
  let current = 0
  const tf = scenes.map(() => '')
  const update = (dt) => {
    current = 0
    tf.fill('')
    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i]
      const r = s.el.getBoundingClientRect()
      s.on = r.top < viewH && r.bottom > 0
      s.p = clamp01(-r.top / Math.max(1, r.height - viewH))
      if (r.top <= viewH * 0.5) current = i
      if (i === 0) continue
      // The next chapter dissolves in over the last one: pinned to the
      // screen, settling from a slight zoom and blur, while the last one
      // drifts forward and dims beneath it.
      const prev = scenes[i - 1]
      const k = clamp01(1 - r.top / viewH)
      const mid = k > 0 && k < 1
      const e = ease(clamp01((k - 0.05) / 0.85))
      s.sticky.style.opacity = mid ? e.toFixed(3) : ''
      // (Phones: the chapter just rises with the page as it fades in, so
      // touch scrolling stays native.)
      if (mid && !MOBILE) {
        tf[i] = `translate3d(0, ${-r.top}px, 0) scale(${(1.06 - 0.06 * e).toFixed(4)})`
        tf[i - 1] = `scale(${(1 + k * 0.07).toFixed(4)})`
      }
      if (!MOBILE) s.sticky.style.filter = mid ? `blur(${((1 - e) * 6).toFixed(2)}px)` : ''
      prev.shade.style.opacity = mid ? (ease(k) * 0.55).toFixed(3) : '0'
      reveal(s, k > 0.6 && s.p < 0.995)
    }
    scenes.forEach((s, i) => s.sticky.style.transform !== tf[i] && (s.sticky.style.transform = tf[i]))

    /* 00 hero: walk up the nave toward the rose */
    const h = S.hero
    nave.progress = h.p
    heroBody.style.opacity = (1 - range(h.p, 0.05, 0.4)).toFixed(3)
    heroBody.style.transform = `translateY(${(-range(h.p, 0, 0.5) * 8).toFixed(2)}vh)`

    /* 01 motto */
    shadow.props.power = S.motto.on ? 1 : 0

    /* 02 palace */
    palace.progress = S.palace.p
    const fi = Math.floor(range(S.palace.p, 0.12, 0.9) * facts.length - 0.001)
    facts.forEach((li, k) => li.classList.toggle('is-on', k <= fi))

    /* 03 magnolia: open with scroll, petals fall once it has bloomed */
    const bloom = ease(range(S.magnolia.p, 0.05, 0.75))
    lotus.props.open = bloom
    petals.amount = range(S.magnolia.p, 0.55, 0.85)
    petals.active = S.magnolia.on
    $('bloomBar').style.setProperty('--k', bloom)
    $('bloomNum').textContent = `${Math.round(bloom * 100)}%`

    /* 04 campus */
    campus.progress = S.campus.p
    campusHead.style.opacity = (1 - range(S.campus.p, 0.045, 0.085)).toFixed(3)
    campus.active = S.campus.on
    if (S.campus.on) {
      showStop(campus.stopIndex())
      if (!tagEls.length && campus.labels.length) makeTags()
      campus.placeLabels(tagEls, viewW, viewH)
    } else showStop(-1)

    /* 05 peace: the Earth turns with scroll, comes closer */
    atlas.props.spin = S.peace.p * Math.PI * 1.4
    atlas.props.scale = 0.85 + ease(range(S.peace.p, 0, 0.6)) * 0.3

    /* 06 history: the wall lights up year by year */
    const hp = range(S.history.p, 0.08, 0.92)
    wall.props.sweep = hp * 1.08
    const yi = Math.min(YEARS.length - 1, Math.floor(hp * YEARS.length))
    yearItems.forEach((li, k) => (li.classList.toggle('is-on', k === yi), li.classList.toggle('is-past', k < yi)))

    /* 07 gate: the story, then the doors open on light */
    const gp = S.gate.p
    gate.progress = gp
    const n = story.length
    story.forEach((li, k) => {
      const a = 0.04 + (k / n) * 0.5
      const b = a + 0.5 / n
      const v = Math.sin(Math.PI * range(gp, a, b))
      li.style.opacity = v.toFixed(3)
      li.style.transform = `translateY(${((1 - range(gp, a, b)) * 20 - 10).toFixed(1)}px)`
    })
    const open = range(gp, 0.56, 0.8)
    burst.props.power = 0.15 + ease(open) * 0.95
    gateBody.style.opacity = ease(range(gp, 0.72, 0.86)).toFixed(3)
    gateBody.style.transform = `translateY(${((1 - ease(range(gp, 0.72, 0.86))) * 30).toFixed(1)}px)`

    navLinks.forEach((a) => a.classList.toggle('is-on', a.getAttribute('href') === '#' + scenes[current].id))
    progressLine.style.transform = `scaleX(${clamp01(scrollY / Math.max(1, document.documentElement.scrollHeight - viewH))})`
  }

  let last = performance.now()
  const views = [
    [S.hero, nave],
    [S.palace, palace],
    [S.campus, campus],
    [S.gate, gate],
  ]
  gsap.ticker.add(() => {
    const now = performance.now()
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    update(dt)
    for (const [s, v] of views) if (s.on) v.render(dt)
    if (S.magnolia.on) petals.render(dt)
  })

  /* ---------- warm up, then lift the curtain ---------- */
  for (const v of [nave, palace, campus, gate]) {
    try {
      v.render(1 / 60)
    } catch (e) {
      console.warn(e)
    }
    await new Promise((r) => requestAnimationFrame(r))
  }
  await Promise.race([campus.ready, new Promise((r) => setTimeout(r, 5000))])
  setLoad(92)
  clearInterval(creep)
  setLoad(100)
  while (c.v < 99) await new Promise((r) => requestAnimationFrame(r))
  c.v = 100
  paint()
  await new Promise((r) => setTimeout(r, 380))
  gsap.ticker.remove(paint)

  // The cream page wipes up; the rose ignites from its heart outward.
  await new Promise((done) =>
    gsap
      .timeline({ onComplete: done })
      .to('#loader', { clipPath: 'inset(0 0 100% 0)', duration: 1.25, ease: 'expo.inOut' })
      .to(nave, { reveal: 1, duration: 3.4, ease: 'power2.inOut' }, '-=0.7')
      .fromTo(nave, { flare: 0.9 }, { flare: 0, duration: 2.6, ease: 'power2.out' }, '<0.6')
      .from('.hero .char', { yPercent: 110, opacity: 0, stagger: 0.06, duration: 1.4, ease: 'expo.out' }, '-=2.6')
      .from('.nav, .hero .eyebrow, .reveal-hero', { y: 20, opacity: 0, stagger: 0.08, duration: 1, ease: 'power3.out' }, '-=1.2'),
  )
  lenis.start()
  if (import.meta.env.DEV) Object.assign(window, { __nave: nave, __palace: palace, __campus: campus, __gate: gate, __lenis: lenis })
}

boot()
