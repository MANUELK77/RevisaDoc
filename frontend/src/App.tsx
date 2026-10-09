import { useMemo, useState } from "react";

type Finding = {
  category: string; severity: string; file: string; page?: number | null;
  title: string; suggestion?: string; context?: string;
};
type DocumentInfo = { file: string; pages: number; characters: number };
type ApiResult = {
  documents: DocumentInfo[]; findings: Finding[];
  summary: { documents: number; pages: number; findings: number }; notice: string;
};

const copy = {
  es: {
    tagline: "Revisión inteligente de documentos", language: "Idioma",
    heading: "Revisa tus documentos con más confianza",
    subheading: "Carga tus PDF, ejecuta comprobaciones y revisa los hallazgos antes de corregir el original.",
    upload: "1. Añadir documentos", drop: "Selecciona uno o varios archivos PDF",
    dropHint: "Esta versión envía los archivos a la API local de tu computador.",
    selected: "archivo(s) seleccionado(s)", checks: "Qué revisa esta versión",
    spelling: "Ortografía básica", math: "Operaciones escritas", data: "Formatos de fechas",
    similarity: "Similitud entre PDF", duplicates: "Archivos idénticos", links: "Enlaces repetidos",
    analyze: "Analizar documentos", clear: "Limpiar", report: "2. Informe de hallazgos",
    reportHint: "Los hallazgos son indicios, no una certificación. Comprueba cada resultado en el original.",
    docs: "Documentos", pages: "Páginas", findings: "Hallazgos", export: "Exportar CSV",
    empty: "Tus resultados aparecerán aquí.", ready: "Listo para revisar.",
    processing: "Analizando documentos…", noFiles: "Selecciona al menos un PDF.",
    success: "Análisis terminado.", error: "No se pudo conectar con la API. Comprueba que el backend esté funcionando.",
    category: "Categoría", file: "Archivo", page: "Página", suggestion: "Sugerencia", context: "Fragmento",
    noFindings: "No se encontraron hallazgos con estas comprobaciones.",
    footer: "RevisaDoc · Prototipo de desarrollo · Verifica los resultados antes de tomar decisiones.",
    api: "API local", localOk: "Conectada", localNo: "Sin conexión",
    remove: "Quitar archivos"
  },
  en: {
    tagline: "Smart document review", language: "Language",
    heading: "Review your documents with more confidence",
    subheading: "Upload PDFs, run checks, and review findings before changing the original.",
    upload: "1. Add documents", drop: "Select one or more PDF files",
    dropHint: "This version sends files to the API running on your computer.",
    selected: "file(s) selected", checks: "Checks in this version",
    spelling: "Basic spelling", math: "Written calculations", data: "Date formats",
    similarity: "PDF similarity", duplicates: "Identical files", links: "Repeated links",
    analyze: "Analyze documents", clear: "Clear", report: "2. Findings report",
    reportHint: "Findings are indicators, not certification. Verify each result against the original.",
    docs: "Documents", pages: "Pages", findings: "Findings", export: "Export CSV",
    empty: "Your results will appear here.", ready: "Ready to review.",
    processing: "Analyzing documents…", noFiles: "Select at least one PDF.",
    success: "Analysis complete.", error: "Could not connect to the API. Check that the backend is running.",
    category: "Category", file: "File", page: "Page", suggestion: "Suggestion", context: "Excerpt",
    noFindings: "No findings were detected by these checks.",
    footer: "RevisaDoc · Development prototype · Verify results before making decisions.",
    api: "Local API", localOk: "Connected", localNo: "Offline",
    remove: "Remove files"
  }
};

