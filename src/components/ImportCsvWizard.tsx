import { useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Building2, User as UserIcon, Upload, FileText, CheckCircle2, ArrowLeft, ArrowRight,
  Loader2, ExternalLink, AlertTriangle, AlertCircle, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useImportLinkedinCsv } from "@/hooks/useLinkedinMetrics";
import { analyzeLinkedInFile, CsvValidationError, type CsvAnalysis, type LinkedInSource } from "@/lib/linkedin-csv";
import { useLanguage } from "@/i18n/LanguageContext";

type Step = 1 | 2 | 3 | 4;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ImportCsvWizard({ open, onOpenChange }: Props) {
  const { t } = useLanguage();
  const importMut = useImportLinkedinCsv();
  const [step, setStep] = useState<Step>(1);
  const [source, setSource] = useState<LinkedInSource>("personal");
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<CsvAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedSheet, setSelectedSheet] = useState<string | undefined>(undefined);
  const [validationError, setValidationError] = useState<{ message: string; analysis?: CsvAnalysis } | null>(null);
  const [result, setResult] = useState<{ total: number; matched: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep(1);
    setSource("personal");
    setFile(null);
    setAnalysis(null);
    setSelectedSheet(undefined);
    setValidationError(null);
    setResult(null);
  }

  function handleClose(v: boolean) {
    if (!v) setTimeout(reset, 200);
    onOpenChange(v);
  }

  async function analyzeFile(f: File, sheet?: string) {
    setAnalyzing(true);
    setValidationError(null);
    try {
      const a = await analyzeLinkedInFile(f, sheet);
      setAnalysis(a);
      setSelectedSheet(a.sheetName);
      if (a.sourceHint && a.sourceHint !== source) setSource(a.sourceHint);
    } catch (e) {
      setAnalysis(null);
      if (e instanceof CsvValidationError) {
        setValidationError({ message: e.message, analysis: e.analysis });
        if (e.analysis?.sheetName) setSelectedSheet(e.analysis.sheetName);
      } else {
        setValidationError({ message: e instanceof Error ? e.message : t("import.readError") });
      }
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleFileSelected(f: File) {
    setFile(f);
    setAnalysis(null);
    setSelectedSheet(undefined);
    await analyzeFile(f);
  }

  async function handleSheetChange(sheet: string) {
    if (!file) return;
    setSelectedSheet(sheet);
    await analyzeFile(file, sheet);
  }

  async function runImport() {
    if (!file || !analysis) return;
    try {
      const res = await importMut.mutateAsync({ file, source, sheetName: selectedSheet });
      setResult(res);
      setStep(4);
    } catch {
      // toast handled in hook
    }
  }

  const exportUrl = source === "company"
    ? "https://www.linkedin.com/company/"
    : "https://www.linkedin.com/analytics/creator/content/";

  const sourceLabel = source === "personal" ? t("import.personal") : t("import.company");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("import.title")}</DialogTitle>
          <DialogDescription>{t("import.stepOf").replace("{n}", String(step))}</DialogDescription>
        </DialogHeader>

        <Stepper step={step} t={t} />

        <div className="py-2 flex-1 overflow-y-auto -mx-1 px-1">

          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t("import.step1.q")}</p>
              <RadioGroup value={source} onValueChange={(v) => setSource(v as LinkedInSource)} className="gap-2">
                <SourceCard value="personal" current={source} icon={<UserIcon className="h-5 w-5" />}
                  title={t("import.step1.personal")} desc={t("import.step1.personalDesc")} />
                <SourceCard value="company" current={source} icon={<Building2 className="h-5 w-5" />}
                  title={t("import.step1.company")} desc={t("import.step1.companyDesc")} />
              </RadioGroup>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3 text-sm">
              <p className="font-medium">{t("import.step2.how")}</p>
              {source === "personal" ? (
                <ol className="list-decimal pl-5 space-y-1.5 text-muted-foreground">
                  <li dangerouslySetInnerHTML={{ __html: t("import.step2.personal1") }} />
                  <li dangerouslySetInnerHTML={{ __html: t("import.step2.personal2") }} />
                  <li dangerouslySetInnerHTML={{ __html: t("import.step2.personal3") }} />
                  <li dangerouslySetInnerHTML={{ __html: t("import.step2.personal4") }} />
                </ol>
              ) : (
                <ol className="list-decimal pl-5 space-y-1.5 text-muted-foreground">
                  <li dangerouslySetInnerHTML={{ __html: t("import.step2.company1") }} />
                  <li dangerouslySetInnerHTML={{ __html: t("import.step2.company2") }} />
                  <li dangerouslySetInnerHTML={{ __html: t("import.step2.company3") }} />
                  <li dangerouslySetInnerHTML={{ __html: t("import.step2.company4") }} />
                </ol>
              )}
              <a href={exportUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                {t("import.step2.open")} <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <p className="text-xs text-muted-foreground pt-2"
                 dangerouslySetInnerHTML={{ __html: t("import.step2.formats") }} />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t("import.step3.intro")}</p>
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
                    <p className="text-sm font-medium">{t("import.step3.dropzone")}</p>
                    <p className="text-xs text-muted-foreground">.csv, .xls o .xlsx</p>
                  </div>
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.tsv,.txt,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelected(f);
                  e.target.value = "";
                }}
              />

              {analyzing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t("import.step3.analyzing")}
                </div>
              )}

              {file && !analyzing && (analysis?.availableSheets?.length ?? validationError?.analysis?.availableSheets?.length ?? 0) > 1 && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t("import.step3.sheet")}</Label>
                  <Select value={selectedSheet} onValueChange={handleSheetChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("import.step3.sheetPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {(analysis?.availableSheets ?? validationError?.analysis?.availableSheets ?? []).map((s) => (
                        <SelectItem key={s.name} value={s.name}>
                          <span className="flex items-center gap-2">
                            <span className="font-medium">{s.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {s.recordCount} {t("import.step3.rows")}{s.isAutoSelected ? ` · ${t("import.step3.suggested")}` : ""}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {validationError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{t("import.step3.cantImport")}</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p className="text-sm">{validationError.message}</p>
                    {validationError.analysis && validationError.analysis.headers.length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer">{t("import.step3.viewColumns")}</summary>
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
                    <span className="text-muted-foreground">· {analysis.rowCount} {t("import.step3.rows")}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <DetectedField label={t("import.step3.fImpressions")} value={analysis.detected.impressions} required />
                    <DetectedField label={t("import.step3.fReactions")} value={analysis.detected.reactions} />
                    <DetectedField label={t("import.step3.fComments")} value={analysis.detected.comments} />
                    <DetectedField label={t("import.step3.fShares")} value={analysis.detected.shares} />
                    <DetectedField label={t("import.step3.fClicks")} value={analysis.detected.clicks} />
                    <DetectedField label={t("import.step3.fDate")} value={analysis.detected.date} />
                    <DetectedField label={t("import.step3.fUrl")} value={analysis.detected.url} />
                    <DetectedField label={t("import.step3.fText")} value={analysis.detected.excerpt} />
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
                      {t("import.step3.suggestChange")} <strong>{analysis.sourceHint === "personal" ? t("import.personal") : t("import.company")}</strong>.
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {source === "personal" ? <UserIcon className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
                <span>{t("import.step3.willTag")} <strong>{sourceLabel}</strong>.</span>
              </div>
            </div>
          )}


          {step === 4 && result && (
            <div className="text-center space-y-3 py-6">
              <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
              <p className="font-medium">{t("import.step4.done")}</p>
              <p className="text-sm text-muted-foreground"
                 dangerouslySetInnerHTML={{
                   __html: t("import.step4.summary")
                     .replace("{total}", String(result.total))
                     .replace("{label}", sourceLabel)
                     .replace("{matched}", String(result.matched)),
                 }} />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {step > 1 && step < 4 && (
            <Button variant="outline" onClick={() => setStep((s) => (s - 1) as Step)} disabled={importMut.isPending}>
              <ArrowLeft className="h-4 w-4 mr-1" /> {t("import.back")}
            </Button>
          )}
          {step < 3 && (
            <Button onClick={() => setStep((s) => (s + 1) as Step)}>
              {t("import.next")} <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 3 && (
            <Button onClick={runImport} disabled={!file || !analysis || analyzing || importMut.isPending}>
              {importMut.isPending ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> {t("import.importing")}</>
              ) : (
                <><Upload className="h-4 w-4 mr-1" /> {t("import.do")}</>
              )}
            </Button>
          )}
          {step === 4 && (
            <Button onClick={() => handleClose(false)}>{t("import.finish")}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stepper({ step, t }: { step: Step; t: (k: string) => string }) {
  const labels = [t("import.stepper.source"), t("import.stepper.download"), t("import.stepper.upload"), t("import.stepper.ready")];
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

function DetectedField({ label, value, required }: { label: string; value: string | null; required?: boolean }) {
  const found = !!value;
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className={cn(
        "h-1.5 w-1.5 rounded-full shrink-0",
        found ? "bg-primary" : required ? "bg-destructive" : "bg-muted-foreground/40",
      )} />
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className={cn("truncate", found ? "font-medium" : "text-muted-foreground/60 italic")}>
        {value ?? "—"}
      </span>
    </div>
  );
}
