import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { completeAuthTrace, recordAuthCheckpoint } from "@/lib/auth-diagnostics";
import { clearStoredAuthDestination, readStoredAuthDestination } from "@/lib/auth-navigation";

const SESSION_WAIT_ATTEMPTS = 50;
const SESSION_WAIT_MS = 300;

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
      }

      recordAuthCheckpoint("oauth_response_received", "callback");

      // The generated auth client has detectSessionInUrl enabled and owns the
      // one-time PKCE code exchange. On mobile Safari that async exchange can
      // finish several moments after this route mounts. Never exchange the same
      // code here: doing so races the client and can consume it twice.
      let restored = false;
      for (let attempt = 0; attempt < SESSION_WAIT_ATTEMPTS; attempt += 1) {
        const { data, error } = await supabase.auth.getSession();
        if (!error && data.session) {
          restored = true;
          break;
        }
        if (attempt < SESSION_WAIT_ATTEMPTS - 1) {
          await new Promise((resolve) => window.setTimeout(resolve, SESSION_WAIT_MS));
        }
      }

      if (!restored) {
        recordAuthCheckpoint(
          "oauth_response_failed",
          callback.code ? "callback_code_not_hydrated" : "callback_session_missing",
        );
        setFailed(true);
        return;
      }

      if (!(await confirmSession())) {
        recordAuthCheckpoint("oauth_response_failed", "callback_session_invalid");
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