import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, getAuthHeaders } from "@/lib/api";
import toast from "react-hot-toast";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface PreviewData {
  filename: string;
  totalRows: number;
  columns: string[];
  preview: Record<string, string>[];
}

export default function ImportModal({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const systemFields = [
    { key: "first_name", label: "Primeiro Nome" },
    { key: "phone", label: "Número" },
    { key: "organization", label: "Empresa" },
    { key: "city_state", label: "Cidade/Estado" },
    { key: "city", label: "Cidade (separado)" },
    { key: "state", label: "Estado (separado)" },
  ];

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const headers = await getAuthHeaders(false);
      const res = await fetch("/api/import/upload", {
        method: "POST",
        headers,
        body: formData,
      });

      const text = await res.text();
      const data: PreviewData = text ? JSON.parse(text) : {};

      if (!res.ok) throw new Error((data as unknown as { error: string }).error || "Erro no upload");

      setPreview(data);

      // Auto-map columns by name similarity
      const autoMap: Record<string, string> = {};
      const colLower = data.columns.map((c) => c.toLowerCase());
      if (colLower.some((c) => c.includes("primeiro"))) autoMap.first_name = data.columns[colLower.findIndex((c) => c.includes("primeiro"))];
      if (colLower.some((c) => c.includes("completo") || c.includes("nome"))) {
        const idx = colLower.findIndex((c) => c.includes("completo"));
        if (idx >= 0 && !autoMap.first_name) autoMap.first_name = data.columns[idx];
      }
      if (colLower.some((c) => c.includes("número") || c.includes("numero") || c.includes("phone") || c.includes("telefone"))) {
        autoMap.phone = data.columns[colLower.findIndex((c) => c.includes("número") || c.includes("numero") || c.includes("phone") || c.includes("telefone"))];
      }
      if (colLower.some((c) => c.includes("empresa") || c.includes("organization"))) {
        autoMap.organization = data.columns[colLower.findIndex((c) => c.includes("empresa") || c.includes("organization"))];
      }
      // Detect combined "Cidade/Estado" column
      const cityStateIdx = colLower.findIndex((c) => c.includes("cidade") && c.includes("estado"));
      if (cityStateIdx >= 0) {
        autoMap.city_state = data.columns[cityStateIdx];
      } else {
        if (colLower.some((c) => c.includes("cidade"))) {
          autoMap.city = data.columns[colLower.findIndex((c) => c.includes("cidade"))];
        }
        if (colLower.some((c) => c.includes("estado"))) {
          autoMap.state = data.columns[colLower.findIndex((c) => c.includes("estado"))];
        }
      }
      setMapping(autoMap);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
  }

  async function handleProcess() {
    if (!preview || !mapping.phone) {
      toast.error("Mapeie pelo menos o campo Número");
      return;
    }

    try {
      const result = await api.post<{
        imported_count: number;
        skipped_count: number;
        error_count: number;
        warning_count: number;
        total_rows: number;
        errors?: { row: number; error: string }[];
        warnings?: { row: number; phone: string; warning: string }[];
      }>("/import/process", {
        filename: preview.filename,
        column_mapping: mapping,
      });

      // Show main result
      const msg = `Importação: ${result.imported_count} importados, ${result.skipped_count} ignorados, ${result.error_count} erros`;
      if (result.error_count > 0 && result.imported_count === 0) {
        const errorDetail = result.errors?.[0]?.error || "";
        toast.error(`${msg}\n${errorDetail}`, { duration: 8000 });
      } else if (result.error_count > 0) {
        toast(msg, { icon: "⚠️", duration: 5000 });
      } else {
        toast.success(msg, { duration: 4000 });
      }

      // Show phone warnings if any
      if (result.warning_count && result.warnings?.length) {
        const dddWarnings = result.warnings.filter((w) => w.warning.includes("DDD"));
        const digitWarnings = result.warnings.filter((w) => w.warning.includes("dígitos"));

        if (dddWarnings.length > 0) {
          toast(`${dddWarnings.length} contato(s) sem DDD — verifique: ${dddWarnings.slice(0, 3).map((w) => w.phone).join(", ")}${dddWarnings.length > 3 ? "..." : ""}`, { icon: "⚠️", duration: 10000 });
        }
        if (digitWarnings.length > 0) {
          toast(`${digitWarnings.length} contato(s) com dígitos incorretos — verifique: ${digitWarnings.slice(0, 3).map((w) => w.phone).join(", ")}${digitWarnings.length > 3 ? "..." : ""}`, { icon: "⚠️", duration: 10000 });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      handleReset();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao processar");
    }
  }

  function handleReset() {
    setPreview(null);
    setMapping({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface-container border border-outline-variant rounded-xl w-full max-w-2xl mx-4 shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-tertiary/10 rounded-lg">
              <span className="material-symbols-outlined text-tertiary">upload_file</span>
            </div>
            <h3 className="font-bold text-lg">Importar Contatos</h3>
          </div>
          <button onClick={() => { handleReset(); onClose(); }} className="p-1.5 hover:bg-surface-container-highest rounded transition-colors text-secondary hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {!preview ? (
            <>
              <div
                className="border-2 border-dashed border-outline-variant rounded-lg p-10 flex flex-col items-center justify-center text-center hover:border-primary/50 transition-colors cursor-pointer bg-background/50"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleUpload(file);
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                  }}
                />
                {uploading ? (
                  <>
                    <span className="material-symbols-outlined text-4xl text-primary mb-4 animate-spin">progress_activity</span>
                    <p className="text-sm font-medium">Processando arquivo...</p>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-4xl text-secondary mb-4">cloud_upload</span>
                    <p className="text-sm font-medium text-on-surface">Arraste seu arquivo aqui</p>
                    <p className="text-xs text-secondary mt-1">Suporta CSV, XLSX ou XLS (máx. 10MB)</p>
                    <span className="mt-4 text-xs font-bold text-primary hover:underline uppercase tracking-widest">Ou selecione do computador</span>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              {/* File info */}
              <div className="flex items-center gap-4 p-3 bg-surface-container-highest/50 rounded-lg border border-outline-variant">
                <span className="material-symbols-outlined text-tertiary">description</span>
                <div className="flex-1">
                  <p className="text-xs font-bold">{preview.filename}</p>
                  <p className="text-[10px] text-secondary">{preview.totalRows} linhas encontradas</p>
                </div>
                <button onClick={handleReset} className="text-xs text-secondary hover:text-error transition-colors">Trocar arquivo</button>
              </div>

              {/* Column mapping */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-widest text-secondary">Mapeamento de Colunas</h4>
                {systemFields.map((field) => (
                  <div key={field.key} className="flex items-center gap-4">
                    <span className="text-xs font-medium w-32 text-on-surface-variant">{field.label}</span>
                    <span className="material-symbols-outlined text-secondary text-sm">arrow_forward</span>
                    <select
                      value={mapping[field.key] || ""}
                      onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value }))}
                      className="flex-1 bg-background border border-outline-variant rounded px-3 py-2 text-xs outline-none text-on-surface focus:ring-2 focus:ring-primary"
                    >
                      <option value="">-- Ignorar --</option>
                      {preview.columns.map((col) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Preview table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-widest text-secondary">Preview (primeiras {Math.min(5, preview.preview.length)} linhas)</h4>
                <div className="overflow-x-auto border border-outline-variant rounded-lg">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-surface-container-high/50">
                        {preview.columns.map((col) => (
                          <th key={col} className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-secondary whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                      {preview.preview.slice(0, 5).map((row, i) => (
                        <tr key={i} className="hover:bg-surface-bright/30">
                          {preview.columns.map((col) => (
                            <td key={col} className="px-3 py-2 text-[11px] text-on-surface-variant whitespace-nowrap">{row[col] || "-"}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {preview && (
          <div className="flex justify-end gap-3 p-6 border-t border-outline-variant">
            <button onClick={() => { handleReset(); onClose(); }} className="px-4 py-2.5 bg-surface-container-high border border-outline-variant text-on-surface rounded font-medium text-sm hover:bg-surface-bright transition-all">
              Cancelar
            </button>
            <button onClick={handleProcess} className="px-6 py-2.5 bg-primary text-on-primary rounded font-bold text-sm hover:opacity-90 transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">upload</span>
              Importar {preview.totalRows} contatos
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
