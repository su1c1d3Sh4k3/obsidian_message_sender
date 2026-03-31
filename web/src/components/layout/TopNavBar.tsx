import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface Sender {
  id: string;
  name: string;
  phone: string | null;
  status: string;
}

export default function TopNavBar() {
  const { user } = useAuth();

  const { data: senders = [] } = useQuery({
    queryKey: ["senders"],
    queryFn: () => api.get<Sender[]>("/senders"),
    refetchInterval: 30_000,
  });

  const connected = senders.filter((s) => s.status === "connected");
  const disconnected = senders.filter((s) => s.status !== "connected");

  return (
    <header className="flex justify-between items-center h-16 px-6 w-full z-40 bg-background border-b border-outline-variant sticky top-0">
      <div className="flex items-center gap-4">
        <span className="text-xl font-black text-primary md:hidden">Obsidian MSGR</span>
      </div>

      <div className="flex items-center gap-4">
        {/* Instance status */}
        <div className="flex items-center gap-3">
          {senders.length === 0 ? (
            <span className="text-[10px] text-secondary uppercase tracking-wider font-semibold">Nenhuma instância</span>
          ) : (
            <>
              {connected.length > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tertiary/10 border border-tertiary/20">
                  <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
                  <span className="text-[10px] font-bold text-tertiary uppercase tracking-wider">
                    {connected.length} {connected.length === 1 ? "conectada" : "conectadas"}
                  </span>
                </div>
              )}
              {disconnected.length > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-error/10 border border-error/20">
                  <span className="w-2 h-2 rounded-full bg-error" />
                  <span className="text-[10px] font-bold text-error uppercase tracking-wider">
                    {disconnected.length} {disconnected.length === 1 ? "desconectada" : "desconectadas"}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="h-8 w-8 rounded-full bg-primary-container flex items-center justify-center overflow-hidden ml-2 border border-outline-variant">
          <span className="text-xs font-bold text-on-primary-container">
            {user?.name?.charAt(0).toUpperCase() ?? "U"}
          </span>
        </div>
      </div>
    </header>
  );
}
