import { useState, useEffect } from "react";
import { Share, MoreVertical, Download, Smartphone, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  if (isInstalled) {
    return (
      <div className="p-6 max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <CheckCircle className="h-16 w-16 text-primary" />
        <h1 className="text-2xl font-bold text-center">¡PostFlow ya está instalada!</h1>
        <p className="text-muted-foreground text-center">
          Busca el icono de PostFlow en tu pantalla de inicio para abrirla.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <div className="text-center space-y-2">
        <Smartphone className="h-12 w-12 mx-auto text-primary" />
        <h1 className="text-2xl font-bold">Instalar PostFlow</h1>
        <p className="text-muted-foreground">
          Añade PostFlow a tu pantalla de inicio para acceder como una app nativa.
        </p>
      </div>

      {deferredPrompt && (
        <Button onClick={handleInstall} className="w-full" size="lg">
          <Download className="h-5 w-5 mr-2" />
          Instalar ahora
        </Button>
      )}

      {isIOS && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span>🍎</span> En iPhone / iPad (Safari)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Step number={1} icon={<Share className="h-5 w-5" />}>
              Pulsa el botón <strong>Compartir</strong> (el cuadrado con la flecha hacia arriba) en la barra inferior de Safari.
            </Step>
            <Step number={2} icon={<span className="text-lg">➕</span>}>
              Desplázate y selecciona <strong>"Añadir a pantalla de inicio"</strong>.
            </Step>
            <Step number={3} icon={<CheckCircle className="h-5 w-5" />}>
              Confirma pulsando <strong>"Añadir"</strong>. ¡Listo!
            </Step>
          </CardContent>
        </Card>
      )}

      {isAndroid && !deferredPrompt && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span>🤖</span> En Android (Chrome)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Step number={1} icon={<MoreVertical className="h-5 w-5" />}>
              Pulsa el menú <strong>⋮</strong> (tres puntos) en la esquina superior derecha de Chrome.
            </Step>
            <Step number={2} icon={<Download className="h-5 w-5" />}>
              Selecciona <strong>"Instalar aplicación"</strong> o <strong>"Añadir a pantalla de inicio"</strong>.
            </Step>
            <Step number={3} icon={<CheckCircle className="h-5 w-5" />}>
              Confirma la instalación. ¡Listo!
            </Step>
          </CardContent>
        </Card>
      )}

      {!isIOS && !isAndroid && !deferredPrompt && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">En escritorio (Chrome / Edge)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Step number={1} icon={<Download className="h-5 w-5" />}>
              Busca el icono de instalación <strong>⊕</strong> en la barra de direcciones del navegador.
            </Step>
            <Step number={2} icon={<CheckCircle className="h-5 w-5" />}>
              Haz clic en <strong>"Instalar"</strong>. ¡Listo!
            </Step>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Nota: La instalación solo funciona en la versión publicada de la app, no en el preview del editor.
      </p>
    </div>
  );
}

function Step({ number, icon, children }: { number: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
        {number}
      </div>
      <div className="flex items-start gap-2 pt-1">
        <span className="text-muted-foreground shrink-0">{icon}</span>
        <p className="text-sm">{children}</p>
      </div>
    </div>
  );
}
