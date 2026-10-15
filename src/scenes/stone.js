import * as THREE from 'three'

// Granite ashlar, drawn once on a canvas: courses of blocks of slightly
// different greys with mortar between. Materials made with stoneMaterial()
// sample it in world space (triplanar), so any box or extrusion gets blocks
// of the right size without UV work.

let ASHLAR = null
function ashlar() {
  if (ASHLAR) return ASHLAR
  const S = 512
  const cv = document.createElement('canvas')
  cv.width = cv.height = S
  const g = cv.getContext('2d')
  g.fillStyle = '#8d8a86'
  g.fillRect(0, 0, S, S)
  const rows = 8
  const rh = S / rows
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let r = 0; r < rows; r++) {
    let x = r % 2 ? -rh * 0.9 : 0
    while (x < S) {
      const w = rh * (1.3 + rnd() * 1.4)
      const v = 200 + Math.round((rnd() - 0.5) * 34)
      g.fillStyle = `rgb(${v},${v - 2},${v - 6})`
      g.fillRect(x + 2, r * rh + 2, w - 4, rh - 4)
      // speckle, like granite
      for (let k = 0; k < 90; k++) {
        const s = rnd()
        g.fillStyle = s < 0.5 ? `rgba(60,58,60,${0.12 + rnd() * 0.15})` : `rgba(255,255,255,${0.1 + rnd() * 0.12})`
        g.fillRect(x + 2 + rnd() * (w - 4), r * rh + 2 + rnd() * (rh - 4), 1.5, 1.5)
      }
      x += w
    }
  }
  // wrap the left-over half block of odd rows
  const t = new THREE.CanvasTexture(cv)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  ASHLAR = t
  return t
}

// A lit stone material; `scale` is blocks per metre / 8 rows.
export function stoneMaterial(color = '#d9d4cc', { scale = 0.11, roughness = 0.88, emissive = '#000000' } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, map: ashlar(), emissive })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uScale = { value: scale }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;\nuniform float uScale;')
      .replace(
        '#include <map_fragment>',
        `vec3 bw = pow(abs(vWN), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
         vec4 tx = texture2D(map, vWP.zy * uScale) * bw.x + texture2D(map, vec2(vWP.x, vWP.z) * uScale) * bw.y + texture2D(map, vWP.xy * uScale) * bw.z;
         diffuseColor *= tx;`,
      )
  }
  m.customProgramCacheKey = () => 'stone' + scale
  return m
}
