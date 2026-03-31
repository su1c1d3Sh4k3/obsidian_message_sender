import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

/* ───────────────────────── Types ───────────────────────── */

interface Campaign {
  id: string;
  name: string;
  status: string;
  total_contacts: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface Sender {
  id: string;
  name: string;
  phone: string;
  status: string;
  last_seen_at: string | null;
}

/* ───────────────────────── Helpers ───────────────────────── */

const statusLabels: Record<string, string> = {
  draft: "Rascunho", scheduled: "Agendada", running: "Enviando",
  paused: "Pausada", completed: "Enviada", cancelled: "Cancelada", failed: "Falhou",
};

const statusBadge: Record<string, string> = {
  draft: "bg-surface-container-high text-on-surface-variant",
  scheduled: "bg-primary/10 text-primary",
  running: "bg-primary/10 text-primary",
  paused: "bg-yellow-500/10 text-yellow-400",
  completed: "bg-tertiary/10 text-tertiary",
  cancelled: "bg-error/10 text-error",
  failed: "bg-error/10 text-error",
};

const campaignIcon: Record<string, string> = {
  completed: "mark_chat_read",
  running: "send",
  paused: "pause_circle",
  scheduled: "schedule",
  draft: "edit_note",
  failed: "error",
  cancelled: "cancel",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

/* ───────────────────────── Component ───────────────────────── */

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: contactsData } = useQuery({
    queryKey: ["dashboard-contacts"],
    queryFn: () => api.get<{ pagination: { total: number } }>("/contacts?limit=1"),
    refetchInterval: 30000,
  });

  const { data: campaignsData } = useQuery({
    queryKey: ["dashboard-campaigns"],
    queryFn: () => api.get<{ data: Campaign[] }>("/campaigns?limit=50"),
    refetchInterval: 10000,
  });

  const { data: senders = [] } = useQuery({
    queryKey: ["dashboard-senders"],
    queryFn: () => api.get<Sender[]>("/senders"),
    refetchInterval: 15000,
  });

  const totalContacts = contactsData?.pagination?.total ?? 0;
  const campaigns = campaignsData?.data ?? [];

  const connectedSenders = senders.filter((s) => s.status === "connected").length;
  const totalSenders = senders.length;

  const activeCampaigns = campaigns.filter((c) => c.status === "running" || c.status === "scheduled").length;
  const totalSent = campaigns.reduce((sum, c) => sum + (c.sent_count ?? 0), 0);
  const totalDelivered = campaigns.reduce((sum, c) => sum + (c.delivered_count ?? 0), 0);
  const totalFailed = campaigns.reduce((sum, c) => sum + (c.failed_count ?? 0), 0);
  const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;

  const runningCampaign = campaigns.find((c) => c.status === "running");
  const runningPct = runningCampaign && runningCampaign.total_contacts > 0
    ? Math.round((runningCampaign.sent_count / runningCampaign.total_contacts) * 100) : 0;

