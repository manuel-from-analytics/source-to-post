import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Postflow'

interface AgentRunAlertProps {
  alertType?: 'stuck' | 'timeout' | 'no_sources' | 'error'
  runId?: string
  startedAt?: string
  durationMinutes?: number
  errorMessage?: string
  topic?: string
}

const labels: Record<string, { title: string; desc: string }> = {
  stuck: {
    title: 'Tu agente lleva demasiado tiempo en ejecución',
    desc: 'La ejecución se ha quedado bloqueada y ha sido marcada como error automáticamente.',
  },
  timeout: {
    title: 'El agente ha fallado por timeout',
    desc: 'La generación ha excedido el tiempo máximo permitido.',
  },
  no_sources: {
    title: 'El agente no ha encontrado fuentes',
    desc: 'La newsletter se generó pero no se obtuvieron fuentes nuevas, así que no se crearon posts.',
  },
  error: {
    title: 'El agente ha fallado',
    desc: 'La ejecución del agente ha terminado con un error.',
  },
}

const AgentRunAlertEmail = ({
  alertType = 'error',
  runId,
  startedAt,
  durationMinutes,
  errorMessage,
  topic,
}: AgentRunAlertProps) => {
  const info = labels[alertType] || labels.error
  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>{info.title}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{info.title}</Heading>
          <Text style={text}>{info.desc}</Text>
          <Section style={card}>
            {topic ? <Text style={row}><strong>Tema:</strong> {topic}</Text> : null}
            {runId ? <Text style={row}><strong>Run ID:</strong> {runId}</Text> : null}
            {startedAt ? <Text style={row}><strong>Iniciado:</strong> {startedAt}</Text> : null}
            {typeof durationMinutes === 'number' ? (
              <Text style={row}><strong>Duración:</strong> {durationMinutes} min</Text>
            ) : null}
            {errorMessage ? (
              <Text style={errorBox}>{errorMessage}</Text>
            ) : null}
          </Section>
          <Hr style={hr} />
          <Text style={footer}>Notificación automática de {SITE_NAME}.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: AgentRunAlertEmail,
  subject: (data: Record<string, any>) => {
    const t = data?.alertType || 'error'
    if (t === 'stuck') return '⚠️ Agente bloqueado en ejecución'
    if (t === 'timeout') return '⚠️ Agente: timeout en la ejecución'
    if (t === 'no_sources') return '⚠️ Agente: 0 fuentes nuevas hoy'
    return '⚠️ Agente: ejecución fallida'
  },
  displayName: 'Agente: alerta de ejecución',
  previewData: {
    alertType: 'stuck',
    runId: 'abc-123',
    startedAt: '2026-05-30 06:00 UTC',
    durationMinutes: 32,
    errorMessage: 'IDLE_TIMEOUT 150s in generate-newsletter',
    topic: 'AI and analytics latest insights',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#475569', lineHeight: '1.5', margin: '0 0 16px' }
const card = { padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px', margin: '0 0 16px', backgroundColor: '#fef2f2' }
const row = { fontSize: '13px', color: '#334155', margin: '0 0 6px' }
const errorBox = { fontSize: '12px', color: '#991b1b', fontFamily: 'monospace', backgroundColor: '#fee2e2', padding: '10px', borderRadius: '6px', margin: '8px 0 0', whiteSpace: 'pre-wrap' as const, wordBreak: 'break-word' as const }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#94a3b8' }
