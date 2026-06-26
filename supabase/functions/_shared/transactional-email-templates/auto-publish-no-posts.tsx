import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Postflow'

interface Props {
  target?: 'personal' | 'company'
  scheduledAt?: string
}

const Email = ({ target = 'personal', scheduledAt }: Props) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>No había posts listos para publicar</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>No había posts listos para publicar</Heading>
        <Text style={text}>
          El agente intentó publicar un post {target === 'company' ? 'de empresa' : 'personal'} en LinkedIn{scheduledAt ? ` (${scheduledAt})` : ''}, pero no encontró ningún post con la etiqueta correspondiente en estado <strong>Ready</strong>.
        </Text>
        <Text style={text}>
          Prepara y marca como Ready algún post para la próxima publicación automática.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>Notificación automática de {SITE_NAME}.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: '⚠️ No había posts listos para publicar en LinkedIn',
  displayName: 'Auto-publicación: sin posts',
  previewData: { target: 'personal', scheduledAt: '2026-06-29 11:00 Europe/Madrid' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#475569', lineHeight: '1.5', margin: '0 0 16px' }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#94a3b8' }
