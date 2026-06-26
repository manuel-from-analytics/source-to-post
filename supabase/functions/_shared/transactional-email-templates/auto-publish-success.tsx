import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Postflow'

interface Props {
  postTitle?: string
  postPreview?: string
  linkedinUrl?: string
  target?: 'personal' | 'company'
}

const Email = ({ postTitle, postPreview, linkedinUrl, target = 'personal' }: Props) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Post publicado en LinkedIn</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Tu post se publicó en LinkedIn</Heading>
        <Text style={text}>
          El agente acaba de publicar un post en tu cuenta {target === 'company' ? 'de empresa' : 'personal'} de LinkedIn.
        </Text>
        <Section style={card}>
          {postTitle ? <Heading as="h3" style={h3}>{postTitle}</Heading> : null}
          {postPreview ? <Text style={preview}>{postPreview}…</Text> : null}
          {linkedinUrl ? (
            <Button href={linkedinUrl} style={button}>Ver en LinkedIn</Button>
          ) : null}
        </Section>
        <Hr style={hr} />
        <Text style={footer}>Notificación automática de {SITE_NAME}.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: '✅ Post publicado en LinkedIn',
  displayName: 'Auto-publicación: éxito',
  previewData: {
    postTitle: 'Las consultoras y la IA',
    postPreview: 'Las consultoras pueden acelerar entregables con IA',
    linkedinUrl: 'https://www.linkedin.com/feed/update/urn:li:activity:1234567890/',
    target: 'personal',
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
