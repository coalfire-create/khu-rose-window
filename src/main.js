import './style.css';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Rose } from './rose.js';
import { buildNave, buildHall, Petals } from './scenes.js';

gsap.registerPlugin(ScrollTrigger);
const lenis = new Lenis({ lerp: 0.08 });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); lenis.scrollTo(a.getAttribute('href'), { duration: 1.8 }); }));

const narrow = () => innerWidth < 820;
const clamp = (x) => Math.max(0, Math.min(1, x));
const progressOf = (el) => { const r = el.getBoundingClientRect(); return clamp(-r.top / Math.max(1, r.height - innerHeight)); };
const visible = new Map();
const io = new IntersectionObserver((es) => es.forEach((e) => visible.set(e.target, e.isIntersecting)), { rootMargin: '10% 0px' });
const watch = (el) => { visible.set(el, false); io.observe(el); return el; };

// HERO rose window
const rose = new Rose(document.getElementById('cvRose'), {
  layout: (w, h) => (w < 820 ? { x: w * 0.5, y: h * 0.33, r: Math.min(w * 0.46, h * 0.3) } : { x: w * 0.66, y: h * 0.47, r: Math.min(h * 0.42, w * 0.3) }),
});
gsap.to(rose.u.uReveal, { value: 1, duration: 2.4, ease: 'power2.inOut', delay: 0.2 });
const $hero = watch(document.getElementById('hero'));

// FINALE rose — centred, larger, dimmer
const rose2 = new Rose(document.getElementById('cvRose2'), { layout: (w, h) => ({ x: w * 0.5, y: h * 0.5, r: Math.max(w, h) * 0.46 }) });
rose2.u.uReveal.value = 1; rose2.u.uRays.value = 0;
const $finale = watch(document.getElementById('finale'));

// MOTTO lines rise in
const quote = document.querySelector('.motto__quote');
quote.querySelectorAll('.ln').forEach((l, i) => { l.innerHTML = `<span style="transition-delay:${i * 0.14}s">${l.innerHTML}</span>`; });
ScrollTrigger.create({ trigger: quote, start: 'top 75%', once: true, onEnter: () => quote.classList.add('is-in') });

// PALACE nave
const driveNave = buildNave(document.getElementById('nave'), narrow() ? 8 : 9);
const $palace = document.getElementById('palace');

// SPRING
buildHall(document.getElementById('hall'));
const petals = new Petals(document.getElementById('cvPetals'), narrow() ? 60 : 130);
const $spring = watch(document.getElementById('spring'));

// counters
document.querySelectorAll('[data-count]').forEach((b) => {
  ScrollTrigger.create({ trigger: b, start: 'top 85%', once: true, onEnter: () => {
    const o = { v: 0 }; const to = +b.dataset.count;
    gsap.to(o, { v: to, duration: to > 999 ? 2.2 : 1.6, ease: 'power3.out', onUpdate: () => (b.textContent = Math.round(o.v)) });
  } });
});

gsap.ticker.add((t) => {
  if (visible.get($hero)) rose.render(t);
  if (visible.get($finale)) rose2.render(t);
  if (visible.get($spring)) petals.render(t);
  driveNave(progressOf($palace));
});
