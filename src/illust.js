// Line illustrations for 경희 NOW, one per stop, drawn in gold as each stop
// is reached (every <path>, <line>, <circle>, <ellipse>, <rect>, <polyline>
// with class "d" is traced; elements with class "f" fade in after).
// viewBox 0 0 800 600.

const G = '#e8cf8e'
const C = '#d4283a'

const stars = (n, seed = 1) => {
  let s = seed
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  let out = ''
  for (let i = 0; i < n; i++) out += `<circle class="f" cx="${(r() * 800).toFixed(0)}" cy="${(r() * 420).toFixed(0)}" r="${(0.8 + r() * 1.8).toFixed(1)}" fill="${G}" opacity="${(0.3 + r() * 0.6).toFixed(2)}"/>`
  return out
}

export const ART = {
  // 다누리 over the Moon, its magnetometer boom out front; 천리안 2A far off
  space: `
    ${stars(46, 3)}
    <path class="d" d="M520 600 A330 330 0 0 1 800 290" stroke="${G}" stroke-width="3" fill="none"/>
    <path class="d" d="M470 600 A380 380 0 0 1 800 240" stroke="${G}" stroke-width="1.2" fill="none" opacity=".45"/>
    <circle class="d" cx="650" cy="470" r="26" stroke="${G}" stroke-width="2" fill="none"/>
    <circle class="d" cx="720" cy="395" r="14" stroke="${G}" stroke-width="2" fill="none"/>
    <circle class="d" cx="590" cy="545" r="12" stroke="${G}" stroke-width="2" fill="none"/>
    <ellipse class="d" cx="390" cy="300" rx="330" ry="92" transform="rotate(-14 390 300)" stroke="${G}" stroke-width="1.4" stroke-dasharray="6 9" fill="none" opacity=".7"/>
    <g transform="translate(330 205) rotate(-14)">
      <rect class="d" x="-38" y="-34" width="76" height="68" rx="4" stroke="${G}" stroke-width="3" fill="rgba(232,207,142,.08)"/>
      <line class="d" x1="-38" y1="-8" x2="38" y2="-8" stroke="${G}" stroke-width="1.5"/>
      <rect class="d" x="-196" y="-22" width="140" height="44" stroke="${G}" stroke-width="2.5" fill="rgba(232,207,142,.06)"/>
      <rect class="d" x="56" y="-22" width="140" height="44" stroke="${G}" stroke-width="2.5" fill="rgba(232,207,142,.06)"/>
      <path class="d" d="M-180 -22 V22 M-160 -22 V22 M-140 -22 V22 M-120 -22 V22 M-100 -22 V22 M-80 -22 V22 M-196 0 H-56 M72 -22 V22 M92 -22 V22 M112 -22 V22 M132 -22 V22 M152 -22 V22 M172 -22 V22 M56 0 H196" stroke="${G}" stroke-width="1" opacity=".7"/>
      <line class="d" x1="-56" y1="0" x2="-38" y2="0" stroke="${G}" stroke-width="3"/>
      <line class="d" x1="38" y1="0" x2="56" y2="0" stroke="${G}" stroke-width="3"/>
      <path class="d" d="M-14 -34 Q0 -72 14 -34" stroke="${G}" stroke-width="2.5" fill="none"/>
      <line class="d" x1="0" y1="-54" x2="0" y2="-80" stroke="${G}" stroke-width="2"/>
      <line class="d" x1="0" y1="34" x2="0" y2="120" stroke="${C}" stroke-width="2.5"/>
      <rect class="d" x="-9" y="120" width="18" height="18" stroke="${C}" stroke-width="2.5" fill="none"/>
      <text class="f" x="18" y="134" fill="${C}" font-family="JetBrains Mono, monospace" font-size="15" letter-spacing="2">KMAG</text>
    </g>
    <g transform="translate(118 92)" opacity=".85">
      <rect class="d" x="-12" y="-12" width="24" height="24" stroke="${G}" stroke-width="2" fill="none"/>
      <line class="d" x1="-12" y1="0" x2="-46" y2="0" stroke="${G}" stroke-width="2"/>
      <rect class="d" x="-46" y="-8" width="0.1" height="16" stroke="${G}" stroke-width="10"/>
      <text class="f" x="-40" y="40" fill="${G}" font-family="JetBrains Mono, monospace" font-size="12" letter-spacing="2">CHOLLIAN 2A · KSEM</text>
    </g>
    <text class="f" x="40" y="560" fill="${G}" font-family="Noto Serif KR, serif" font-weight="900" font-size="64">다누리</text>
    <text class="f" x="44" y="590" fill="${G}" font-family="JetBrains Mono, monospace" font-size="13" letter-spacing="3" opacity=".8">KOREA PATHFINDER LUNAR ORBITER</text>`,

  // a laurel wreath round a great "3", over a hotel's arched front
  hospitality: `
    <g transform="translate(400 250)">
      ${Array.from({ length: 9 }, (_, i) => {
        const a = Math.PI * (0.62 + i * 0.1)
        const x = Math.cos(a) * 170
        const y = Math.sin(a) * 170
        const r = ((a * 180) / Math.PI + 90).toFixed(1)
        return `<ellipse class="d" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="13" ry="30" transform="rotate(${r} ${x.toFixed(1)} ${y.toFixed(1)})" stroke="${G}" stroke-width="2.2" fill="rgba(232,207,142,.08)"/><ellipse class="d" cx="${(-x).toFixed(1)}" cy="${y.toFixed(1)}" rx="13" ry="30" transform="rotate(${-r} ${(-x).toFixed(1)} ${y.toFixed(1)})" stroke="${G}" stroke-width="2.2" fill="rgba(232,207,142,.08)"/>`
      }).join('')}
      <path class="d" d="M-150 120 Q0 200 150 120" stroke="${G}" stroke-width="2.5" fill="none"/>
      <text class="f" x="0" y="54" text-anchor="middle" fill="#fff2d8" font-family="Cormorant Garamond, serif" font-weight="600" font-size="190">3</text>
      <text class="f" x="62" y="-34" fill="${G}" font-family="Cormorant Garamond, serif" font-style="italic" font-size="46">rd</text>
    </g>
    <path class="d" d="M120 600 V500 H680 V600" stroke="${G}" stroke-width="2.5" fill="none"/>
    <path class="d" d="M100 500 L400 448 L700 500" stroke="${G}" stroke-width="2.5" fill="none"/>
    ${Array.from({ length: 9 }, (_, i) => `<path class="d" d="M${160 + i * 60} 600 V560 A16 16 0 0 1 ${192 + i * 60} 560 V600" stroke="${G}" stroke-width="1.8" fill="rgba(255,196,122,.12)"/>`).join('')}
    <line class="d" x1="400" y1="448" x2="400" y2="400" stroke="${G}" stroke-width="2"/>
    <path class="d" d="M400 400 L440 412 L400 424" stroke="${C}" stroke-width="2.5" fill="rgba(212,40,58,.3)"/>
    <text class="f" x="400" y="535" text-anchor="middle" fill="${G}" font-family="JetBrains Mono, monospace" font-size="14" letter-spacing="4">HOSPITALITY &amp; TOURISM · WORLD 3RD</text>`,

  // a climbing line through the years to 237
  the: `
    <line class="d" x1="80" y1="520" x2="740" y2="520" stroke="${G}" stroke-width="2"/>
    <line class="d" x1="80" y1="520" x2="80" y2="80" stroke="${G}" stroke-width="2"/>
    ${[0, 1, 2, 3, 4].map((i) => `<line class="d" x1="80" y1="${520 - i * 100}" x2="740" y2="${520 - i * 100}" stroke="${G}" stroke-width="0.8" opacity=".3"/>`).join('')}
    ${[[150, 430], [270, 380], [390, 340], [510, 255], [630, 150]].map(([x, y], i) => `<rect class="d" x="${x - 28}" y="${y}" width="56" height="${520 - y}" stroke="${G}" stroke-width="2" fill="rgba(232,207,142,${0.06 + i * 0.05})"/>`).join('')}
    <polyline class="d" points="150,430 270,380 390,340 510,255 630,150" stroke="${C}" stroke-width="4" fill="none"/>
    <path class="d" d="M630 150 L600 150 M630 150 L630 180" stroke="${C}" stroke-width="4"/>
    <circle class="d" cx="630" cy="150" r="12" stroke="#fff2d8" stroke-width="3" fill="none"/>
    <text class="f" x="510" y="118" fill="#fff2d8" font-family="Cormorant Garamond, serif" font-weight="600" font-size="84">237</text>
    <text class="f" x="512" y="78" fill="${G}" font-family="JetBrains Mono, monospace" font-size="14" letter-spacing="3">WORLD · 2027</text>
    <text class="f" x="490" y="240" fill="${G}" font-family="JetBrains Mono, monospace" font-size="14" letter-spacing="2" opacity=".85">252</text>
    <text class="f" x="90" y="560" fill="${G}" font-family="JetBrains Mono, monospace" font-size="13" letter-spacing="3" opacity=".8">THE WORLD UNIVERSITY RANKINGS · KOREA 5TH</text>`,

  // a dove with an olive branch inside the ring of the 17 goals
  impact: `
    <g transform="translate(400 290)">
      ${['#e5243b', '#dda63a', '#4c9f38', '#c5192d', '#ff3a21', '#26bde2', '#fcc30b', '#a21942', '#fd6925', '#dd1367', '#fd9d24', '#bf8b2e', '#3f7e44', '#0a97d9', '#56c02b', '#00689d', '#19486a']
        .map((c, i) => {
          const a0 = (i / 17) * Math.PI * 2 - Math.PI / 2 + 0.03
          const a1 = ((i + 1) / 17) * Math.PI * 2 - Math.PI / 2 - 0.03
          const R = 230
          return `<path class="d" d="M${(Math.cos(a0) * R).toFixed(1)} ${(Math.sin(a0) * R).toFixed(1)} A${R} ${R} 0 0 1 ${(Math.cos(a1) * R).toFixed(1)} ${(Math.sin(a1) * R).toFixed(1)}" stroke="${c}" stroke-width="16" fill="none"/>`
        })
        .join('')}
      <path class="d" d="M-150 40 C-110 -40 -40 -70 10 -40 C40 -110 120 -140 190 -120 C150 -80 110 -30 70 0 C110 10 140 30 150 60 C90 60 50 50 20 40 C-20 80 -90 90 -150 40 Z" stroke="#fff2d8" stroke-width="3" fill="rgba(255,242,216,.1)"/>
      <path class="d" d="M10 -40 C30 -80 60 -100 110 -110" stroke="#fff2d8" stroke-width="1.6" fill="none" opacity=".6"/>
      <circle class="d" cx="-110" cy="20" r="4" stroke="#fff2d8" stroke-width="3" fill="#fff2d8"/>
      <path class="d" d="M-150 40 L-185 30 L-152 54" stroke="#fff2d8" stroke-width="3" fill="none"/>
      <path class="d" d="M-186 32 C-210 60 -200 100 -170 120" stroke="${G}" stroke-width="2.5" fill="none"/>
      ${[0, 1, 2, 3].map((i) => `<ellipse class="d" cx="${-200 + i * 9}" cy="${58 + i * 18}" rx="6" ry="13" transform="rotate(${-40 + i * 12} ${-200 + i * 9} ${58 + i * 18})" stroke="${G}" stroke-width="2" fill="rgba(76,159,56,.35)"/>`).join('')}
    </g>
    <text class="f" x="400" y="585" text-anchor="middle" fill="${G}" font-family="JetBrains Mono, monospace" font-size="14" letter-spacing="4">UN SDGs · 17 GOALS</text>`,

  // six cells, six fields
  future: (() => {
    const cells = [
      ['바이오헬스', 'M-18 -30 C18 -10 -18 10 18 30 M18 -30 C-18 -10 18 10 -18 30 M-12 -20 H12 M-12 0 H12 M-12 20 H12'],
      ['인류문명', 'M-30 30 H30 M-26 22 H26 M-22 22 V-16 M-8 22 V-16 M8 22 V-16 M22 22 V-16 M-30 -16 H30 L0 -34 Z'],
      ['양자과학', 'M0 0 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 M-34 0 a34 13 0 1 0 68 0 a34 13 0 1 0 -68 0'],
      ['첨단소재', 'M-22 -12 L0 -26 L22 -12 L22 14 L0 28 L-22 14 Z M0 -26 V0 M-22 14 L0 0 L22 14'],
      ['AI', 'M-20 -20 H20 V20 H-20 Z M-10 -10 H10 V10 H-10 Z M-12 -20 V-32 M0 -20 V-32 M12 -20 V-32 M-12 20 V32 M0 20 V32 M12 20 V32 M-20 -8 H-32 M-20 8 H-32 M20 -8 H32 M20 8 H32'],
      ['우주과학', 'M0 -34 C14 -20 14 6 8 20 H-8 C-14 6 -14 -20 0 -34 Z M-8 20 L-16 32 M8 20 L16 32 M0 22 V36 M0 -14 a5 5 0 1 0 0.1 0'],
    ]
    const hex = (cx, cy, r) => Array.from({ length: 6 }, (_, i) => `${(cx + r * Math.cos((Math.PI / 3) * i + Math.PI / 6)).toFixed(1)},${(cy + r * Math.sin((Math.PI / 3) * i + Math.PI / 6)).toFixed(1)}`).join(' ')
    const pos = [[260, 190], [400, 110], [540, 190], [540, 350], [400, 430], [260, 350]]
    return (
      `<polygon class="d" points="${hex(400, 270, 70)}" stroke="${C}" stroke-width="3" fill="rgba(212,40,58,.12)"/>` +
      `<text class="f" x="400" y="262" text-anchor="middle" fill="#fff2d8" font-family="Noto Serif KR, serif" font-weight="900" font-size="30">경희</text>` +
      `<text class="f" x="400" y="292" text-anchor="middle" fill="${G}" font-family="JetBrains Mono, monospace" font-size="12" letter-spacing="3">6 FRONTIERS</text>` +
      pos
        .map(
          ([x, y], i) =>
            `<polygon class="d" points="${hex(x, y, 76)}" stroke="${G}" stroke-width="2.4" fill="rgba(232,207,142,.06)"/>` +
            `<path class="d" d="${cells[i][1]}" transform="translate(${x} ${y - 10})" stroke="${G}" stroke-width="2.4" fill="none"/>` +
            `<text class="f" x="${x}" y="${y + 50}" text-anchor="middle" fill="#fff2d8" font-family="Pretendard Variable, sans-serif" font-weight="700" font-size="17">${cells[i][0]}</text>`,
        )
        .join('')
    )
  })(),

  // a startup's rocket rising past a stack of scholarships, a mortarboard
  students: `
    ${stars(26, 9)}
    <g transform="translate(250 300) rotate(-24)">
      <path class="d" d="M0 -150 C44 -110 52 -30 36 40 H-36 C-52 -30 -44 -110 0 -150 Z" stroke="${G}" stroke-width="3" fill="rgba(232,207,142,.08)"/>
      <circle class="d" cx="0" cy="-60" r="18" stroke="${G}" stroke-width="3" fill="rgba(80,140,255,.25)"/>
      <path class="d" d="M-36 0 L-70 50 L-30 40 M36 0 L70 50 L30 40" stroke="${G}" stroke-width="3" fill="none"/>
      <path class="d" d="M-20 44 Q0 140 20 44" stroke="${C}" stroke-width="3" fill="rgba(212,40,58,.25)"/>
      <path class="d" d="M-10 50 Q0 200 10 50" stroke="#ffcf8a" stroke-width="2" fill="none"/>
    </g>
    <path class="d" d="M140 560 C180 470 210 420 236 380" stroke="${G}" stroke-width="1.5" stroke-dasharray="5 8" fill="none"/>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<ellipse class="d" cx="560" cy="${540 - i * 26}" rx="70" ry="16" stroke="${G}" stroke-width="2.4" fill="rgba(232,207,142,${0.08 + i * 0.03})"/>`).join('')}
    <path class="d" d="M480 290 L560 256 L640 290 L560 324 Z" stroke="#fff2d8" stroke-width="3" fill="rgba(255,242,216,.12)"/>
    <path class="d" d="M520 306 V340 Q560 362 600 340 V306" stroke="#fff2d8" stroke-width="3" fill="none"/>
    <path class="d" d="M640 290 V340" stroke="${C}" stroke-width="3"/>
    <circle class="d" cx="640" cy="346" r="6" stroke="${C}" stroke-width="3" fill="${C}"/>
    <text class="f" x="120" y="110" fill="#fff2d8" font-family="Noto Serif KR, serif" font-weight="900" font-size="44">창업 매출 1위</text>
    <text class="f" x="470" y="200" fill="#fff2d8" font-family="Noto Serif KR, serif" font-weight="900" font-size="44">장학금 1위</text>`,
}
