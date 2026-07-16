import { auth, defineMcp } from "@lovable.dev/mcp-js";

import listInputs from "./tools/list-inputs";
import getInput from "./tools/get-input";
import createInput from "./tools/create-input";
import deleteInput from "./tools/delete-input";
import listPosts from "./tools/list-posts";
import getPost from "./tools/get-post";
import generatePost from "./tools/generate-post";
import savePost from "./tools/save-post";
import updatePost from "./tools/update-post";
import deletePost from "./tools/delete-post";
import listVoices from "./tools/list-voices";
import getUserDefaults from "./tools/get-user-defaults";
import listNewsletters from "./tools/list-newsletters";
import getNewsletter from "./tools/get-newsletter";
import listNewsletterItems from "./tools/list-newsletter-items";
import generateNewsletter from "./tools/generate-newsletter";
import importNewsletterItem from "./tools/import-newsletter-item";
import generatePostsFromNewsletter from "./tools/generate-posts-from-newsletter";
import notifyReview from "./tools/notify-review";
import logAgentRun from "./tools/log-agent-run";

// The OAuth issuer MUST be the direct Supabase host. Read the project ref
// from a Vite-inlined literal so it stays import-safe (no runtime env read).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "postflow",
  title: "PostFlow",
  version: "1.0.0",
  instructions:
    "PostFlow tools to manage your LinkedIn content library, generate posts, curate newsletters, and log agent runs. Every tool acts on behalf of the signed-in user and respects row-level security. Use `list_inputs` / `list_posts` to discover state, `generate_post` (with `save: true`) to draft new posts, and `generate_posts_from_newsletter` for atomic newsletter-to-drafts runs.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    getUserDefaults,
    listInputs,
    getInput,
    createInput,
    deleteInput,
    listPosts,
    getPost,
    generatePost,
    savePost,
    updatePost,
    deletePost,
    listVoices,
    listNewsletters,
    getNewsletter,
    listNewsletterItems,
    generateNewsletter,
    importNewsletterItem,
    generatePostsFromNewsletter,
    notifyReview,
    logAgentRun,
  ],
});
