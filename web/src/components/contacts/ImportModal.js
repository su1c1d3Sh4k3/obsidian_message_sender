import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
export default function ImportModal({ open, onClose }) {
    const queryClient = useQueryClient();
    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview] = useState(null);
    const [mapping, setMapping] = useState({});
    const systemFields = [
        { key: "first_name", label: "Primeiro Nome" },
        { key: "phone", label: "Número" },
        { key: "organization", label: "Empresa" },
        { key: "city", label: "Cidade" },
        { key: "state", label: "Estado" },
    ];
    async function handleUpload(file) {
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/import/upload", {
                method: "POST",
                body: formData,
            });
            const text = await res.text();
            const data = text ? JSON.parse(text) : {};
            if (!res.ok)
                throw new Error(data.error || "Erro no upload");
            setPreview(data);
            // Auto-map columns by name similarity
            const autoMap = {};
            const colLower = data.columns.map((c) => c.toLowerCase());
            if (colLower.some((c) => c.includes("primeiro")))
                autoMap.first_name = data.columns[colLower.findIndex((c) => c.includes("primeiro"))];
            if (colLower.some((c) => c.includes("completo") || c.includes("nome"))) {
                const idx = colLower.findIndex((c) => c.includes("completo"));
                if (idx >= 0 && !autoMap.first_name)
                    autoMap.first_name = data.columns[idx];
            }
            if (colLower.some((c) => c.includes("número") || c.includes("numero") || c.includes("phone") || c.includes("telefone"))) {
                autoMap.phone = data.columns[colLower.findIndex((c) => c.includes("número") || c.includes("numero") || c.includes("phone") || c.includes("telefone"))];
            }
            if (colLower.some((c) => c.includes("empresa") || c.includes("organization"))) {
                autoMap.organization = data.columns[colLower.findIndex((c) => c.includes("empresa") || c.includes("organization"))];
            }
            if (colLower.some((c) => c.includes("cidade"))) {
                autoMap.city = data.columns[colLower.findIndex((c) => c.includes("cidade"))];
            }
            if (colLower.some((c) => c.includes("estado"))) {
                autoMap.state = data.columns[colLower.findIndex((c) => c.includes("estado"))];
            }
            setMapping(autoMap);
        }
        catch (err) {
            toast.error(err instanceof Error ? err.message : "Erro no upload");
        }
        finally {
            setUploading(false);
        }
    }
    async function handleProcess() {
        if (!preview || !mapping.phone) {
            toast.error("Mapeie pelo menos o campo Número");
            return;
        }
        try {
            await api.post("/import/process", {
                filename: preview.filename,
                column_mapping: mapping,
            });
            toast.success(`Importação de ${preview.totalRows} contatos iniciada!`);
            queryClient.invalidateQueries({ queryKey: ["contacts"] });
            handleReset();
            onClose();
        }
        catch (err) {
            toast.error(err instanceof Error ? err.message : "Erro ao processar");
        }
    }
    function handleReset() {
        setPreview(null);
        setMapping({});
        if (fileInputRef.current)
            fileInputRef.current.value = "";
    }
    if (!open)
        return null;
    return (_jsxs("div", { className: "fixed inset-0 z-[60] flex items-center justify-center", children: [_jsx("div", { className: "absolute inset-0 bg-black/60 backdrop-blur-sm", onClick: onClose }), _jsxs("div", { className: "relative bg-surface-container border border-outline-variant rounded-xl w-full max-w-2xl mx-4 shadow-2xl max-h-[85vh] flex flex-col", children: [_jsxs("div", { className: "flex items-center justify-between p-6 border-b border-outline-variant", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "p-2 bg-tertiary/10 rounded-lg", children: _jsx("span", { className: "material-symbols-outlined text-tertiary", children: "upload_file" }) }), _jsx("h3", { className: "font-bold text-lg", children: "Importar Contatos" })] }), _jsx("button", { onClick: () => { handleReset(); onClose(); }, className: "p-1.5 hover:bg-surface-container-highest rounded transition-colors text-secondary hover:text-on-surface", children: _jsx("span", { className: "material-symbols-outlined", children: "close" }) })] }), _jsx("div", { className: "p-6 overflow-y-auto flex-1 space-y-6", children: !preview ? (_jsx(_Fragment, { children: _jsxs("div", { className: "border-2 border-dashed border-outline-variant rounded-lg p-10 flex flex-col items-center justify-center text-center hover:border-primary/50 transition-colors cursor-pointer bg-background/50", onClick: () => fileInputRef.current?.click(), onDragOver: (e) => e.preventDefault(), onDrop: (e) => {
                                    e.preventDefault();
                                    const file = e.dataTransfer.files[0];
                                    if (file)
                                        handleUpload(file);
                                }, children: [_jsx("input", { ref: fileInputRef, type: "file", accept: ".csv,.xlsx,.xls", className: "hidden", onChange: (e) => {
                                            const file = e.target.files?.[0];
                                            if (file)
                                                handleUpload(file);
                                        } }), uploading ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "material-symbols-outlined text-4xl text-primary mb-4 animate-spin", children: "progress_activity" }), _jsx("p", { className: "text-sm font-medium", children: "Processando arquivo..." })] })) : (_jsxs(_Fragment, { children: [_jsx("span", { className: "material-symbols-outlined text-4xl text-secondary mb-4", children: "cloud_upload" }), _jsx("p", { className: "text-sm font-medium text-on-surface", children: "Arraste seu arquivo aqui" }), _jsx("p", { className: "text-xs text-secondary mt-1", children: "Suporta CSV, XLSX ou XLS (m\u00E1x. 10MB)" }), _jsx("span", { className: "mt-4 text-xs font-bold text-primary hover:underline uppercase tracking-widest", children: "Ou selecione do computador" })] }))] }) })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center gap-4 p-3 bg-surface-container-highest/50 rounded-lg border border-outline-variant", children: [_jsx("span", { className: "material-symbols-outlined text-tertiary", children: "description" }), _jsxs("div", { className: "flex-1", children: [_jsx("p", { className: "text-xs font-bold", children: preview.filename }), _jsxs("p", { className: "text-[10px] text-secondary", children: [preview.totalRows, " linhas encontradas"] })] }), _jsx("button", { onClick: handleReset, className: "text-xs text-secondary hover:text-error transition-colors", children: "Trocar arquivo" })] }), _jsxs("div", { className: "space-y-3", children: [_jsx("h4", { className: "text-xs font-bold uppercase tracking-widest text-secondary", children: "Mapeamento de Colunas" }), systemFields.map((field) => (_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("span", { className: "text-xs font-medium w-32 text-on-surface-variant", children: field.label }), _jsx("span", { className: "material-symbols-outlined text-secondary text-sm", children: "arrow_forward" }), _jsxs("select", { value: mapping[field.key] || "", onChange: (e) => setMapping((m) => ({ ...m, [field.key]: e.target.value })), className: "flex-1 bg-background border border-outline-variant rounded px-3 py-2 text-xs outline-none text-on-surface focus:ring-2 focus:ring-primary", children: [_jsx("option", { value: "", children: "-- Ignorar --" }), preview.columns.map((col) => (_jsx("option", { value: col, children: col }, col)))] })] }, field.key)))] }), _jsxs("div", { className: "space-y-2", children: [_jsxs("h4", { className: "text-xs font-bold uppercase tracking-widest text-secondary", children: ["Preview (primeiras ", Math.min(5, preview.preview.length), " linhas)"] }), _jsx("div", { className: "overflow-x-auto border border-outline-variant rounded-lg", children: _jsxs("table", { className: "w-full text-left", children: [_jsx("thead", { children: _jsx("tr", { className: "bg-surface-container-high/50", children: preview.columns.map((col) => (_jsx("th", { className: "px-3 py-2 text-[9px] font-black uppercase tracking-widest text-secondary whitespace-nowrap", children: col }, col))) }) }), _jsx("tbody", { className: "divide-y divide-outline-variant", children: preview.preview.slice(0, 5).map((row, i) => (_jsx("tr", { className: "hover:bg-surface-bright/30", children: preview.columns.map((col) => (_jsx("td", { className: "px-3 py-2 text-[11px] text-on-surface-variant whitespace-nowrap", children: row[col] || "-" }, col))) }, i))) })] }) })] })] })) }), preview && (_jsxs("div", { className: "flex justify-end gap-3 p-6 border-t border-outline-variant", children: [_jsx("button", { onClick: () => { handleReset(); onClose(); }, className: "px-4 py-2.5 bg-surface-container-high border border-outline-variant text-on-surface rounded font-medium text-sm hover:bg-surface-bright transition-all", children: "Cancelar" }), _jsxs("button", { onClick: handleProcess, className: "px-6 py-2.5 bg-primary text-on-primary rounded font-bold text-sm hover:opacity-90 transition-all flex items-center gap-2", children: [_jsx("span", { className: "material-symbols-outlined text-lg", children: "upload" }), "Importar ", preview.totalRows, " contatos"] })] }))] })] }));
}
//# sourceMappingURL=ImportModal.js.map