'use client'

import { useState, useEffect, useRef } from 'react'
import { useApi } from '@/components/shared/utils'
import { useNavStore } from '@/stores/nav-store'
import { motion } from 'framer-motion'
import { Network, Loader2, ZoomIn, ZoomOut, Users, Swords, MapPin } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface GraphNode {
  id: string
  label: string
  type: 'caliral' | 'productor' | 'competidor' | 'destino'
  x: number
  y: number
}

interface GraphEdge {
  source: string
  target: string
  weight: number
  type: 'caliral-prod' | 'comp-prod' | 'prod-dest'
}

export function MapaRelacionesView() {
  const { select } = useNavStore()
  const svgRef = useRef<SVGSVGElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // Cargar datos
  const { data: productoresData } = useApi<{ productores: any[] }>('/api/producers')
  const { data: competidoresData } = useApi<{ competidores: any[] }>('/api/competitors')

  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [edges, setEdges] = useState<GraphEdge[]>([])
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)

  useEffect(() => {
    if (!productoresData?.productores || !competidoresData?.competidores) return

    const newNodes: GraphNode[] = []
    const newEdges: GraphEdge[] = []

    // Caliral al centro
    newNodes.push({
      id: 'caliral',
      label: 'CALIRAL',
      type: 'caliral',
      x: 500,
      y: 350,
    })

    // Productores alrededor de Caliral
    const productores = productoresData.productores.slice(0, 15)
    productores.forEach((p, i) => {
      const angle = (i / productores.length) * Math.PI * 2
      const radius = 180
      newNodes.push({
        id: p.id,
        label: p.nombre,
        type: 'productor',
        x: 500 + Math.cos(angle) * radius,
        y: 350 + Math.sin(angle) * radius,
      })
      // Edge a Caliral si tiene operaciones
      if (p.operacionesCaliralTotal > 0) {
        newEdges.push({
          source: p.id,
          target: 'caliral',
          weight: Math.min(5, Math.max(1, Math.ceil(p.operacionesCaliralTotal / 10))),
          type: 'caliral-prod',
        })
      }
    })

    // Competidores en circulo externo
    const competidores = competidoresData.competidores.slice(0, 7)
    competidores.forEach((c, i) => {
      const angle = (i / competidores.length) * Math.PI * 2 + 0.3
      const radius = 340
      newNodes.push({
        id: c.id,
        label: c.nombre,
        type: 'competidor',
        x: 500 + Math.cos(angle) * radius,
        y: 350 + Math.sin(angle) * radius,
      })
    })

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNodes(newNodes)
    setEdges(newEdges)
  }, [productoresData, competidoresData])

  // Click en nodo
  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node)
    if (node.type === 'productor') select('productor-detalle', node.id)
    else if (node.type === 'competidor') select('competidor-detalle', node.id)
  }

  // Pan & zoom
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }
  const handleMouseUp = () => setIsDragging(false)

  const colors = {
    caliral: { fill: '#3b82f6', stroke: '#1e40af' },
    productor: { fill: '#10b981', stroke: '#047857' },
    competidor: { fill: '#ef4444', stroke: '#991b1b' },
    destino: { fill: '#eab308', stroke: '#854d0e' },
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Network className="size-6 text-primary" />
            Mapa de Relaciones
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Grafo interactivo: Productor → Caliral → Competidor → Destino
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setZoom(z => Math.max(0.5, z - 0.2))}>
            <ZoomOut className="size-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">{(zoom * 100).toFixed(0)}%</span>
          <Button variant="outline" size="icon" onClick={() => setZoom(z => Math.min(2, z + 0.2))}>
            <ZoomIn className="size-4" />
          </Button>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-3 flex-wrap text-xs">
        <span className="flex items-center gap-1.5">
          <div className="size-3 rounded-full bg-blue-500" />
          Caliral
        </span>
        <span className="flex items-center gap-1.5">
          <div className="size-3 rounded-full bg-emerald-500" />
          Productor
        </span>
        <span className="flex items-center gap-1.5">
          <div className="size-3 rounded-full bg-red-500" />
          Competidor
        </span>
      </div>

      {/* Grafo */}
      <Card className="p-0 overflow-hidden">
        <div className="relative h-[600px] bg-background/50">
          {!productoresData || !competidoresData ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <svg
              ref={svgRef}
              width="100%"
              height="100%"
              viewBox="0 0 1000 700"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="cursor-grab active:cursor-grabbing"
              style={{ transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)` }}
            >
              {/* Edges */}
              {edges.map((e, i) => {
                const source = nodes.find((n) => n.id === e.source)
                const target = nodes.find((n) => n.id === e.target)
                if (!source || !target) return null
                return (
                  <line
                    key={i}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke={e.type === 'caliral-prod' ? '#3b82f6' : '#ef4444'}
                    strokeWidth={e.weight}
                    strokeOpacity={0.4}
                  />
                )
              })}

              {/* Nodes */}
              {nodes.map((n) => {
                const c = colors[n.type]
                const radius = n.type === 'caliral' ? 30 : n.type === 'competidor' ? 22 : 18
                return (
                  <g key={n.id} onClick={() => handleNodeClick(n)} className="cursor-pointer">
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={radius}
                      fill={c.fill}
                      stroke={c.stroke}
                      strokeWidth={2}
                      className="transition-all hover:stroke-4"
                    />
                    <text
                      x={n.x}
                      y={n.y + radius + 14}
                      textAnchor="middle"
                      fill="#e2e8f0"
                      fontSize={n.type === 'caliral' ? 12 : 10}
                      fontWeight={n.type === 'caliral' ? 'bold' : 'normal'}
                    >
                      {n.label.length > 20 ? n.label.substring(0, 18) + '...' : n.label}
                    </text>
                  </g>
                )
              })}
            </svg>
          )}
        </div>
      </Card>

      {/* Tip */}
      <Card className="p-4 text-sm text-muted-foreground">
        <p>
          💡 <strong>Tip:</strong> Haz clic en cualquier nodo para ver el detalle.
          Arrastra para moverte y usa los botones de zoom para acercar/alejar.
          El grosor de las líneas indica el volumen de operaciones entre los nodos.
        </p>
      </Card>
    </div>
  )
}
