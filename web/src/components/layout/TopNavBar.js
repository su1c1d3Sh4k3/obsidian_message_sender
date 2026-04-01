import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
export default function TopNavBar() {
    const { user } = useAuth();
    const { data: senders = [] } = useQuery({
        queryKey: ["senders"],
        queryFn: () => api.get("/senders"),
        refetchInterval: 30_000,
    });
    const connected = senders.filter((s) => s.status === "connected");
    const disconnected = senders.filter((s) => s.status !== "connected");
    return (_jsxs("header", { className: "flex justify-between items-center h-16 px-6 w-full z-40 bg-background border-b border-outline-variant sticky top-0", children: [_jsx("div", { className: "flex items-center gap-4", children: _jsx("span", { className: "text-xl font-black text-primary md:hidden", children: "Obsidian MSGR" }) }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: "flex items-center gap-3", children: senders.length === 0 ? (_jsx("span", { className: "text-[10px] text-secondary uppercase tracking-wider font-semibold", children: "Nenhuma inst\u00E2ncia" })) : (_jsxs(_Fragment, { children: [connected.length > 0 && (_jsxs("div", { className: "flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tertiary/10 border border-tertiary/20", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-tertiary animate-pulse" }), _jsxs("span", { className: "text-[10px] font-bold text-tertiary uppercase tracking-wider", children: [connected.length, " ", connected.length === 1 ? "conectada" : "conectadas"] })] })), disconnected.length > 0 && (_jsxs("div", { className: "flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-error/10 border border-error/20", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-error" }), _jsxs("span", { className: "text-[10px] font-bold text-error uppercase tracking-wider", children: [disconnected.length, " ", disconnected.length === 1 ? "desconectada" : "desconectadas"] })] }))] })) }), _jsx("div", { className: "h-8 w-8 rounded-full bg-primary-container flex items-center justify-center overflow-hidden ml-2 border border-outline-variant", children: _jsx("span", { className: "text-xs font-bold text-on-primary-container", children: user?.name?.charAt(0).toUpperCase() ?? "U" }) })] })] }));
}
//# sourceMappingURL=TopNavBar.js.map