export default function App() {
  const [language, setLanguage] = useState<"es" | "en">("es");
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [status, setStatus] = useState(copy.es.ready);
  const [busy, setBusy] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const t = copy[language];

  const totalSize = useMemo(() => files.reduce((sum, f) => sum + f.size, 0), [files]);

  async function checkApi() {
    try {
      const response = await fetch("http://127.0.0.1:8000/api/health");
      setApiOnline(response.ok);
    } catch {
      setApiOnline(false);
    }
  }

  async function analyze() {
    if (!files.length) { setStatus(t.noFiles); return; }
    setBusy(true); setResult(null); setStatus(t.processing);
    try {
      const form = new FormData();
      files.forEach(file => form.append("files", file));
      const response = await fetch("http://127.0.0.1:8000/api/analyze", { method: "POST", body: form });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || "API request failed");
      }
      const data = await response.json() as ApiResult;
      setResult(data); setStatus(t.success); setApiOnline(true);
    } catch (error) {
      setStatus(`${t.error}${error instanceof Error ? ` (${error.message})` : ""}`);
      setApiOnline(false);
    } finally { setBusy(false); }
  }

  function exportCsv() {
    if (!result) return;
    const rows = [
      [t.category, t.file, t.page, "Finding", t.suggestion, t.context],
      ...result.findings.map(f => [f.category, f.file, f.page ?? "", f.title, f.suggestion ?? "", f.context ?? ""])
    ];
    const csv = "\ufeff" + rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = "revisadoc-report.csv"; link.click();
    URL.revokeObjectURL(url);
  }

  function reset() { setFiles([]); setResult(null); setStatus(t.ready); }
  const fmtSize = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><div className="brand-mark">R</div><div><h1>RevisaDoc</h1><p>{t.tagline}</p></div></div>
        <div className="top-actions">
          <span className={`api-pill ${apiOnline === true ? "online" : apiOnline === false ? "offline" : ""}`}><i />{t.api}: {apiOnline === true ? t.localOk : apiOnline === false ? t.localNo : "…"}</span>
          <label className="language-select">{t.language}
            <select value={language} onChange={e => { setLanguage(e.target.value as "es" | "en"); setStatus(e.target.value === "es" ? copy.es.ready : copy.en.ready); }}>
              <option value="es">Español</option><option value="en">English</option>
            </select>
          </label>
          <button className="icon-button" onClick={checkApi} title="Check API" aria-label="Check API">↻</button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div><div className="eyebrow">DOCUMENT INTELLIGENCE</div><h2>{t.heading}</h2><p>{t.subheading}</p></div>
          <div className="hero-icon" aria-hidden="true"><span>PDF</span><b>✓</b></div>
        </section>

        <div className="workspace">
          <section className="panel upload-panel">
            <div className="section-title"><span className="step">01</span><div><h3>{t.upload}</h3><p>{t.dropHint}</p></div></div>
            <label className="dropzone">
              <div className="upload-icon">↑</div><strong>{t.drop}</strong>
              <span>PDF · {t.selected}</span>
              <input type="file" accept=".pdf,application/pdf" multiple onChange={e => { setFiles(Array.from(e.target.files ?? [])); setResult(null); }} />
            </label>
            <div className="file-summary"><span>{files.length} {t.selected}</span><span>{fmtSize(totalSize)}</span></div>
            {files.length > 0 && <div className="file-list">{files.map((file, i) => <div className="file-row" key={`${file.name}-${i}`}><span className="pdf-icon">PDF</span><div className="file-name"><strong>{file.name}</strong><small>{fmtSize(file.size)}</small></div><button className="remove-file" aria-label={`Remove ${file.name}`} onClick={() => setFiles(old => old.filter((_, j) => i !== j))}>×</button></div>)}</div>}
            <div className="checks-title">{t.checks}</div>
            <div className="feature-grid">
              <div className="feature"><span className="feature-icon purple">Aa</span><span>{t.spelling}</span></div>
              <div className="feature"><span className="feature-icon blue">∑</span><span>{t.math}</span></div>
              <div className="feature"><span className="feature-icon green">✓</span><span>{t.data}</span></div>
              <div className="feature"><span className="feature-icon amber">≋</span><span>{t.similarity}</span></div>
              <div className="feature"><span className="feature-icon rose">⧉</span><span>{t.duplicates}</span></div>
              <div className="feature"><span className="feature-icon cyan">↗</span><span>{t.links}</span></div>
            </div>
            <div className="button-row"><button className="primary-button" disabled={busy} onClick={analyze}>{busy ? <><span className="spinner" />{t.processing}</> : <>{t.analyze}<span>→</span></>}</button><button className="text-button" onClick={reset}>{t.clear}</button></div>
            <div className={`status-box ${status.includes("Could not") || status.includes("No se pudo") || status.includes("Selecciona") ? "status-error" : ""}`} role="status"><span className="status-dot" />{status}</div>
          </section>

          <section className="panel report-panel">
            <div className="section-title"><span className="step">02</span><div><h3>{t.report}</h3><p>{t.reportHint}</p></div></div>
            <div className="stats">
              <div className="stat-card"><span>{t.docs}</span><strong>{result?.summary.documents ?? 0}</strong><small>PDF</small></div>
              <div className="stat-card"><span>{t.pages}</span><strong>{result?.summary.pages ?? 0}</strong><small>PDF</small></div>
              <div className="stat-card"><span>{t.findings}</span><strong>{result?.summary.findings ?? 0}</strong><small>{language === "es" ? "detectados" : "detected"}</small></div>
            </div>
            {result && <div className="report-toolbar"><span>{result.findings.length ? `${result.findings.length} ${t.findings.toLowerCase()}` : t.noFindings}</span><button className="export-button" onClick={exportCsv} disabled={!result.findings.length}>↓ {t.export}</button></div>}
            <div className="results-list">
              {!result && <div className="empty-state"><div className="empty-art"><div className="paper paper-back" /><div className="paper paper-front"><i /><i /><i /><b>✓</b></div></div><strong>{t.empty}</strong><p>{language === "es" ? "Añade tus PDF y ejecuta el análisis para comenzar." : "Add PDFs and run the analysis to get started."}</p></div>}
              {result?.findings.map((finding, i) => <article className={`finding ${finding.severity}`} key={`${finding.category}-${i}`}><div className="finding-top"><span className={`severity ${finding.severity}`}>{finding.severity}</span><span className="finding-category">{finding.category}</span></div><h4>{finding.title}</h4><div className="finding-file">{finding.file}{finding.page ? ` · ${t.page} ${finding.page}` : ""}</div>{finding.suggestion && <p><b>{t.suggestion}:</b> {finding.suggestion}</p>}{finding.context && <details><summary>{t.context}</summary><blockquote>{finding.context}</blockquote></details>}</article>)}
            </div>
          </section>
        </div>
        <div className="privacy-note"><span>♢</span><p><strong>{language === "es" ? "Nota de privacidad" : "Privacy note"}</strong>{language === "es" ? " Los archivos se envían a la API que se ejecuta en tu propio computador. Esta versión no guarda los PDF de forma permanente. No uses documentos confidenciales hasta revisar la seguridad del sistema." : " Files are sent to the API running on your own computer. This version does not permanently store PDFs. Do not use confidential documents until the system security has been reviewed."}</p></div>
      </main>
      <footer>{t.footer}</footer>
    </div>
  );
}
