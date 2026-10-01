import { useEffect, useRef, useState, type ReactNode } from 'react';
import VectorWordmark from './ok/vector-wordmark';
import TypeSlabField from './ok/type-slab-field';
import LeafDrift from './ok/falling-canopy';
// @ts-ignore — plain JS scenes kept from the first version (rose window shader, nave, hall)
import { Rose } from './legacy/rose.js';
// @ts-ignore
import { buildNave, buildHall } from './legacy/scenes.js';

const NIGHT = '#0B0710';
const CRIMSON = '#A3162F';
const GOLD = '#D9B56A';
const STONE = '#F1E8D8';
const narrow = () => typeof window !== 'undefined' && window.innerWidth < 820;

// Mounts children only near the viewport (keeps WebGL context count low).
function Stage({ children, className = '', margin = '40% 0px' }: { children: ReactNode; className?: string; margin?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { rootMargin: margin });
    io.observe(ref.current!);
    return () => io.disconnect();
  }, [margin]);
  return <div ref={ref} className={`stage ${className}`}>{on && children}</div>;
}

// The shader rose window: created once, rendered only while on screen.
function RoseWindow({ layout, rays = 1, reveal = true }: { layout: (w: number, h: number) => { x: number; y: number; r: number }; rays?: number; reveal?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const rose = new Rose(ref.current, { layout });
    rose.u.uRays.value = rays;
    rose.u.uReveal.value = reveal ? 0 : 1;
    let vis = false, raf = 0, t0 = performance.now();
    const io = new IntersectionObserver(([e]) => (vis = e.isIntersecting));
    io.observe(ref.current!);
    const loop = () => {
      const t = (performance.now() - t0) / 1000;
      if (reveal) rose.u.uReveal.value = Math.min(1, t / 2.4);
      if (vis) rose.render(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); io.disconnect(); rose.renderer.dispose(); };
  }, []);
  return <canvas ref={ref} className="rose" />;
}

function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add('in')), { threshold: 0.18 });
    document.querySelectorAll('.rv').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function Nave() {
  const host = useRef<HTMLDivElement>(null);
  const sec = useRef<HTMLElement>(null);
  useEffect(() => {
    const drive = buildNave(host.current, narrow() ? 8 : 9);
    let raf = 0;
    const loop = () => {
      const r = sec.current!.getBoundingClientRect();
      drive(Math.max(0, Math.min(1, -r.top / Math.max(1, r.height - innerHeight))));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <section className="palace" id="palace" ref={sec}>
      <div className="palace__sticky">
        <div className="nave" ref={host} />
        <div className="palace__glow" />
        <div className="palace__text">
          <p className="eyebrow rv">II · Grand Peace Palace</p>
          <h2 className="rv">스물세 해에 걸쳐<br />지어 올린 빛의 성당</h2>
          <div className="facts">
            <div className="glass rv"><b>1976</b><span>착공</span></div>
            <div className="glass rv"><b>1999</b><span>개교 50주년 개관</span></div>
            <div className="glass rv"><b>Gothic</b><span>화강암 · 스테인드글라스</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Hall() {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => { if (ref.current && !ref.current.childNodes.length) buildHall(ref.current); }, []);
  return <svg ref={ref} viewBox="0 0 1000 520" preserveAspectRatio="xMidYMax meet" />;
}

function Count({ to }: { to: number }) {
  const ref = useRef<HTMLElement>(null);
  const [v, setV] = useState(0);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now(), dur = to > 999 ? 2200 : 1500;
      const tick = () => { const k = Math.min(1, (performance.now() - t0) / dur); setV(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(tick); };
      tick();
    }, { threshold: 0.5 });
    io.observe(ref.current!);
    return () => io.disconnect();
  }, [to]);
  return <b ref={ref}>{v}</b>;
}

