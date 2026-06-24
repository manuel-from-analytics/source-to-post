// Shared helper to publish a text post to LinkedIn (personal profile)
// using the linked Lovable connector gateway.

const GATEWAY = "https://connector-gateway.lovable.dev/linkedin";

export interface PublishResult {
  ok: boolean;
  linkedin_url?: string;
  urn?: string;
  error?: string;
  status?: number;
}

export async function publishTextToLinkedIn(content: string): Promise<PublishResult> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const liKey = Deno.env.get("LINKEDIN_API_KEY");
  if (!lovableKey) return { ok: false, error: "LOVABLE_API_KEY not configured" };
  if (!liKey) return { ok: false, error: "LINKEDIN_API_KEY not configured (LinkedIn connector not linked)" };

  const headers = {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": liKey,
    "Content-Type": "application/json",
    "X-Restli-Protocol-Version": "2.0.0",
  };

  // 1) Author URN
  const userinfoRes = await fetch(`${GATEWAY}/v2/userinfo`, { headers });
  if (!userinfoRes.ok) {
    const txt = await userinfoRes.text();
    return { ok: false, status: userinfoRes.status, error: `userinfo failed: ${txt}` };
  }
  const userinfo = await userinfoRes.json();
  const sub = userinfo?.sub;
  if (!sub) return { ok: false, error: "no sub in userinfo response" };

  // 2) Publish
  const body = {
    author: `urn:li:person:${sub}`,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: content },
        shareMediaCategory: "NONE",
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };
  const postRes = await fetch(`${GATEWAY}/v2/ugcPosts`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!postRes.ok) {
    const txt = await postRes.text();
    return { ok: false, status: postRes.status, error: `ugcPosts failed: ${txt}` };
  }
  const data = await postRes.json().catch(() => ({}));
  const urn: string | undefined =
    data?.id ?? postRes.headers.get("x-restli-id") ?? undefined;
  if (!urn) return { ok: false, error: "no URN in ugcPosts response" };

  const activityId = urn.includes(":") ? urn.split(":").pop() : urn;
  const feedUrn = urn.startsWith("urn:li:share:")
    ? urn.replace("urn:li:share:", "urn:li:activity:")
    : urn.startsWith("urn:li:ugcPost:")
    ? `urn:li:activity:${activityId}`
    : urn;
  const linkedin_url = `https://www.linkedin.com/feed/update/${feedUrn}/`;

  return { ok: true, urn, linkedin_url };
}
