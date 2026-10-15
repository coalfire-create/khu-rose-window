// Stained glass, shared by every window on the site: one GLSL function that
// gives the colour of the glass at a point of a rose (polar) or a lancet
// (rectangular) window, in 경희's crimson, royal blue and antique gold with
// emerald and violet between. Floors use the same function to throw the
// window's colours where its light lands.

export const GLASS_GLSL = /* glsl */ `
float gHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 gHash2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }

// Palette: 0 crimson, 1 royal blue, 2 gold, 3 emerald, 4 violet, 5 rose, 6 sky.
vec3 gPalette(float h) {
  if (h < 0.24) return vec3(0.78, 0.05, 0.09);
  if (h < 0.46) return vec3(0.05, 0.16, 0.62);
  if (h < 0.62) return vec3(0.98, 0.72, 0.22);
  if (h < 0.72) return vec3(0.06, 0.52, 0.34);
  if (h < 0.82) return vec3(0.42, 0.12, 0.62);
  if (h < 0.91) return vec3(0.95, 0.36, 0.42);
  return vec3(0.28, 0.62, 0.95);
}

// Voronoi cells inside a pane: returns (cell id hash, distance to the lead).
vec2 gCells(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  vec2 id = vec2(0.0);
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = gHash2(i + g);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; id = i + g; }
      else if (d < d2) d2 = d;
    }
  return vec2(gHash(id), sqrt(d2) - sqrt(d1));
}

// The rose: uv in -1..1 over the window's circle. Returns rgb and coverage
// (0 where stone or outside).
vec4 roseGlass(vec2 uv, float spokes, float t) {
  float r = length(uv);
  if (r > 1.0) return vec4(0.0);
  float a = atan(uv.y, uv.x);
  float seg = 6.2831853 / spokes;
  float k = floor((a + 3.1415927) / seg);
  float la = mod(a + 3.1415927, seg) - seg * 0.5;
  // rings: centre, inner petals, outer lancets, rim roundels
  float ring = r < 0.16 ? 0.0 : r < 0.46 ? 1.0 : r < 0.84 ? 2.0 : 3.0;
  vec2 cellP = vec2(la * r * 9.0, r * 9.0) + vec2(k * 3.1, ring * 7.7);
  vec2 c = gCells(cellP);
  // hue by ring and cell, mirrored so the rose reads symmetric
  float sym = gHash(vec2(abs(mod(k, 4.0) - 1.5), ring));
  float h = fract(sym * 0.7 + c.x * 0.3 + ring * 0.13);
  if (ring == 0.0) h = 0.55; // gold heart
  vec3 col = gPalette(h);
  // painted glass: darker edges per pane, a few brighter flashed pieces
  col *= 0.65 + 0.55 * smoothstep(0.0, 0.25, c.y);
  col *= 0.85 + 0.35 * step(0.86, c.x);
  // lead came between pieces
  float lead = smoothstep(0.035, 0.075, c.y);
  return vec4(col, lead);
}

// A lancet: uv 0..1 across, 0..1 up the opening.
vec4 lancetGlass(vec2 uv, float seed) {
  vec2 p = uv * vec2(3.0, 10.0) + seed * 13.0;
  vec2 c = gCells(p);
  float band = floor(uv.y * 6.0);
  float h = fract(c.x * 0.45 + gHash(vec2(band, seed)) * 0.55);
  vec3 col = gPalette(h);
  col *= 0.6 + 0.6 * smoothstep(0.0, 0.25, c.y);
  float lead = smoothstep(0.035, 0.08, c.y);
  // saddle bars
  float fb = fract(uv.y * 6.0);
  lead *= smoothstep(0.004, 0.02, min(fb, 1.0 - fb));
  return vec4(col, lead);
}
`