  const last5 = useMemo(
    () => [...campaigns].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5),
    [campaigns],
  );

  const upcoming = useMemo(
    () => campaigns
      .filter((c) => c.scheduled_at && new Date(c.scheduled_at) > new Date() && c.status !== "completed")
      .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
      .slice(0, 4),
    [campaigns],
  );

  // SVG circle math for delivery rate ring
  const circumference = 2 * Math.PI * 40; // r=40
  const dashOffset = circumference - (deliveryRate / 100) * circumference;
  const deliveryTrend = deliveryRate >= 80 ? "+alto" : deliveryRate >= 50 ? "médio" : "baixo";

  return (
    <div className="space-y-8 pb-8">
      {/* ═══ Hero: Live Campaign ═══ */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live campaign card */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-xl bg-surface-container border border-outline-variant p-8" style={{ boxShadow: "0 0 20px -5px rgba(167, 139, 250, 0.15)" }}>
          {/* Background glow */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 blur-[100px] rounded-full pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-4 flex-1">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-tertiary animate-pulse" />
                <span className="text-tertiary text-xs font-bold uppercase tracking-widest">
                  {runningCampaign ? "Campanha ao vivo" : "Nenhuma campanha ativa"}
                </span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight">
                {runningCampaign?.name ?? "Dashboard"}
              </h2>
              <p className="text-on-surface-variant text-sm max-w-md">
                {runningCampaign
                  ? `Enviando para ${runningCampaign.total_contacts} contatos. ${runningCampaign.sent_count} enviadas, ${runningCampaign.failed_count} falhas.`
                  : `Bem-vindo de volta, ${user?.name ?? "usuário"}. Gerencie suas campanhas e contatos.`
                }
              </p>
              {runningCampaign && (
                <div className="pt-2">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-xs text-on-surface-variant font-medium">Progresso</span>
                    <span className="text-sm font-bold text-primary">{runningPct}%</span>
                  </div>
                  <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-1000"
                      style={{ width: `${runningPct}%`, boxShadow: "0 0 12px rgba(167,139,250,0.5)" }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 shrink-0">
              {runningCampaign ? (
                <>
                  <button
                    onClick={() => navigate("/campaigns")}
                    className="px-6 py-2.5 bg-primary text-on-primary text-sm font-bold rounded-lg hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">analytics</span>
                    Ver Logs
                  </button>
                  <button className="px-6 py-2.5 bg-surface-container-highest border border-outline-variant text-on-surface text-sm font-bold rounded-lg hover:bg-surface-variant transition-all flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-sm">pause_circle</span>
                    Pausar
                  </button>
                </>
              ) : (
                <button
                  onClick={() => navigate("/campaigns")}
                  className="px-6 py-2.5 bg-primary text-on-primary text-sm font-bold rounded-lg hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  Nova Campanha
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Delivery Rate Ring */}
        <div className="bg-surface-container border border-outline-variant rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-black text-on-surface-variant mb-4 uppercase tracking-wider">Taxa de Entrega</h3>
            <div className="flex items-center gap-4">
              <div className="relative flex items-center justify-center">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle className="text-surface-container-high" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeWidth="8" />
                  <circle
                    className="text-primary transition-all duration-1000"
                    cx="48" cy="48" fill="transparent" r="40"
                    stroke="currentColor" strokeWidth="8"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute text-xl font-black">{deliveryRate}%</span>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-on-surface-variant font-medium">Otimizado</p>
                <p className="text-xs text-tertiary flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">trending_up</span>
                  {deliveryTrend}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-6 p-4 rounded-lg bg-surface-container-low border border-outline-variant">
            <div className="flex justify-between items-center">
              <span className="text-xs text-on-surface-variant">{totalDelivered} entregues</span>
              <span className="text-xs font-bold text-on-surface">{totalFailed} falhas</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Metrics Grid ═══ */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Contacts */}
        <div
          onClick={() => navigate("/contacts")}
          className="bg-surface-container border border-outline-variant p-5 rounded-xl hover:border-primary/50 transition-colors cursor-pointer"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <span className="material-symbols-outlined text-primary">group</span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-tertiary/10 text-tertiary">{totalContacts} VÁLIDOS</span>
          </div>
          <p className="text-on-surface-variant text-xs font-medium uppercase tracking-wider">Total de Contatos</p>
          <h4 className="text-2xl font-black mt-1">{totalContacts.toLocaleString("pt-BR")}</h4>
        </div>

        {/* Active Campaigns */}
        <div
          onClick={() => navigate("/campaigns")}
          className="bg-surface-container border border-outline-variant p-5 rounded-xl hover:border-primary/50 transition-colors cursor-pointer"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <span className="material-symbols-outlined text-primary">rocket_launch</span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-container-high text-on-surface-variant">{activeCampaigns} ATIVAS</span>
          </div>
          <p className="text-on-surface-variant text-xs font-medium uppercase tracking-wider">Campanhas</p>
          <h4 className="text-2xl font-black mt-1">{campaigns.length}</h4>
        </div>

        {/* Messages Sent */}
        <div className="bg-surface-container border border-outline-variant p-5 rounded-xl hover:border-primary/50 transition-colors">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <span className="material-symbols-outlined text-primary">chat_bubble</span>
            </div>
            <div className="flex gap-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-tertiary/10 text-tertiary">{totalDelivered} OK</span>
              {totalFailed > 0 && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-error/10 text-error">{totalFailed} FAIL</span>
              )}
            </div>
          </div>
          <p className="text-on-surface-variant text-xs font-medium uppercase tracking-wider">Mensagens Enviadas</p>
          <h4 className="text-2xl font-black mt-1">{totalSent.toLocaleString("pt-BR")}</h4>
        </div>

        {/* Senders Connected */}
        <div
          onClick={() => navigate("/senders")}
          className="bg-surface-container border border-outline-variant p-5 rounded-xl hover:border-primary/50 transition-colors cursor-pointer"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <span className="material-symbols-outlined text-primary">hub</span>
            </div>
            {connectedSenders > 0 && <span className="flex h-2 w-2 rounded-full bg-tertiary mt-2" />}
          </div>
          <p className="text-on-surface-variant text-xs font-medium uppercase tracking-wider">Remetentes Ativos</p>
          <h4 className="text-2xl font-black mt-1">{connectedSenders} / {totalSenders}</h4>
        </div>
      </section>

      {/* ═══ Lower Grid ═══ */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Campaigns */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold">Campanhas Recentes</h3>
            <button onClick={() => navigate("/campaigns")} className="text-primary text-xs font-bold hover:underline">
              Ver Todas
            </button>
          </div>

          <div className="space-y-3">
            {last5.length === 0 ? (
              <div className="bg-surface-container border border-outline-variant p-8 rounded-xl text-center text-secondary text-xs">
                Nenhuma campanha criada
              </div>
            ) : (
              last5.map((c) => {
                const pct = c.total_contacts > 0 ? Math.round((c.sent_count / c.total_contacts) * 100) : 0;
                return (
                  <div
                    key={c.id}
                    onClick={() => navigate("/campaigns")}
                    className="group bg-surface-container border border-outline-variant p-4 rounded-xl hover:bg-surface-variant transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center border border-outline-variant group-hover:border-primary/30 shrink-0">
                          <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">
                            {campaignIcon[c.status] ?? "campaign"}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-on-surface truncate">{c.name}</h4>
                          <p className="text-[10px] text-on-surface-variant uppercase tracking-tighter">
                            {c.status === "completed" && c.completed_at ? `Enviada ${timeAgo(c.completed_at)}` :
                             c.status === "running" && c.started_at ? `Iniciada ${timeAgo(c.started_at)}` :
                             `Criada ${timeAgo(c.created_at)}`}
                            {" • "}{c.total_contacts} Contatos
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 shrink-0">
                        <div className="hidden md:block w-32 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${c.status === "completed" ? "bg-tertiary" : c.status === "running" ? "bg-primary" : "bg-surface-container-highest"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={`px-3 py-1 text-[10px] font-black rounded-full uppercase tracking-widest whitespace-nowrap ${statusBadge[c.status] ?? ""}`}>
                          {statusLabels[c.status] ?? c.status}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Configured Senders */}
          <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Remetentes</h3>
              <button onClick={() => navigate("/senders")} className="material-symbols-outlined text-on-surface-variant text-sm hover:text-primary transition-colors">
                add
              </button>
            </div>
            <div className="p-5 space-y-4">
              {senders.length === 0 ? (
                <p className="text-xs text-secondary text-center py-2">Nenhum remetente</p>
              ) : (
                senders.slice(0, 4).map((s) => {
                  const isConnected = s.status === "connected";
                  const isDisconnected = s.status === "disconnected";
                  return (
                    <div key={s.id} className={`flex items-center justify-between ${isDisconnected ? "opacity-50" : ""}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded flex items-center justify-center ${isDisconnected ? "bg-secondary-container text-error" : "bg-secondary-container"}`}>
                          <span className={`material-symbols-outlined text-sm ${isDisconnected ? "" : "text-[#25D366]"}`}>
                            {isDisconnected ? "link_off" : "chat"}
                          </span>
                        </div>
                        <div>
                          <p className={`text-xs font-bold ${isDisconnected ? "text-on-surface-variant" : ""}`}>{s.name}</p>
                          <p className={`text-[10px] ${isConnected ? "text-tertiary" : isDisconnected ? "text-error" : "text-yellow-400"}`}>
                            {isConnected ? "Conectado" : isDisconnected ? "Desconectado" : "Conectando..."}
                          </p>
                        </div>
                      </div>
                      <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-tertiary" : isDisconnected ? "bg-error" : "bg-yellow-400"}`} />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Upcoming */}
          <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Próximos Agendamentos</h3>
              <span className="material-symbols-outlined text-on-surface-variant text-sm">calendar_today</span>
            </div>
            {upcoming.length === 0 ? (
              <div className="p-5 text-center">
                <p className="text-xs text-secondary">Nenhum agendamento</p>
              </div>
            ) : (
              <div className="divide-y divide-outline-variant">
                {upcoming.map((c) => {
                  const d = new Date(c.scheduled_at!);
                  return (
                    <div
                      key={c.id}
                      onClick={() => navigate("/schedule")}
                      className="p-4 hover:bg-surface-variant transition-colors cursor-pointer"
                    >
                      <div className="flex gap-4">
                        <div className="text-center w-10 shrink-0">
                          <p className="text-[10px] text-on-surface-variant font-bold uppercase">
                            {d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
                          </p>
                          <p className="text-lg font-black text-primary">{d.getDate()}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{c.name}</p>
                          <p className="text-[10px] text-on-surface-variant mt-1">
                            {d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {c.total_contacts} contatos
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="p-4 bg-surface-container-low border-t border-outline-variant">
              <button
                onClick={() => navigate("/schedule")}
                className="w-full text-center text-[10px] font-bold text-primary uppercase tracking-widest hover:text-primary/80"
              >
                Ver Calendário Completo
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
