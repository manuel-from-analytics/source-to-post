import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Postflow'

interface PostItem {
  id: string
  title?: string
  preview?: string
  url?: string
}

interface AgentPostsReadyProps {
  summary?: string
  posts?: PostItem[]
  count?: number
}

const AgentPostsReadyEmail = ({ summary, posts = [], count }: AgentPostsReadyProps) => {
  const total = count ?? posts.length
  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>{`${total} posts listos para revisar`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Tus posts del día están listos</Heading>
          {summary ? <Text style={text}>{summary}</Text> : null}
          <Text style={text}>
            {total === 1
              ? 'Hay 1 post nuevo generado por tu agente.'
              : `Hay ${total} posts nuevos generados por tu agente.`}
          </Text>
          {posts.map((p) => (
            <Section key={p.id} style={card}>
              <Heading as="h3" style={h3}>{p.title || 'Sin título'}</Heading>
              {p.preview ? <Text style={preview}>{p.preview}…</Text> : null}
              {p.url ? (
                <Button href={p.url} style={button}>Revisar y copiar</Button>
              ) : null}
            </Section>
          ))}
          <Hr style={hr} />
          <Text style={footer}>Generado automáticamente por tu agente de {SITE_NAME}.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: AgentPostsReadyEmail,
  subject: (data: Record<string, any>) => {
    const n = data?.count ?? data?.posts?.length ?? 0
    return `${n} posts listos para revisar`
  },
  displayName: 'Agente: posts listos',
  previewData: {
    summary: 'Resumen del día generado por tu agente.',
    count: 2,
    posts: [
      { id: '1', title: 'IA aplicada a analytics', preview: 'Las consultoras pueden acelerar...', url: 'https://source-to-post.lovable.app/history?post=1' },
      { id: '2', title: 'Tendencias en GenAI', preview: 'En 2026 veremos cómo...', url: 'https://source-to-post.lovable.app/history?post=2' },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 16px' }
const h3 = { fontSize: '16px', fontWeight: 600, color: '#0f172a', margin: '0 0 8px' }
const text = { fontSize: '14px', color: '#475569', lineHeight: '1.5', margin: '0 0 16px' }
const preview = { fontSize: '14px', color: '#475569', lineHeight: '1.5', margin: '0 0 12px' }
const card = { padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px', margin: '0 0 16px' }
const button = { backgroundColor: '#3b82f6', color: '#ffffff', padding: '10px 16px', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', display: 'inline-block' }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#94a3b8' }
