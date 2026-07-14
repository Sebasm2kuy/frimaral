'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiFetch } from '@/components/shared/utils'
import {
  Sparkles, Send, Loader2, User, Bot, MessageSquare
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  sources?: string[]
}

const SUGERENCIAS = [
  '¿Qué clientes comenzaron a usar otro depósito?',
  '¿Qué clientes tienen riesgo alto?',
  '¿Qué competidor más creció?',
  '¿Qué productores dejaron de trabajar con Caliral?',
  '¿Qué clientes puedo recuperar?',
  '¿Cuáles son mis mejores clientes?',
  '¿Qué clientes son exclusivos?',
  'Frioport',
  'Las Moras',
]

export function IAComercialView() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '¡Hola! Soy tu asistente comercial de CALIRAL INSIGHT. Puedo responder preguntas sobre productores, competidores, riesgos y oportunidades. Mis respuestas se basan en los datos reales de tu base histórica. ¿En qué puedo ayudarte?',
      timestamp: new Date().toISOString(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const enviarPregunta = async (pregunta: string) => {
    if (!pregunta.trim() || loading) return

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: pregunta,
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await apiFetch<{ content: string; sources?: string[] }>('/api/ai', {
        method: 'POST',
        body: JSON.stringify({ pregunta }),
      })

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: res.content,
        timestamp: new Date().toISOString(),
        sources: res.sources,
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err: any) {
      toast.error(err.message || 'Error al consultar la IA')
      setMessages((prev) => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Lo siento, hubo un error al procesar tu pregunta. Por favor, inténtalo nuevamente.',
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 h-[calc(100vh-7rem)] flex flex-col">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="size-6 text-primary" />
          IA Comercial
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Asistente integrado que responde desde tu base de datos real (no simulado)
        </p>
      </div>

      {/* Mensajes */}
      <Card className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
        {messages.map((m) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
              m.role === 'user'
                ? 'bg-primary/20 text-primary'
                : 'bg-primary text-primary-foreground'
            }`}>
              {m.role === 'user' ? <User className="size-4" /> : <Bot className="size-4" />}
            </div>
            <div className={`max-w-[80%] ${m.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
              <div className={`rounded-2xl px-4 py-3 ${
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-tr-sm'
                  : 'bg-accent border border-border rounded-tl-sm'
              }`}>
                <div className="text-sm prose prose-sm prose-invert max-w-none [&_strong]:font-semibold [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
              {m.sources && m.sources.length > 0 && (
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  <span className="text-xs text-muted-foreground">Fuentes:</span>
                  {m.sources.map((s, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <Bot className="size-4" />
            </div>
            <div className="rounded-2xl px-4 py-3 bg-accent border border-border rounded-tl-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Analizando base de datos...
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </Card>

      {/* Sugerencias */}
      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2">
          {SUGERENCIAS.map((s, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              onClick={() => enviarPregunta(s)}
              className="text-xs"
            >
              <MessageSquare className="size-3 mr-1.5" />
              {s}
            </Button>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          enviarPregunta(input)
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu pregunta..."
          disabled={loading}
          className="flex-1 px-4 py-2.5 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <Button type="submit" disabled={loading || !input.trim()}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </form>
    </div>
  )
}
