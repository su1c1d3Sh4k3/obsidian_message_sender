import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import toast from "react-hot-toast";

/* ───────────────────────── Types ───────────────────────── */

interface Campaign {
  id: string;
  name: string;
  status: string;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  total_contacts: number;
  sent_count: number;
}

/* ───────────────────────── Helpers ───────────────────────── */

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const WEEKDAYS_FULL = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
  "Quinta-feira", "Sexta-feira", "Sábado",
];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isToday(d: Date) {
  return isSameDay(d, new Date());
}

function getCalendarDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDay = first.getDay();
  const days: { date: Date; inMonth: boolean }[] = [];

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

function campaignBadgeStyle(status: string) {
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

function statusLabel(status: string) {
  const map: Record<string, string> = {
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

function statusBadgeClass(status: string) {
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
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [popoverCampaign, setPopoverCampaign] = useState<Campaign | null>(null);

  // Schedule form state
  const [schedCampaignId, setSchedCampaignId] = useState("");
  const [schedHour, setSchedHour] = useState("09");
  const [schedMinute, setSchedMinute] = useState("00");

  const { data: campaignsData } = useQuery({
    queryKey: ["campaigns", "all"],
    queryFn: () => api.get<{ data: Campaign[] }>("/campaigns?limit=100"),
  });

  const campaigns = campaignsData?.data ?? [];
  const calendarDays = useMemo(() => getCalendarDays(year, month), [year, month]);

  function getCampaignsForDay(date: Date) {
    return campaigns.filter((c) => {
      if (!c.scheduled_at) return false;
      return isSameDay(new Date(c.scheduled_at), date);
    });
  }

  const draftCampaigns = campaigns.filter((c) => c.status === "draft" && !c.scheduled_at);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
    setSelectedDate(null);
    setPopoverCampaign(null);
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
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
    mutationFn: ({ id, scheduled_at }: { id: string; scheduled_at: string }) =>
      api.put(`/campaigns/${id}`, { scheduled_at }),
    onSuccess: () => {
      toast.success("Campanha agendada!");
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setSchedCampaignId("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Remove schedule
  const unscheduleMutation = useMutation({
    mutationFn: (id: string) => api.put(`/campaigns/${id}`, { scheduled_at: null }),
    onSuccess: () => {
      toast.success("Agendamento removido");
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setPopoverCampaign(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSchedule() {
    if (!schedCampaignId || !selectedDate) return toast.error("Selecione uma campanha");
    const d = new Date(selectedDate);
    d.setHours(parseInt(schedHour), parseInt(schedMinute), 0, 0);
    scheduleMutation.mutate({ id: schedCampaignId, scheduled_at: d.toISOString() });
  }

  // ── Render ──
  return (
    <div className="space-y-6 relative">
      {/* Calendar Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h3 className="text-2xl font-bold text-on-surface">
            {MONTHS[month]}, {year}
          </h3>
          <div className="flex items-center bg-surface-container rounded-lg border border-outline-variant p-1">
            <button onClick={prevMonth} className="p-1 hover:bg-surface-container-highest rounded text-on-surface-variant">
              <span className="material-symbols-outlined text-base">chevron_left</span>
            </button>
            <button onClick={nextMonth} className="p-1 hover:bg-surface-container-highest rounded text-on-surface-variant">
              <span className="material-symbols-outlined text-base">chevron_right</span>
            </button>
          </div>
          <button
            onClick={goToday}
            className="text-xs font-medium bg-surface-container px-3 py-1.5 border border-outline-variant rounded hover:text-primary transition-colors"
          >
            Hoje
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* ═══ Calendar Grid ═══ */}
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-7 gap-px bg-outline-variant border border-outline-variant rounded-xl overflow-hidden">
            {/* Day Headers */}
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
              <div key={d} className="bg-surface-dim p-4 text-center text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                {d}
              </div>
            ))}

            {/* Day Cells */}
            {calendarDays.map(({ date, inMonth }, idx) => {
              const dayCampaigns = getCampaignsForDay(date);
              const today = isToday(date);
              const isSelected = selectedDate && isSameDay(date, selectedDate);

              return (
                <div
                  key={idx}
                  onClick={() => {
                    setSelectedDate(date);
                    setPopoverCampaign(null);
                  }}
                  className={`bg-surface-container-lowest min-h-[120px] p-2 cursor-pointer transition-colors hover:bg-surface-container ${
                    !inMonth ? "opacity-50" : ""
                  } ${isSelected ? "bg-surface-container ring-1 ring-primary/30" : ""}`}
                >
                  {/* Day number */}
                  <span className={`text-xs font-medium ${today ? "font-bold text-primary" : ""}`}>
                    {date.getDate()}
                  </span>

                  {/* Campaign badges */}
                  <div className="mt-1 space-y-1">
                    {dayCampaigns.slice(0, 3).map((c) => (
                      <div
                        key={c.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPopoverCampaign(c);
                          setSelectedDate(date);
                        }}
                        className={`p-1.5 rounded text-[10px] font-bold truncate cursor-pointer hover:brightness-110 transition-all ${campaignBadgeStyle(c.status)}`}
                      >
                        {c.status === "draft" ? `Draft: ${c.name}` : c.name}
                      </div>
                    ))}
                    {dayCampaigns.length > 3 && (
                      <span className="text-[9px] text-secondary pl-1">+{dayCampaigns.length - 3} mais</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══ Right Panel ═══ */}
        <aside className="hidden xl:block w-80 shrink-0 space-y-4">
          {/* Selected day detail or upcoming */}
          {selectedDate ? (
            <div className="bg-surface-container border border-outline-variant rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-secondary">
                    {WEEKDAYS_FULL[selectedDate.getDay()]}
                  </p>
                  <h4 className="text-lg font-bold text-on-surface mt-0.5">
                    {selectedDate.getDate()} de {MONTHS[selectedDate.getMonth()]}
                  </h4>
                </div>
                <button
                  onClick={() => { setSelectedDate(null); setPopoverCampaign(null); }}
                  className="text-on-surface-variant hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              {/* Campaigns on this day */}
              {getCampaignsForDay(selectedDate).length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-secondary">Campanhas neste dia</p>
                  {getCampaignsForDay(selectedDate).map((c) => (
                    <div
                      key={c.id}
                      onClick={() => setPopoverCampaign(c)}
                      className="flex items-center gap-3 p-3 bg-surface-container-high/50 rounded-lg cursor-pointer hover:bg-surface-bright transition-colors border border-outline-variant"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{c.name}</p>
                        <p className="text-[10px] text-secondary">
                          {c.scheduled_at ? new Date(c.scheduled_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}
                          {" · "}{c.total_contacts} contatos
                        </p>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${statusBadgeClass(c.status)}`}>
                        {statusLabel(c.status)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Schedule form */}
              {draftCampaigns.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-outline-variant">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-secondary">Agendar campanha</p>
                  <select
                    value={schedCampaignId}
                    onChange={(e) => setSchedCampaignId(e.target.value)}
                    className="w-full bg-background border border-outline-variant rounded px-3 py-2 text-xs outline-none text-on-surface focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Selecione uma campanha...</option>
                    {draftCampaigns.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <select
                      value={schedHour}
                      onChange={(e) => setSchedHour(e.target.value)}
                      className="flex-1 bg-background border border-outline-variant rounded px-3 py-2 text-xs outline-none text-on-surface focus:ring-2 focus:ring-primary"
                    >
                      {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => (
                        <option key={h} value={h}>{h}h</option>
                      ))}
                    </select>
                    <select
                      value={schedMinute}
                      onChange={(e) => setSchedMinute(e.target.value)}
                      className="flex-1 bg-background border border-outline-variant rounded px-3 py-2 text-xs outline-none text-on-surface focus:ring-2 focus:ring-primary"
                    >
                      {["00", "15", "30", "45"].map((m) => (
                        <option key={m} value={m}>{m}min</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleSchedule}
                    disabled={!schedCampaignId || scheduleMutation.isPending}
                    className="w-full py-2 bg-primary rounded text-on-primary text-xs font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {scheduleMutation.isPending ? "Agendando..." : "Agendar"}
                  </button>
                </div>
              )}

              {getCampaignsForDay(selectedDate).length === 0 && draftCampaigns.length === 0 && (
                <p className="text-xs text-secondary text-center py-4">Nenhuma campanha neste dia</p>
              )}
            </div>
          ) : (
            /* Upcoming campaigns */
            <div className="bg-surface-container border border-outline-variant rounded-xl p-5 space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-secondary">Próximas campanhas</p>
              {campaigns
                .filter((c) => c.scheduled_at && new Date(c.scheduled_at) >= now && c.status !== "completed")
                .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
                .slice(0, 8)
                .map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      const d = new Date(c.scheduled_at!);
                      setYear(d.getFullYear());
                      setMonth(d.getMonth());
                      setSelectedDate(d);
                      setPopoverCampaign(c);
                    }}
                    className="flex items-center gap-3 p-3 bg-surface-container-high/50 rounded-lg cursor-pointer hover:bg-surface-bright transition-colors border border-outline-variant"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{c.name}</p>
                      <div className="flex items-center gap-2 text-[10px] text-secondary mt-0.5">
                        <span className="material-symbols-outlined text-[12px]">event</span>
                        {new Date(c.scheduled_at!).toLocaleDateString("pt-BR")} · {new Date(c.scheduled_at!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${statusBadgeClass(c.status)}`}>
                      {statusLabel(c.status)}
                    </span>
                  </div>
                ))}
              {campaigns.filter((c) => c.scheduled_at && new Date(c.scheduled_at) >= now && c.status !== "completed").length === 0 && (
                <p className="text-xs text-secondary text-center py-6">Nenhuma campanha agendada</p>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* ═══ Campaign Popover (over calendar) ═══ */}
      {popoverCampaign && (
        <div className="absolute bottom-24 right-6 w-80 bg-surface-container border border-outline shadow-2xl rounded-xl p-5 z-50">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${statusBadgeClass(popoverCampaign.status)}`}>
                {statusLabel(popoverCampaign.status)}
              </span>
              <h4 className="text-lg font-bold text-on-surface mt-1">{popoverCampaign.name}</h4>
            </div>
            <button
              onClick={() => setPopoverCampaign(null)}
              className="text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-base">event</span>
              <span>
                {popoverCampaign.scheduled_at
                  ? `${new Date(popoverCampaign.scheduled_at).toLocaleDateString("pt-BR")} · ${new Date(popoverCampaign.scheduled_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                  : "Sem agendamento"}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-base">group</span>
              <span>{popoverCampaign.total_contacts} contatos</span>
            </div>
            {popoverCampaign.status === "completed" && (
              <div className="flex items-center gap-3 text-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span>{popoverCampaign.sent_count}/{popoverCampaign.total_contacts} enviadas</span>
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-2">
            {(popoverCampaign.status === "draft" || popoverCampaign.status === "scheduled") && (
              <button
                onClick={() => unscheduleMutation.mutate(popoverCampaign.id)}
                disabled={unscheduleMutation.isPending}
                className="flex-1 py-2 bg-primary rounded text-on-primary text-xs font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
              >
                {popoverCampaign.scheduled_at ? "Remover Agendamento" : "Editar"}
              </button>
            )}
            <button
              onClick={() => setPopoverCampaign(null)}
              className="p-2 border border-outline-variant rounded text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
