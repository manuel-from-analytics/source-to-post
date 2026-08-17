import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { completeAuthTrace, recordAuthCheckpoint } from "@/lib/auth-diagnostics";
import { clearStoredAuthDestination, readStoredAuthDestination } from "@/lib/auth-navigation";

function readCallbackParameters() {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const value = (key: string) => search.get(key) ?? hash.get(key);

  return {
    accessToken: value("access_token"),
    refreshToken: value("refresh_token"),
    code: value("code"),
    error: value("error_description") ?? value("error"),
  };
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const { confirmSession } = useAuth();
  const started = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const restoreSession = async () => {
      const callback = readCallbackParameters();
      if (callback.error) {
        recordAuthCheckpoint("oauth_response_failed", "provider_callback_error");
        setFailed(true);
        return;
      }

      if (callback.accessToken && callback.refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: callback.accessToken,
          refresh_token: callback.refreshToken,
        });
        if (error) {
          recordAuthCheckpoint("oauth_response_failed", "callback_session_rejected");
          setFailed(true);
          return;
        }
      } else if (callback.code) {
        // The auth client may already have consumed the PKCE code while the
        // application bundle initialized. Only exchange it when that automatic
        // restoration did not produce a session.
        const { data: existing } = await supabase.auth.getSession();
        if (!existing.session) {
          const { error } = await supabase.auth.exchangeCodeForSession(callback.code);
          if (error) {
            recordAuthCheckpoint("oauth_response_failed", "callback_code_rejected");
            setFailed(true);
            return;
          }
        }
      }

      recordAuthCheckpoint("oauth_response_received", "callback");
      if (!(await confirmSession())) {
        recordAuthCheckpoint("oauth_response_failed", "callback_session_missing");
        setFailed(true);
        return;
      }

      const destination = readStoredAuthDestination();
      clearStoredAuthDestination();
      completeAuthTrace();
      navigate(destination, { replace: true });
    };

    void restoreSession();
  }, [confirmSession, navigate]);

  if (failed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
        <div className="space-y-3">
          <p className="font-medium text-destructive">No se pudo confirmar la sesión.</p>
          <a className="text-sm text-primary hover:underline" href="/login">Volver a iniciar sesión</a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background" aria-live="polite">
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Confirmando sesión" />
    </div>
  );
}