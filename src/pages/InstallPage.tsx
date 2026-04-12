import { useState, useEffect } from "react";
import { Share, MoreVertical, Download, Smartphone, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/i18n/LanguageContext";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPage() {
  const { t } = useLanguage();
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
        <h1 className="text-2xl font-bold text-center">{t("install.alreadyInstalled")}</h1>
        <p className="text-muted-foreground text-center">{t("install.alreadyInstalledDesc")}</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <div className="text-center space-y-2">
        <Smartphone className="h-12 w-12 mx-auto text-primary" />
        <h1 className="text-2xl font-bold">{t("install.title")}</h1>
        <p className="text-muted-foreground">{t("install.subtitle")}</p>
      </div>

      {deferredPrompt && (
        <Button onClick={handleInstall} className="w-full" size="lg">
          <Download className="h-5 w-5 mr-2" />
          {t("install.installNow")}
        </Button>
      )}

      {isIOS && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span>🍎</span> {t("install.iosTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Step number={1} icon={<Share className="h-5 w-5" />} html={t("install.iosStep1")} />
            <Step number={2} icon={<span className="text-lg">➕</span>} html={t("install.iosStep2")} />
            <Step number={3} icon={<CheckCircle className="h-5 w-5" />} html={t("install.iosStep3")} />
          </CardContent>
        </Card>
      )}

      {isAndroid && !deferredPrompt && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span>🤖</span> {t("install.androidTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Step number={1} icon={<MoreVertical className="h-5 w-5" />} html={t("install.androidStep1")} />
            <Step number={2} icon={<Download className="h-5 w-5" />} html={t("install.androidStep2")} />
            <Step number={3} icon={<CheckCircle className="h-5 w-5" />} html={t("install.androidStep3")} />
          </CardContent>
        </Card>
      )}

      {!isIOS && !isAndroid && !deferredPrompt && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("install.desktopTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Step number={1} icon={<Download className="h-5 w-5" />} html={t("install.desktopStep1")} />
            <Step number={2} icon={<CheckCircle className="h-5 w-5" />} html={t("install.desktopStep2")} />
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground text-center">{t("install.note")}</p>
    </div>
  );
}

function Step({ number, icon, html }: { number: number; icon: React.ReactNode; html: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
        {number}
      </div>
      <div className="flex items-start gap-2 pt-1">
        <span className="text-muted-foreground shrink-0">{icon}</span>
        <p className="text-sm" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
