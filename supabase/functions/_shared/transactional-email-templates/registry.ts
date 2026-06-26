/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as agentPostsReady } from './agent-posts-ready.tsx'
import { template as agentRunAlert } from './agent-run-alert.tsx'
import { template as autoPublishSuccess } from './auto-publish-success.tsx'
import { template as autoPublishNoPosts } from './auto-publish-no-posts.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'agent-posts-ready': agentPostsReady,
  'agent-run-alert': agentRunAlert,
  'auto-publish-success': autoPublishSuccess,
  'auto-publish-no-posts': autoPublishNoPosts,
}
