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
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const finish = async () => {
      // getUser validates the persisted OAuth session with the auth server. Do
      // not enter a protected route based only on a locally cached session.
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") {
        void finish();
      }
    });

    const waitForValidatedSession = async () => {
      const deadline = Date.now() + 15_000;
      while (active && Date.now() < deadline) {
        if (await finish()) return;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      if (active) setFailed(true);
    };

    // Let the auth client consume the provider callback before the first check.
    timeoutId = setTimeout(() => void waitForValidatedSession(), 0);

    return () => {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
      subscription.unsubscribe();
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