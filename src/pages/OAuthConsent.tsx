import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles } from "lucide-react";

// Local typed wrapper for the beta supabase.auth.oauth namespace.
type AuthDetails = {
  client?: { name?: string; client_uri?: string; logo_uri?: string };
  redirect_url?: string;
  redirect_to?: string;
  scope?: string;
};
type SupabaseOAuth = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthDetails | null; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: any }>;
};
const authOAuth = (supabase.auth as unknown as { oauth: SupabaseOAuth }).oauth;

export default function OAuthConsentPage() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Missing authorization_id");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        // Preserve the FULL consent URL so auth returns here.
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      try {
        const { data, error } = await authOAuth.getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (error) return setError(error.message || String(error));
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setDetails(data);
      } catch (e: any) {
        setError(e?.message || String(e));
      }
    })();
    return () => { active = false; };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    try {
      const { data, error } = approve
        ? await authOAuth.approveAuthorization(authorizationId)
        : await authOAuth.denyAuthorization(authorizationId);
      if (error) { setError(error.message || String(error)); return; }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) { setError("No redirect returned by the authorization server."); return; }
      window.location.href = target;
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authorization error</CardTitle>
            <CardDescription>We couldn't load this authorization request.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground break-words">{error}</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  const clientName = details.client?.name || "an external app";
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Connect {clientName} to PostFlow
          </CardTitle>
          <CardDescription>
            This lets <span className="font-medium">{clientName}</span> read and manage
            your PostFlow content on your behalf. It will only see data your account can access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {details.client?.client_uri && (
            <p className="text-xs text-muted-foreground break-all">
              App URL: {details.client.client_uri}
            </p>
          )}
          <div className="flex flex-col gap-2 pt-2">
            <Button disabled={busy} onClick={() => decide(true)}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => decide(false)}>
              Deny
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
