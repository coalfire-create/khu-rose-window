import * as THREE from 'three';

// A gothic rose window drawn entirely in a fragment shader.
// The cursor is the sun: glass near it glows, and coloured shafts of light fall below.
const frag = /* glsl */ `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform vec2 uC; uniform float uR; uniform vec2 uSun; uniform float uReveal; uniform float uRays;
varying vec2 vUv;
#define PI 3.14159265
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hash2(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
// voronoi: x = distance to cell edge, y/z = cell ids
vec3 voro(vec2 x){
  vec2 n = floor(x), f = fract(x), mg, mr; float md = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j)); vec2 r = g + hash2(n + g) - f; float d = dot(r, r);
    if (d < md) { md = d; mr = r; mg = g; }
  }
  md = 8.0;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    vec2 g = mg + vec2(float(i), float(j)); vec2 r = g + hash2(n + g) - f;
    if (dot(mr - r, mr - r) > 1e-5) md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
  }
  return vec3(md, hash(n + mg), hash(n + mg + 7.13));
}
const vec3 CRIM = vec3(0.64, 0.06, 0.16), GOLD = vec3(0.95, 0.72, 0.30), BLUE = vec3(0.10, 0.22, 0.72), VIOL = vec3(0.36, 0.12, 0.52), GREEN = vec3(0.10, 0.45, 0.30);
vec3 pal(float k){ k = fract(k); return k < .2 ? CRIM : k < .4 ? BLUE : k < .6 ? GOLD : k < .8 ? VIOL : GREEN; }

void main(){
  vec2 px = vUv * uRes;
  vec2 p = (px - uC) / uR;                 // window space, radius 1
  float r = length(p), a = atan(p.y, p.x);
  float N = 12.0, sec = 2.0 * PI / N;
  float sid = floor((a + sec * 0.5) / sec);
  float fa = mod(a + sec * 0.5, sec) - sec * 0.5;
  vec2 q = vec2(cos(fa), sin(fa)) * r;     // sector frame, axis = +x
  float fb = mod(a, sec) - sec * 0.5;
  vec2 qb = vec2(cos(fb), sin(fb)) * r;    // half-sector offset frame

  // shapes (negative inside)
  float dOc = r - 0.17;
  float dPet = (length((q - vec2(0.40, 0.0)) / vec2(0.20, 0.072)) - 1.0) * 0.072;
  float dRnd = length(q - vec2(0.70, 0.0)) - 0.105;
  float dSml = length(qb - vec2(0.56, 0.0)) - 0.052;
  float dBand = max(r - 0.86, 0.80 - r);
  float lw = 0.009;

  // light from the sun (cursor), plus a slow breathing
  float sunD = length(p - uSun);
  float light = 0.28 + 1.7 * exp(-sunD * sunD * 2.2) + 0.05 * sin(uTime * 0.7);

  vec3 col; float glass = 0.0;
  vec3 v = voro(p * 11.0);
  float piece = 0.85 + 0.3 * v.y;
  if (dOc < 0.0) {
    float fl = r - (0.10 + 0.05 * cos(6.0 * a));
    col = fl < 0.0 ? mix(GOLD, CRIM, smoothstep(0.02, 0.1, r)) : BLUE;
    glass = 1.0;
    if (abs(fl) < lw * 0.8) glass = -1.0;
  } else if (dPet < 0.0) {
    col = mod(sid, 2.0) < 1.0 ? CRIM : BLUE;
    col = mix(col, pal(v.z), 0.22);
    if (abs(q.y) < 0.004 && q.x > 0.24 && q.x < 0.56) glass = -1.0; else glass = 1.0;
  } else if (dRnd < 0.0) {
    col = length(q - vec2(0.70, 0.0)) < 0.035 ? GOLD : mix(VIOL, BLUE, v.y);
    glass = 1.0;
  } else if (dSml < 0.0) {
    col = GOLD; glass = 1.0;
  } else if (dBand < 0.0) {
    float t = floor((a + PI) / (2.0 * PI) * 72.0);
    col = pal(t * 0.2 + 0.05); glass = 1.0;
  }
  float edge = min(min(abs(dOc), abs(dPet)), min(min(abs(dRnd), abs(dSml)), abs(dBand)));
  vec3 outc;
  if (r > 0.905) {
    // stone wall around the window + halo
    float blocks = step(0.94, fract(p.y * 3.0)) + step(0.96, fract(p.x * 1.6 + floor(p.y * 3.0) * 0.5));
    vec3 wall = vec3(0.055, 0.045, 0.05) * (0.8 + 0.4 * hash(floor(p * vec2(1.6, 3.0)))) * (1.0 - 0.35 * blocks);
    float halo = exp(-(r - 0.9) * 3.5) * (0.25 + 0.35 * exp(-sunD * sunD * 1.2));
    outc = wall + vec3(0.55, 0.25, 0.25) * halo * 0.25;
    if (r < 0.93) outc = vec3(0.18, 0.15, 0.14) * (0.5 + 0.5 * light);   // outer stone moulding
  } else if (glass > 0.5 && edge > lw && v.x > 0.018) {
    outc = col * piece * light;
    outc += col * 0.25 * pow(light, 2.0);                    // bloom-ish core
  } else if (glass != 0.0 || edge < lw) {
    outc = vec3(0.012, 0.01, 0.012);                        // lead came
  } else {
    outc = vec3(0.20, 0.17, 0.16) * (0.35 + 0.5 * light) * (0.85 + 0.15 * hash(floor(p * 40.0)));  // stone tracery
  }

  // coloured light shafts falling below the window
  vec2 d = p; float ang = atan(-d.x, -d.y);                   // 0 = straight down
  float cone = smoothstep(0.9, 0.2, abs(ang)) * step(0.95, r);
  float streak = pow(0.5 + 0.5 * sin(ang * 38.0 + sin(ang * 7.0) * 2.0), 6.0);
  vec3 shaft = pal(floor(ang * 12.0) * 0.21 + 0.3) * streak * cone * exp(-(r - 1.0) * 0.9) * (0.25 + 0.6 * exp(-sunD * sunD * 0.8));
  outc += shaft * 0.22 * uRays;

  // load reveal: iris opening from the centre
  float rev = smoothstep(uReveal * 1.6 - 0.15, uReveal * 1.6, r);
  outc *= 1.0 - rev * 0.92;
  gl_FragColor = vec4(outc, 1.0);
}`;

