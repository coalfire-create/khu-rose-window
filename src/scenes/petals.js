import { tier } from '../device.js'

// Magnolia petals drifting down over the bloom: long cupped tepals, white
// with a blush at the base, tumbling (their width follows the turn) and
// swaying as they fall. `amount` (0..1) is how many are in the air.

export class Petals {
  constructor(canvas) {
    this.c = canvas
    this.g = canvas.getContext('2d')
    this.amount = 0
    this.active = false
    this.list = Array.from({ length: tier(70, 34) }, () => this.spawn(true))
    // One petal drawn once; every petal is that image, turned and scaled.
    const s = (this.sprite = document.createElement('canvas'))
    s.width = 64
    s.height = 128
    const x = s.getContext('2d')
    const grad = x.createLinearGradient(0, 128, 0, 0)
    grad.addColorStop(0, '#e9a8b8')
    grad.addColorStop(0.28, '#fbe3e8')
    grad.addColorStop(1, '#fffaf6')
    x.fillStyle = grad
    x.beginPath()
    x.moveTo(32, 126)
    x.bezierCurveTo(4, 100, 2, 30, 32, 2)
    x.bezierCurveTo(62, 30, 60, 100, 32, 126)
    x.fill()
    // a soft centre vein
    x.strokeStyle = 'rgba(220, 160, 175, 0.35)'
    x.lineWidth = 1.2
    x.beginPath()
    x.moveTo(32, 120)
    x.quadraticCurveTo(30, 60, 32, 10)
    x.stroke()
  }

  spawn(anywhere) {
    return {
      x: Math.random(),
      y: anywhere ? Math.random() * 1.2 - 0.2 : -0.1 - Math.random() * 0.2,
      z: 0.4 + Math.random() * 0.8,
      vy: 0.03 + Math.random() * 0.04,
      sway: Math.random() * Math.PI * 2,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 1.4,
      turn: Math.random() * Math.PI * 2,
      vt: 1 + Math.random() * 2,
      on: Math.random(),
    }
  }

  render(dt) {
    const c = this.c
    const w = c.clientWidth
    const h = c.clientHeight
    const dpr = Math.min(devicePixelRatio, 2)
    if (c.width !== Math.round(w * dpr)) ((c.width = Math.round(w * dpr)), (c.height = Math.round(h * dpr)))
    const g = this.g
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, w, h)
    if (this.amount <= 0.001) return
    for (const p of this.list) {
      p.y += p.vy * p.z * dt
      p.sway += dt * 0.9
      p.rot += p.vr * dt
      p.turn += p.vt * dt
      const x = (p.x + Math.sin(p.sway) * 0.03) * w
      const y = p.y * h
      if (p.y > 1.15) Object.assign(p, this.spawn(false))
      if (p.on > this.amount) continue
      const size = 18 + p.z * 22
      g.save()
      g.translate(x, y)
      g.rotate(p.rot)
      g.scale(Math.cos(p.turn) * 0.85 + 0.15 * Math.sign(Math.cos(p.turn) || 1), 1)
      g.globalAlpha = Math.min(1, (this.amount - p.on) * 6) * (0.55 + 0.45 * p.z)
      g.drawImage(this.sprite, -size * 0.25, -size * 0.5, size * 0.5, size)
      g.restore()
    }
  }
}
