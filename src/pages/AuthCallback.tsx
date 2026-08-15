import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

function safeStoredNext(): string {
  try {
    const value = sessionStorage.getItem("postflow:next");
    if (value?.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")) {
      return value;
    }
  } catch {
    // Storage can be unavailable in private browsing contexts.
  }
  return "/dashboard";
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    const finish = async (): Promise<boolean> => {
      const { data, error } = await supabase.auth.getUser();
      if (!active || error || !data.user) return false;

      const next = safeStoredNext();
      try {
        sessionStorage.removeItem("postflow:next");
      } catch {
        // Ignore storage cleanup failures.
      }
      window.history.replaceState(null, "", "/auth/callback");
      navigate(next, { replace: true });
      return true;
    };

    const establishCallbackSession = async (): Promise<boolean> => {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const query = new URLSearchParams(window.location.search);
      const accessToken = hash.get("access_token") ?? query.get("access_token");
      const refreshToken = hash.get("refresh_token") ?? query.get("refresh_token");

      // A full-page Lovable OAuth flow returns the tokens to this public route.
      // Persist them explicitly instead of relying on the auth client's async
      // URL auto-detection, which can race with route protection on mobile.
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) return false;
      } else {
        const code = query.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) return false;
        }
      }

      return finish();
    };

    const waitForValidatedSession = async () => {
      const deadline = Date.now() + 15_000;
      while (active && Date.now() < deadline) {
        if (await establishCallbackSession()) return;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      if (active) setFailed(true);
    };

    void waitForValidatedSession();

    return () => {
      active = false;
    };
  }, [navigate]);

  if (failed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-xl font-semibold">No se pudo confirmar la sesión</h1>
          <p className="text-sm text-muted-foreground">
            Vuelve a iniciar sesión para completar el acceso.
          </p>
          <Button className="w-full" onClick={() => navigate("/login", { replace: true })}>
            Volver al inicio de sesión
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background" aria-label="Confirmando sesión">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
    </main>
  );
}