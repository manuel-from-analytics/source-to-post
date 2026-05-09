import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State = "validating" | "valid" | "already" | "invalid" | "submitting" | "done" | "error";

export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<State>("validating");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    (async () => {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`, {
          headers: { apikey: SUPABASE_ANON_KEY },
        });
        const data = await r.json();
        if (!r.ok) { setState("invalid"); return; }
        if (data.valid) setState("valid");
        else if (data.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      } catch (e: any) {
        setError(e.message);
        setState("error");
      }
    })();
  }, [token]);

  const confirm = async () => {
    setState("submitting");
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || "Error"); setState("error"); return; }
      setState("done");
    } catch (e: any) {
      setError(e.message);
      setState("error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Cancelar suscripción</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === "validating" && (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Validando…</div>
          )}
          {state === "valid" && (
            <>
              <p className="text-sm text-muted-foreground">¿Quieres dejar de recibir emails de Postflow en esta dirección?</p>
              <Button onClick={confirm} className="w-full">Confirmar baja</Button>
            </>
          )}
          {state === "submitting" && (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Procesando…</div>
          )}
          {state === "done" && <p className="text-sm">Listo. Ya no recibirás más emails en esta dirección.</p>}
          {state === "already" && <p className="text-sm">Esta dirección ya estaba dada de baja.</p>}
          {state === "invalid" && <p className="text-sm text-destructive">Enlace inválido o caducado.</p>}
          {state === "error" && <p className="text-sm text-destructive">{error || "Ocurrió un error."}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
