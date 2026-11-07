import { useEffect, useRef } from 'react'

interface Node3D {
  label: string
  sub: string
  x: number
  y: number
  z: number
  color: string
  glowColor: string
  radius: number
  type: 'component' | 'endpoint' | 'pr' | 'slack_truth' | 'slack_trap'
}

interface SpatialAwareness3DProps {
  activeEndpoint: string
  activeComponent: string
}

export function SpatialAwareness3D({ activeEndpoint, activeComponent }: SpatialAwareness3DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let angleY = 0.003
    let angleX = 0.001
    let rotY = 0
    let rotX = 0.2
    let isDragging = false
    let prevMouseX = 0
    let prevMouseY = 0

    // 3D Nodes representing the InSync Coordination Graph
    const nodes: Node3D[] = [
      {
        label: activeComponent || 'ProfileSettings',
        sub: 'Your Component',
        x: -120,
        y: -40,
        z: 0,
        color: '#00f2fe',
        glowColor: 'rgba(0, 242, 254, 0.6)',
        radius: 12,
        type: 'component',
      },
      {
        label: activeEndpoint || 'GET /users/id',
        sub: 'API Dependency',
        x: 0,
        y: -20,
        z: 60,
        color: '#38bdf8',
        glowColor: 'rgba(56, 189, 248, 0.6)',
        radius: 10,
        type: 'endpoint',
      },
      {
        label: 'PR #18: Field Rename',
        sub: '- user_name / + display_name',
        x: 130,
        y: -50,
        z: -20,
        color: '#f87171',
        glowColor: 'rgba(239, 68, 68, 0.6)',
        radius: 11,
        type: 'pr',
      },
      {
        label: 'Slack: Confirmed Decision',
        sub: '#backend-api (Verified)',
        x: 80,
        y: 80,
        z: 40,
        color: '#10b981',
        glowColor: 'rgba(16, 185, 129, 0.6)',
        radius: 10,
        type: 'slack_truth',
      },
      {
        label: 'Slack: Unresolved Proposal',
        sub: 'email_verified (Trap)',
        x: -90,
        y: 85,
        z: -50,
        color: '#f59e0b',
        glowColor: 'rgba(245, 158, 11, 0.6)',
        radius: 9,
        type: 'slack_trap',
      },
    ]

    // Edges connecting knowledge graph in 3D
    const edges = [
      { from: 0, to: 1, style: 'solid', color: 'rgba(0, 242, 254, 0.45)' }, // Component -> Endpoint
      { from: 1, to: 2, style: 'solid', color: 'rgba(239, 68, 68, 0.55)' },  // Endpoint -> PR (Breaking)
      { from: 2, to: 3, style: 'solid', color: 'rgba(16, 185, 129, 0.5)' },  // PR -> Confirmed Decision
      { from: 2, to: 4, style: 'dashed', color: 'rgba(245, 158, 11, 0.35)' }, // PR -> Unverified Proposal
    ]

    // Floating particles for 3D depth
    const particles = Array.from({ length: 35 }, () => ({
      x: (Math.random() - 0.5) * 360,
      y: (Math.random() - 0.5) * 240,
      z: (Math.random() - 0.5) * 200,
      radius: Math.random() * 1.5 + 0.5,
    }))

    function handleMouseDown(e: MouseEvent) {
      isDragging = true
      prevMouseX = e.clientX
      prevMouseY = e.clientY
    }

    function handleMouseMove(e: MouseEvent) {
      if (!isDragging) return
      const deltaX = e.clientX - prevMouseX
      const deltaY = e.clientY - prevMouseY
      rotY += deltaX * 0.008
      rotX += deltaY * 0.008
      prevMouseX = e.clientX
      prevMouseY = e.clientY
    }

    function handleMouseUp() {
      isDragging = false
    }

    canvas.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    function render() {
      if (!ctx || !canvas) return

      // Adjust canvas resolution for Retina screens
      const dpr = window.devicePixelRatio || 1
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr
        canvas.height = height * dpr
        ctx.scale(dpr, dpr)
      }

      ctx.clearRect(0, 0, width, height)

      // Auto-rotation when not user-dragging
      if (!isDragging) {
        rotY += angleY
        rotX += angleX * 0.2
      }

      const cosY = Math.cos(rotY)
      const sinY = Math.sin(rotY)
      const cosX = Math.cos(rotX)
      const sinX = Math.sin(rotX)

      const cx = width / 2
      const cy = height / 2 + 10
      const fov = 320

      // Project 3D Point to 2D
      function project(x: number, y: number, z: number) {
        // Rotate Y
        const x1 = x * cosY - z * sinY
        const z1 = z * cosY + x * sinY
        // Rotate X
        const y2 = y * cosX - z1 * sinX
        const z2 = z1 * cosX + y * sinX

        const scale = fov / (fov + z2 + 100)
        return {
          px: cx + x1 * scale,
          py: cy + y2 * scale,
          pz: z2,
          scale,
        }
      }

      // 1. Draw floating ambient particles
      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)'
      particles.forEach((p) => {
        const proj = project(p.x, p.y, p.z)
        if (proj.pz + 100 > 0) {
          ctx.beginPath()
          ctx.arc(proj.px, proj.py, p.radius * proj.scale, 0, Math.PI * 2)
          ctx.fill()
        }
      })

      // 2. Draw 3D Edges / Connecting Knowledge Rays
      const projectedNodes = nodes.map((n) => project(n.x, n.y, n.z))

      edges.forEach((edge) => {
        const from = projectedNodes[edge.from]!
        const to = projectedNodes[edge.to]!

        ctx.beginPath()
        if (edge.style === 'dashed') {
          ctx.setLineDash([4, 4])
        } else {
          ctx.setLineDash([])
        }
        ctx.strokeStyle = edge.color
        ctx.lineWidth = Math.max(1, 1.8 * ((from.scale + to.scale) / 2))
        ctx.moveTo(from.px, from.py)
        ctx.lineTo(to.px, to.py)
        ctx.stroke()
      })
      ctx.setLineDash([])

      // 3. Sort Nodes by Depth (Painter's Algorithm)
      const indexedNodes = nodes.map((n, i) => ({ node: n, proj: projectedNodes[i]!, idx: i }))
      indexedNodes.sort((a, b) => a.proj.pz - b.proj.pz)

      // 4. Render Nodes with 3D Spherical Shading & Labels
      indexedNodes.forEach(({ node, proj }) => {
        const r = Math.max(4, node.radius * proj.scale)

        // Radial glow
        const glow = ctx.createRadialGradient(proj.px, proj.py, r * 0.4, proj.px, proj.py, r * 2.8)
        glow.addColorStop(0, node.glowColor)
        glow.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(proj.px, proj.py, r * 2.8, 0, Math.PI * 2)
        ctx.fill()

        // 3D Sphere Highlight
        const grad = ctx.createRadialGradient(
          proj.px - r * 0.3,
          proj.py - r * 0.3,
          r * 0.1,
          proj.px,
          proj.py,
          r,
        )
        grad.addColorStop(0, '#ffffff')
        grad.addColorStop(0.3, node.color)
        grad.addColorStop(1, '#050a14')

        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(proj.px, proj.py, r, 0, Math.PI * 2)
        ctx.fill()

        // Ring Border
        ctx.strokeStyle = node.color
        ctx.lineWidth = 1.2
        ctx.stroke()

        // Crisp Typography Label
        ctx.font = `bold ${Math.max(9, Math.round(11 * proj.scale))}px Inter, sans-serif`
        ctx.fillStyle = '#f8fafc'
        ctx.textAlign = 'center'
        ctx.fillText(node.label, proj.px, proj.py - r - 6)

        ctx.font = `${Math.max(8, Math.round(9 * proj.scale))}px ui-monospace, monospace`
        ctx.fillStyle = node.color
        ctx.fillText(node.sub, proj.px, proj.py - r - 20)
      })

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animationFrameId)
      canvas.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [activeEndpoint, activeComponent])

  return (
    <div className="spatial-canvas-card">
      <div className="spatial-canvas-header">
        <div className="flex items-center gap-2">
          <span className="spatial-pulse-dot" />
          <strong className="text-xs font-bold text-white uppercase tracking-wider">
            Interactive 3D Coordination Map (Drag to Rotate)
          </strong>
        </div>
        <span className="text-[10px] font-mono text-cyan-400">Live Spatial Awareness</span>
      </div>
      <canvas
        ref={canvasRef}
        className="spatial-canvas"
        style={{ width: '100%', height: '220px', cursor: 'grab' }}
      />
    </div>
  )
}
