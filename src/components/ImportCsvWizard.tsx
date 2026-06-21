import { useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Building2, User as UserIcon, Upload, FileText, CheckCircle2, ArrowLeft, ArrowRight, Loader2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useImportLinkedinCsv } from "@/hooks/useLinkedinMetrics";
import type { LinkedInSource } from "@/lib/linkedin-csv";

type Step = 1 | 2 | 3 | 4;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ImportCsvWizard({ open, onOpenChange }: Props) {
  const importMut = useImportLinkedinCsv();
  const [step, setStep] = useState<Step>(1);
  const [source, setSource] = useState<LinkedInSource>("personal");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ total: number; matched: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep(1);
    setSource("personal");
    setFile(null);
    setResult(null);
  }

  function handleClose(v: boolean) {
    if (!v) setTimeout(reset, 200);
    onOpenChange(v);
  }

  async function runImport() {
    if (!file) return;
    try {
      const res = await importMut.mutateAsync({ file, source });
      setResult(res);
      setStep(4);
    } catch {
      // toast handled in hook
    }
  }

  const exportUrl = source === "company"
    ? "https://www.linkedin.com/company/"
    : "https://www.linkedin.com/analytics/creator/content/";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar CSV de LinkedIn</DialogTitle>
          <DialogDescription>Paso {step} de 4</DialogDescription>
        </DialogHeader>

        <Stepper step={step} />

        <div className="py-2 min-h-[220px]">
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                ¿Estas métricas son de tu cuenta personal o de una página de empresa? Esto se usa para etiquetar los posts importados.
              </p>
              <RadioGroup value={source} onValueChange={(v) => setSource(v as LinkedInSource)} className="gap-2">
                <SourceCard value="personal" current={source} icon={<UserIcon className="h-5 w-5" />}
                  title="Cuenta personal" desc="Posts publicados desde tu perfil." />
                <SourceCard value="company" current={source} icon={<Building2 className="h-5 w-5" />}
                  title="Página de empresa" desc="Posts publicados desde una company page." />
              </RadioGroup>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3 text-sm">
              <p className="font-medium">Cómo descargar el CSV en LinkedIn:</p>
              {source === "personal" ? (
                <ol className="list-decimal pl-5 space-y-1.5 text-muted-foreground">
                  <li>Abre LinkedIn y ve a <strong>Yo → Ver perfil</strong>.</li>
                  <li>En el panel de analítica, pulsa <strong>Mostrar todos los análisis</strong>.</li>
                  <li>Entra en <strong>Publicaciones</strong> y elige el rango de fechas.</li>
                  <li>Pulsa <strong>Exportar</strong> y descarga el archivo XLSX/CSV.</li>
                </ol>
              ) : (
                <ol className="list-decimal pl-5 space-y-1.5 text-muted-foreground">
                  <li>Abre tu <strong>página de empresa</strong> como administrador.</li>
                  <li>Ve a <strong>Analítica → Contenido</strong>.</li>
                  <li>Selecciona el rango de fechas que quieras analizar.</li>
                  <li>Pulsa <strong>Exportar</strong> y descarga el archivo.</li>
                </ol>
              )}
              <a href={exportUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                Abrir LinkedIn Analytics <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <p className="text-xs text-muted-foreground pt-2">
                Si descargas un .xlsx, ábrelo y guárdalo como CSV antes de subirlo.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Sube el archivo CSV. Detectaremos impresiones, reacciones, comentarios, compartidos y clics.
              </p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "w-full border-2 border-dashed rounded-lg p-6 text-center transition-colors",
                  file ? "border-primary/50 bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
                )}
              >
                {file ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="font-medium">{file.name}</span>
                    <span className="text-muted-foreground">({(file.size / 1024).toFixed(0)} KB)</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm font-medium">Haz clic para seleccionar un CSV</p>
                    <p className="text-xs text-muted-foreground">o arrástralo aquí</p>
                  </div>
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setFile(f);
                }}
              />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {source === "personal" ? <UserIcon className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
                <span>Se etiquetará como <strong>{source === "personal" ? "Personal" : "Empresa"}</strong>.</span>
              </div>
            </div>
          )}

          {step === 4 && result && (
            <div className="text-center space-y-3 py-6">
              <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
              <p className="font-medium">¡Importación completa!</p>
              <p className="text-sm text-muted-foreground">
                <strong>{result.total}</strong> filas importadas como{" "}
                <strong>{source === "personal" ? "Personal" : "Empresa"}</strong>.<br />
                <strong>{result.matched}</strong> cruzadas con tus posts generados.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {step > 1 && step < 4 && (
            <Button variant="outline" onClick={() => setStep((s) => (s - 1) as Step)} disabled={importMut.isPending}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Atrás
            </Button>
          )}
          {step < 3 && (
            <Button onClick={() => setStep((s) => (s + 1) as Step)}>
              Siguiente <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 3 && (
            <Button onClick={runImport} disabled={!file || importMut.isPending}>
              {importMut.isPending ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Importando…</>
              ) : (
                <><Upload className="h-4 w-4 mr-1" /> Importar</>
              )}
            </Button>
          )}
          {step === 4 && (
            <Button onClick={() => handleClose(false)}>Hecho</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stepper({ step }: { step: Step }) {
  const labels = ["Origen", "Descarga", "Subida", "Listo"];
  return (
    <div className="flex items-center gap-1.5 px-1">
      {labels.map((label, i) => {
        const n = (i + 1) as Step;
        const active = n === step;
        const done = n < step;
        return (
          <div key={label} className="flex items-center gap-1.5 flex-1">
            <div className={cn(
              "h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0",
              done && "bg-primary text-primary-foreground",
              active && "bg-primary/20 text-primary border-2 border-primary",
              !done && !active && "bg-muted text-muted-foreground",
            )}>
              {done ? <CheckCircle2 className="h-4 w-4" /> : n}
            </div>
            <span className={cn("text-xs hidden sm:inline", active ? "font-medium" : "text-muted-foreground")}>
              {label}
            </span>
            {i < labels.length - 1 && <div className={cn("h-px flex-1 mx-1", done ? "bg-primary" : "bg-border")} />}
          </div>
        );
      })}
    </div>
  );
}

function SourceCard({
  value, current, icon, title, desc,
}: { value: LinkedInSource; current: LinkedInSource; icon: React.ReactNode; title: string; desc: string }) {
  const selected = value === current;
  return (
    <Label
      htmlFor={`src-${value}`}
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
        selected ? "border-primary bg-primary/5" : "hover:border-muted-foreground/40",
      )}
    >
      <RadioGroupItem value={value} id={`src-${value}`} className="mt-1" />
      <div className={cn("h-9 w-9 rounded-md flex items-center justify-center shrink-0",
        selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </Label>
  );
}