export class Rose {
  constructor(canvas, { layout }) {
    this.canvas = canvas; this.layout = layout;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.u = { uRes: { value: new THREE.Vector2() }, uTime: { value: 0 }, uC: { value: new THREE.Vector2() }, uR: { value: 1 }, uSun: { value: new THREE.Vector2(0.3, 0.4) }, uReveal: { value: 0 }, uRays: { value: 1 } };
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: this.u, fragmentShader: frag,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    })));
    this.sun = { x: 0.3, y: 0.4, tx: 0.3, ty: 0.4, lastMove: -10 };
    addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      const dpr = this.renderer.getPixelRatio();
      const x = (e.clientX - r.left) * dpr, y = (r.height - (e.clientY - r.top)) * dpr;
      this.sun.tx = (x - this.u.uC.value.x) / this.u.uR.value;
      this.sun.ty = (y - this.u.uC.value.y) / this.u.uR.value;
      this.sun.lastMove = performance.now() / 1000;
    });
    this.resize(); addEventListener('resize', () => this.resize());
  }
  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight; if (!w) return;
    this.renderer.setSize(w, h, false);
    const dpr = this.renderer.getPixelRatio();
    const L = this.layout(w, h);
    this.u.uRes.value.set(w * dpr, h * dpr);
    this.u.uC.value.set(L.x * dpr, (h - L.y) * dpr);
    this.u.uR.value = L.r * dpr;
  }
  render(t) {
    const s = this.sun;
    if (t - s.lastMove > 2.5) { s.tx = 0.55 * Math.cos(t * 0.35); s.ty = 0.45 * Math.sin(t * 0.5) + 0.1; }  // drift when idle
    s.x += (s.tx - s.x) * 0.06; s.y += (s.ty - s.y) * 0.06;
    this.u.uSun.value.set(s.x, s.y); this.u.uTime.value = t;
    this.renderer.render(this.scene, this.camera);
  }
}
