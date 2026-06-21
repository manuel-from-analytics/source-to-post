import { useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Building2, User as UserIcon, Upload, FileText, CheckCircle2, ArrowLeft, ArrowRight,
  Loader2, ExternalLink, AlertTriangle, AlertCircle, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useImportLinkedinCsv } from "@/hooks/useLinkedinMetrics";
import { analyzeLinkedInCsv, CsvValidationError, type CsvAnalysis, type LinkedInSource } from "@/lib/linkedin-csv";

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
  const [analysis, setAnalysis] = useState<CsvAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [validationError, setValidationError] = useState<{ message: string; analysis?: CsvAnalysis } | null>(null);
  const [result, setResult] = useState<{ total: number; matched: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep(1);
    setSource("personal");
    setFile(null);
    setAnalysis(null);
    setValidationError(null);
    setResult(null);
  }

  function handleClose(v: boolean) {
    if (!v) setTimeout(reset, 200);
    onOpenChange(v);
  }

  async function handleFileSelected(f: File) {
    setFile(f);
    setAnalysis(null);
    setValidationError(null);
    setAnalyzing(true);
    try {
      const a = await analyzeLinkedInCsv(f);
      setAnalysis(a);
      if (a.sourceHint && a.sourceHint !== source) setSource(a.sourceHint);
    } catch (e) {
      if (e instanceof CsvValidationError) {
        setValidationError({ message: e.message, analysis: e.analysis });
      } else {
        setValidationError({ message: e instanceof Error ? e.message : "Error al leer el archivo" });
      }
    } finally {
      setAnalyzing(false);
    }
  }

  async function runImport() {
    if (!file || !analysis) return;
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
                Sube el CSV. Detectaremos automáticamente el formato y validaremos las columnas.
              </p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "w-full border-2 border-dashed rounded-lg p-5 text-center transition-colors",
                  validationError ? "border-destructive/50 bg-destructive/5"
                    : file ? "border-primary/50 bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50",
                )}
              >
                {file ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <FileText className="h-5 w-5 text-primary shrink-0" />
                    <span className="font-medium truncate">{file.name}</span>
                    <span className="text-muted-foreground shrink-0">({(file.size / 1024).toFixed(0)} KB)</span>
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
                accept=".csv,.tsv,.txt,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelected(f);
                  e.target.value = "";
                }}
              />

              {analyzing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Analizando archivo…
                </div>
              )}

              {validationError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No podemos importar este archivo</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p className="text-sm">{validationError.message}</p>
                    {validationError.analysis && validationError.analysis.headers.length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer">Ver columnas detectadas</summary>
                        <p className="mt-1 font-mono break-all">
                          {validationError.analysis.headers.join(" · ")}
                        </p>
                      </details>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {analysis && !validationError && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="font-medium">{analysis.formatLabel}</span>
                    <span className="text-muted-foreground">· {analysis.rowCount} filas</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <DetectedField label="Impresiones" value={analysis.detected.impressions} required />
                    <DetectedField label="Reacciones" value={analysis.detected.reactions} />
                    <DetectedField label="Comentarios" value={analysis.detected.comments} />
                    <DetectedField label="Compartidos" value={analysis.detected.shares} />
                    <DetectedField label="Clics" value={analysis.detected.clicks} />
                    <DetectedField label="Fecha" value={analysis.detected.date} />
                    <DetectedField label="URL" value={analysis.detected.url} />
                    <DetectedField label="Texto" value={analysis.detected.excerpt} />
                  </div>
                  {analysis.warnings.length > 0 && (
                    <div className="space-y-1 pt-1 border-t">
                      {analysis.warnings.map((w, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {analysis.sourceHint && analysis.sourceHint !== source && (
                    <p className="text-xs text-muted-foreground">
                      Sugerimos cambiar el origen a <strong>{analysis.sourceHint === "personal" ? "Personal" : "Empresa"}</strong> según el nombre del archivo.
                    </p>
                  )}
                </div>
              )}

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
            <Button onClick={runImport} disabled={!file || !analysis || analyzing || importMut.isPending}>
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
