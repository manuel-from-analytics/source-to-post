

# Plan: MCP Server for Source-to-Post

Create an MCP Server as a Supabase Edge Function that exposes the app's main resources (inputs, posts, voices, newsletters) to external AI tools like Claude, Cursor, etc.

## What is an MCP Server?

An MCP (Model Context Protocol) server allows AI tools to interact with your app programmatically. For example, from Claude Desktop or Cursor you could ask "list my saved sources" or "generate a LinkedIn post from my latest article" and it would use your app's API directly.

## Architecture

A single Edge Function (`mcp-server`) using **mcp-lite** + **Hono** that exposes tools for each resource type. Authentication via the user's Supabase JWT token.

## Tools to expose

| Tool | Description |
|------|-------------|
| `list_inputs` | List sources from the library with optional filters (type, category, favorites) |
| `get_input` | Get full details of a specific source |
| `create_input` | Add a new text or URL source |
| `delete_input` | Remove a source |
| `list_posts` | List generated posts with optional filters (status, favorites) |
| `get_post` | Get full post content |
| `generate_post` | Generate a new LinkedIn post from selected sources with parameters (goal, tone, length, CTA, voice) |
| `save_post` | Save a generated post |
| `delete_post` | Remove a post |
| `list_voices` | List available writing voices |
| `list_newsletters` | List generated newsletters |
| `get_newsletter` | Get full newsletter content |

## Technical details

- **File**: `supabase/functions/mcp-server/index.ts`
- **Dependencies**: `mcp-lite` (^0.10.0), `hono`, `@supabase/supabase-js`
- **Auth**: JWT validation via `getClaims()` — same pattern as existing edge functions
- **Config**: Add `deno.json` with import map for mcp-lite
- **Post generation**: For `generate_post`, call the existing `generate-post` edge function internally (non-streaming) or replicate the AI call logic to return the full result synchronously

## Steps

1. Create `supabase/functions/mcp-server/index.ts` with Hono + mcp-lite setup
2. Implement all tools with Supabase client queries scoped to the authenticated user
3. Handle `generate_post` by making an internal call to the AI gateway (synchronous, non-streaming)
4. Deploy and test the endpoint

## Usage

Users would configure their MCP client (Claude Desktop, Cursor, etc.) with:
```
URL: https://ofpnsqvcagowvaavzzxh.supabase.co/functions/v1/mcp-server
Headers: Authorization: Bearer <user_jwt_token>
```