export default function App() {
  useReveal();
  const m = narrow();
  return (
    <>
      <header className="nav">
        <a href="#top" className="nav__logo"><span className="nav__mark">慶熙</span>Kyung Hee University</a>
        <nav className="nav__links"><a href="#motto">교시</a><a href="#palace">평화의전당</a><a href="#peace">1981</a><a href="#spring">본관</a><a href="#campus">캠퍼스</a></nav>
        <a className="nav__cta" href="https://iphak.khu.ac.kr" target="_blank" rel="noopener">입학 안내 ↗</a>
      </header>

      {/* HERO — rose window lit by the cursor */}
      <section className="hero" id="top">
        <RoseWindow layout={(w, h) => (w < 820 ? { x: w * 0.5, y: h * 0.33, r: Math.min(w * 0.46, h * 0.3) } : { x: w * 0.68, y: h * 0.5, r: Math.min(h * 0.42, w * 0.3) })} />
        <div className="hero__copy">
          <p className="kicker">KYUNG HEE UNIVERSITY · SINCE 1949</p>
          <h1>문화세계의<br />창조</h1>
          <p className="hero__en">The Creation of a Cultural World</p>
        </div>
        <div className="hero__side"><span className="dot" />커서가 햇빛이 되어 장미창을 비춥니다</div>
      </section>

      {/* MOTTO — serif wordmark that dissolves into its own bezier construction */}
      <section className="motto" id="motto">
        <div className="motto__copy">
          <p className="eyebrow rv">I · Motto</p>
          <h2 className="rv">빛이 유리를 지나 색이 되듯,<br /><span className="gold">배움이 사람을 지나 문화가 됩니다.</span></h2>
          <div className="motto__cols">
            <p className="rv">경희의 교시 <b>‘문화세계의 창조’</b>는 설립자 미원(美源) 조영식 박사가 1951년 저술한 『문화세계의 창조』에서 비롯되었습니다.</p>
            <p className="rv">전쟁 중 피난지 부산에서 시작된 이 약속은, <b>홍익인간의 이념</b>을 오늘의 대학으로 구현하는 경희의 뿌리입니다.</p>
          </div>
        </div>
        <div className="motto__mark">
          <Stage>
            <VectorWordmark
              text={m ? 'KHU' : 'Kyung Hee'}
              font={{ fontFamily: 'Cormorant Garamond', fontWeight: 600, fontSize: m ? '640px' : '300px', lineHeight: '1em', letterSpacing: '-0.02em', textAlign: 'center' }}
              background={NIGHT}
              textColor={STONE}
              shade={CRIMSON}
              accent={GOLD}
              reach={m ? 240 : 320}
              handles={m ? { size: 70, spread: 22, labels: true } : undefined}
            />
          </Stage>
        </div>
      </section>

      <Nave />

      {/* PEACE — 3D type slabs */}
      <section className="peace" id="peace">
        <Stage className="peace__stage">
          <TypeSlabField background={NIGHT} baseColor={STONE} accentColor={GOLD} keyColor={CRIMSON} text="PEACE" font={{ fontFamily: 'Inter', fontWeight: 800 }} density={m ? 13 : 16} size={64} />
        </Stage>
        <div className="peace__inner">
          <p className="eyebrow rv">III · Peace</p>
          <p className="peace__year rv">1981</p>
          <h2 className="rv">설립자 조영식 박사의 제안은<br />UN <span className="gold">‘세계평화의 날’</span> 제정으로 이어졌습니다.</h2>
          <p className="peace__sub rv">학문과 평화. 경희가 세계에 건넨 두 개의 단어입니다.</p>
        </div>
      </section>

      {/* SPRING — real 3D petals over the main hall */}
      <section className="spring" id="spring">
        <Stage className="spring__stage">
          <LeafDrift background="#1a0d17" baseColor="#F4A9C0" accentColor="#FFE3EC" density={m ? 500 : 1100} speed={70} direction={118} leaves={{ size: 26, spin: 90, sway: 110 }} />
        </Stage>
        <div className="spring__hall"><Hall /></div>
        <div className="spring__text">
          <p className="eyebrow rv">IV · Spring</p>
          <h2 className="rv">봄이 오면,<br />본관 앞에서.</h2>
          <p className="rv">문화재로 등록된 서울캠퍼스 본관. 박공벽의 부조에는 교시 ‘문화세계의 창조’가 새겨져 있습니다. 해마다 봄이면, 그 앞으로 꽃잎이 내립니다.</p>
        </div>
      </section>

      {/* CAMPUS */}
      <section className="campus" id="campus">
        <p className="eyebrow rv">V · Campuses</p>
        <h2 className="rv">세 개의 캠퍼스,<br />하나의 경희</h2>
        <div className="cards">
          {[
            ['I', '서울캠퍼스', '서울 동대문구 회기. 본관과 평화의전당이 있는 경희의 얼굴.'],
            ['II', '국제캠퍼스', '경기 용인. 공학·생명과학·체육·외국어 계열이 자리한 캠퍼스.'],
            ['III', '광릉캠퍼스', '경기 남양주 광릉. 숲과 함께 호흡하는 또 하나의 경희.'],
          ].map(([n, t, d], i) => (
            <article className="arch-card rv" key={t} style={{ transitionDelay: `${i * 100}ms` }}>
              <div className="arch-card__win" />
              <span className="arch-card__no">{n}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </article>
          ))}
        </div>
        <div className="stats">
          <div className="rv"><Count to={23} /><span>단과대학</span></div>
          <div className="rv"><Count to={83} /><span>학과</span></div>
          <div className="rv"><Count to={1949} /><span>경희의 시작</span></div>
        </div>
      </section>

      {/* FINALE */}
      <section className="finale" id="apply">
        <div className="finale__rose"><RoseWindow layout={(w, h) => ({ x: w * 0.5, y: h * 0.5, r: Math.max(w, h) * 0.46 })} rays={0} reveal={false} /></div>
        <div className="finale__inner">
          <p className="eyebrow rv">VI · Invitation</p>
          <h2 className="rv">당신이 만들 문화세계,<br />경희에서.</h2>
          <a className="btn rv" href="https://iphak.khu.ac.kr" target="_blank" rel="noopener">입학처 바로가기 →</a>
        </div>
        <footer className="footer">
          <span>본 페이지는 Team Semicolon이 제작한 비공식 홍보 페이지입니다.</span>
          <span>경희대학교 공식 정보 · <a href="https://www.khu.ac.kr" target="_blank" rel="noopener">khu.ac.kr</a></span>
        </footer>
      </section>
    </>
  );
}
