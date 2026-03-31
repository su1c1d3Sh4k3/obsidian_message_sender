import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
/* ───────────────────────── Helpers ───────────────────────── */
const MONTHS = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WEEKDAYS_FULL = [
    "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
    "Quinta-feira", "Sexta-feira", "Sábado",
];
function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isToday(d) {
    return isSameDay(d, new Date());
}
function getCalendarDays(year, month) {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startDay = first.getDay();
    const days = [];
    for (let i = startDay - 1; i >= 0; i--) {
        days.push({ date: new Date(year, month, -i), inMonth: false });
    }
    for (let d = 1; d <= last.getDate(); d++) {
        days.push({ date: new Date(year, month, d), inMonth: true });
    }
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
        for (let d = 1; d <= remaining; d++) {
            days.push({ date: new Date(year, month + 1, d), inMonth: false });
        }
    }
    return days;
}
function campaignBadgeStyle(status) {
    switch (status) {
        case "running":
            return "bg-primary border-l-2 border-primary-fixed text-on-primary shadow-lg shadow-primary/20";
        case "completed":
            return "bg-tertiary/10 border-l-2 border-tertiary text-tertiary";
        case "scheduled":
            return "bg-primary-container/20 border-l-2 border-primary text-primary";
        case "paused":
            return "bg-yellow-500/10 border-l-2 border-yellow-500 text-yellow-400";
        case "failed":
        case "cancelled":
            return "bg-error/10 border-l-2 border-error text-error";
        default: // draft
            return "bg-secondary-container border-l-2 border-outline text-on-surface-variant";
    }
}
function statusLabel(status) {
    const map = {
        draft: "Rascunho",
        scheduled: "Agendada",
        running: "Enviando",
        paused: "Pausada",
        completed: "Enviada",
        cancelled: "Cancelada",
        failed: "Falhou",
    };
    return map[status] ?? status;
}
function statusBadgeClass(status) {
    switch (status) {
        case "scheduled":
            return "text-primary bg-primary/10";
        case "running":
            return "text-tertiary bg-tertiary/10";
        case "completed":
            return "text-tertiary bg-tertiary/10";
        case "paused":
            return "text-yellow-400 bg-yellow-500/10";
        case "failed":
        case "cancelled":
            return "text-error bg-error/10";
        default:
            return "text-secondary bg-secondary-container";
    }
}
/* ───────────────────────── Component ───────────────────────── */
export default function Schedule() {
    const queryClient = useQueryClient();
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth());
    const [selectedDate, setSelectedDate] = useState(null);
    const [popoverCampaign, setPopoverCampaign] = useState(null);
    // Schedule form state
    const [schedCampaignId, setSchedCampaignId] = useState("");
    const [schedHour, setSchedHour] = useState("09");
    const [schedMinute, setSchedMinute] = useState("00");
    const { data: campaignsData } = useQuery({
        queryKey: ["campaigns", "all"],
        queryFn: () => api.get("/campaigns?limit=100"),
    });
    const campaigns = campaignsData?.data ?? [];
    const calendarDays = useMemo(() => getCalendarDays(year, month), [year, month]);
    function getCampaignsForDay(date) {
        return campaigns.filter((c) => {
            if (!c.scheduled_at)
                return false;
            return isSameDay(new Date(c.scheduled_at), date);
        });
    }
    const draftCampaigns = campaigns.filter((c) => c.status === "draft" && !c.scheduled_at);
    function prevMonth() {
        if (month === 0) {
            setMonth(11);
            setYear((y) => y - 1);
        }
        else
            setMonth((m) => m - 1);
        setSelectedDate(null);
        setPopoverCampaign(null);
    }
    function nextMonth() {
        if (month === 11) {
            setMonth(0);
            setYear((y) => y + 1);
        }
        else
            setMonth((m) => m + 1);
        setSelectedDate(null);
        setPopoverCampaign(null);
    }
    function goToday() {
        setYear(now.getFullYear());
        setMonth(now.getMonth());
        setSelectedDate(null);
        setPopoverCampaign(null);
    }
    // Schedule mutation
    const scheduleMutation = useMutation({
        mutationFn: ({ id, scheduled_at }) => api.put(`/campaigns/${id}`, { scheduled_at }),
        onSuccess: () => {
            toast.success("Campanha agendada!");
            queryClient.invalidateQueries({ queryKey: ["campaigns"] });
            setSchedCampaignId("");
        },
        onError: (err) => toast.error(err.message),
    });
    // Remove schedule
    const unscheduleMutation = useMutation({
        mutationFn: (id) => api.put(`/campaigns/${id}`, { scheduled_at: null }),
        onSuccess: () => {
            toast.success("Agendamento removido");
            queryClient.invalidateQueries({ queryKey: ["campaigns"] });
            setPopoverCampaign(null);
        },
        onError: (err) => toast.error(err.message),
    });
    function handleSchedule() {
        if (!schedCampaignId || !selectedDate)
            return toast.error("Selecione uma campanha");
        const d = new Date(selectedDate);
        d.setHours(parseInt(schedHour), parseInt(schedMinute), 0, 0);
        scheduleMutation.mutate({ id: schedCampaignId, scheduled_at: d.toISOString() });
    }
    // ── Render ──
    return (_jsxs("div", { className: "space-y-6 relative", children: [_jsx("div", { className: "flex flex-col md:flex-row md:items-center justify-between gap-4", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("h3", { className: "text-2xl font-bold text-on-surface", children: [MONTHS[month], ", ", year] }), _jsxs("div", { className: "flex items-center bg-surface-container rounded-lg border border-outline-variant p-1", children: [_jsx("button", { onClick: prevMonth, className: "p-1 hover:bg-surface-container-highest rounded text-on-surface-variant", children: _jsx("span", { className: "material-symbols-outlined text-base", children: "chevron_left" }) }), _jsx("button", { onClick: nextMonth, className: "p-1 hover:bg-surface-container-highest rounded text-on-surface-variant", children: _jsx("span", { className: "material-symbols-outlined text-base", children: "chevron_right" }) })] }), _jsx("button", { onClick: goToday, className: "text-xs font-medium bg-surface-container px-3 py-1.5 border border-outline-variant rounded hover:text-primary transition-colors", children: "Hoje" })] }) }), _jsxs("div", { className: "flex gap-6", children: [_jsx("div", { className: "flex-1 min-w-0", children: _jsxs("div", { className: "grid grid-cols-7 gap-px bg-outline-variant border border-outline-variant rounded-xl overflow-hidden", children: [["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (_jsx("div", { className: "bg-surface-dim p-4 text-center text-xs font-bold text-on-surface-variant uppercase tracking-wider", children: d }, d))), calendarDays.map(({ date, inMonth }, idx) => {
                                    const dayCampaigns = getCampaignsForDay(date);
                                    const today = isToday(date);
                                    const isSelected = selectedDate && isSameDay(date, selectedDate);
                                    return (_jsxs("div", { onClick: () => {
                                            setSelectedDate(date);
                                            setPopoverCampaign(null);
                                        }, className: `bg-surface-container-lowest min-h-[120px] p-2 cursor-pointer transition-colors hover:bg-surface-container ${!inMonth ? "opacity-50" : ""} ${isSelected ? "bg-surface-container ring-1 ring-primary/30" : ""}`, children: [_jsx("span", { className: `text-xs font-medium ${today ? "font-bold text-primary" : ""}`, children: date.getDate() }), _jsxs("div", { className: "mt-1 space-y-1", children: [dayCampaigns.slice(0, 3).map((c) => (_jsx("div", { onClick: (e) => {
                                                            e.stopPropagation();
                                                            setPopoverCampaign(c);
                                                            setSelectedDate(date);
                                                        }, className: `p-1.5 rounded text-[10px] font-bold truncate cursor-pointer hover:brightness-110 transition-all ${campaignBadgeStyle(c.status)}`, children: c.status === "draft" ? `Draft: ${c.name}` : c.name }, c.id))), dayCampaigns.length > 3 && (_jsxs("span", { className: "text-[9px] text-secondary pl-1", children: ["+", dayCampaigns.length - 3, " mais"] }))] })] }, idx));
                                })] }) }), _jsx("aside", { className: "hidden xl:block w-80 shrink-0 space-y-4", children: selectedDate ? (_jsxs("div", { className: "bg-surface-container border border-outline-variant rounded-xl p-5 space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-[10px] font-bold uppercase tracking-widest text-secondary", children: WEEKDAYS_FULL[selectedDate.getDay()] }), _jsxs("h4", { className: "text-lg font-bold text-on-surface mt-0.5", children: [selectedDate.getDate(), " de ", MONTHS[selectedDate.getMonth()]] })] }), _jsx("button", { onClick: () => { setSelectedDate(null); setPopoverCampaign(null); }, className: "text-on-surface-variant hover:text-on-surface", children: _jsx("span", { className: "material-symbols-outlined text-sm", children: "close" }) })] }), getCampaignsForDay(selectedDate).length > 0 && (_jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-[10px] font-bold uppercase tracking-widest text-secondary", children: "Campanhas neste dia" }), getCampaignsForDay(selectedDate).map((c) => (_jsxs("div", { onClick: () => setPopoverCampaign(c), className: "flex items-center gap-3 p-3 bg-surface-container-high/50 rounded-lg cursor-pointer hover:bg-surface-bright transition-colors border border-outline-variant", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-bold truncate", children: c.name }), _jsxs("p", { className: "text-[10px] text-secondary", children: [c.scheduled_at ? new Date(c.scheduled_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "", " · ", c.total_contacts, " contatos"] })] }), _jsx("span", { className: `text-[9px] font-bold px-2 py-0.5 rounded ${statusBadgeClass(c.status)}`, children: statusLabel(c.status) })] }, c.id)))] })), draftCampaigns.length > 0 && (_jsxs("div", { className: "space-y-3 pt-2 border-t border-outline-variant", children: [_jsx("p", { className: "text-[10px] font-bold uppercase tracking-widest text-secondary", children: "Agendar campanha" }), _jsxs("select", { value: schedCampaignId, onChange: (e) => setSchedCampaignId(e.target.value), className: "w-full bg-background border border-outline-variant rounded px-3 py-2 text-xs outline-none text-on-surface focus:ring-2 focus:ring-primary", children: [_jsx("option", { value: "", children: "Selecione uma campanha..." }), draftCampaigns.map((c) => (_jsx("option", { value: c.id, children: c.name }, c.id)))] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("select", { value: schedHour, onChange: (e) => setSchedHour(e.target.value), className: "flex-1 bg-background border border-outline-variant rounded px-3 py-2 text-xs outline-none text-on-surface focus:ring-2 focus:ring-primary", children: Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => (_jsxs("option", { value: h, children: [h, "h"] }, h))) }), _jsx("select", { value: schedMinute, onChange: (e) => setSchedMinute(e.target.value), className: "flex-1 bg-background border border-outline-variant rounded px-3 py-2 text-xs outline-none text-on-surface focus:ring-2 focus:ring-primary", children: ["00", "15", "30", "45"].map((m) => (_jsxs("option", { value: m, children: [m, "min"] }, m))) })] }), _jsx("button", { onClick: handleSchedule, disabled: !schedCampaignId || scheduleMutation.isPending, className: "w-full py-2 bg-primary rounded text-on-primary text-xs font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50", children: scheduleMutation.isPending ? "Agendando..." : "Agendar" })] })), getCampaignsForDay(selectedDate).length === 0 && draftCampaigns.length === 0 && (_jsx("p", { className: "text-xs text-secondary text-center py-4", children: "Nenhuma campanha neste dia" }))] })) : (
                        /* Upcoming campaigns */
                        _jsxs("div", { className: "bg-surface-container border border-outline-variant rounded-xl p-5 space-y-4", children: [_jsx("p", { className: "text-[10px] font-bold uppercase tracking-widest text-secondary", children: "Pr\u00F3ximas campanhas" }), campaigns
                                    .filter((c) => c.scheduled_at && new Date(c.scheduled_at) >= now && c.status !== "completed")
                                    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
                                    .slice(0, 8)
                                    .map((c) => (_jsxs("div", { onClick: () => {
                                        const d = new Date(c.scheduled_at);
                                        setYear(d.getFullYear());
                                        setMonth(d.getMonth());
                                        setSelectedDate(d);
                                        setPopoverCampaign(c);
                                    }, className: "flex items-center gap-3 p-3 bg-surface-container-high/50 rounded-lg cursor-pointer hover:bg-surface-bright transition-colors border border-outline-variant", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-bold truncate", children: c.name }), _jsxs("div", { className: "flex items-center gap-2 text-[10px] text-secondary mt-0.5", children: [_jsx("span", { className: "material-symbols-outlined text-[12px]", children: "event" }), new Date(c.scheduled_at).toLocaleDateString("pt-BR"), " \u00B7 ", new Date(c.scheduled_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })] })] }), _jsx("span", { className: `text-[9px] font-bold px-2 py-0.5 rounded ${statusBadgeClass(c.status)}`, children: statusLabel(c.status) })] }, c.id))), campaigns.filter((c) => c.scheduled_at && new Date(c.scheduled_at) >= now && c.status !== "completed").length === 0 && (_jsx("p", { className: "text-xs text-secondary text-center py-6", children: "Nenhuma campanha agendada" }))] })) })] }), popoverCampaign && (_jsxs("div", { className: "absolute bottom-24 right-6 w-80 bg-surface-container border border-outline shadow-2xl rounded-xl p-5 z-50", children: [_jsxs("div", { className: "flex justify-between items-start mb-4", children: [_jsxs("div", { children: [_jsx("span", { className: `text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${statusBadgeClass(popoverCampaign.status)}`, children: statusLabel(popoverCampaign.status) }), _jsx("h4", { className: "text-lg font-bold text-on-surface mt-1", children: popoverCampaign.name })] }), _jsx("button", { onClick: () => setPopoverCampaign(null), className: "text-on-surface-variant hover:text-on-surface", children: _jsx("span", { className: "material-symbols-outlined text-sm", children: "close" }) })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center gap-3 text-sm text-on-surface-variant", children: [_jsx("span", { className: "material-symbols-outlined text-base", children: "event" }), _jsx("span", { children: popoverCampaign.scheduled_at
                                            ? `${new Date(popoverCampaign.scheduled_at).toLocaleDateString("pt-BR")} · ${new Date(popoverCampaign.scheduled_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                                            : "Sem agendamento" })] }), _jsxs("div", { className: "flex items-center gap-3 text-sm text-on-surface-variant", children: [_jsx("span", { className: "material-symbols-outlined text-base", children: "group" }), _jsxs("span", { children: [popoverCampaign.total_contacts, " contatos"] })] }), popoverCampaign.status === "completed" && (_jsxs("div", { className: "flex items-center gap-3 text-sm text-on-surface-variant", children: [_jsx("span", { className: "material-symbols-outlined text-base", children: "check_circle" }), _jsxs("span", { children: [popoverCampaign.sent_count, "/", popoverCampaign.total_contacts, " enviadas"] })] }))] }), _jsxs("div", { className: "mt-6 flex gap-2", children: [(popoverCampaign.status === "draft" || popoverCampaign.status === "scheduled") && (_jsx("button", { onClick: () => unscheduleMutation.mutate(popoverCampaign.id), disabled: unscheduleMutation.isPending, className: "flex-1 py-2 bg-primary rounded text-on-primary text-xs font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50", children: popoverCampaign.scheduled_at ? "Remover Agendamento" : "Editar" })), _jsx("button", { onClick: () => setPopoverCampaign(null), className: "p-2 border border-outline-variant rounded text-on-surface-variant hover:bg-surface-container-high transition-colors", children: _jsx("span", { className: "material-symbols-outlined text-sm", children: "close" }) })] })] }))] }));
}
//# sourceMappingURL=Schedule.js.map