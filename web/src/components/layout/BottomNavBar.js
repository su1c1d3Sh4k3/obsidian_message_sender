import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink } from "react-router-dom";
const navItems = [
    { path: "/", icon: "dashboard", label: "Home" },
    { path: "/contacts", icon: "person_add", label: "Contatos" },
    { path: "/groups", icon: "folder_shared", label: "Grupos" },
    { path: "/campaigns", icon: "campaign", label: "Campanhas" },
    { path: "/schedule", icon: "calendar_month", label: "Agenda" },
    { path: "/settings", icon: "settings", label: "Ajustes" },
];
export default function BottomNavBar() {
    return (_jsx("nav", { className: "md:hidden flex justify-around items-center h-16 bg-surface-dim border-t border-outline-variant fixed bottom-0 w-full z-40 px-2", children: navItems.map((item) => (_jsxs(NavLink, { to: item.path, end: item.path === "/", className: ({ isActive }) => `flex flex-col items-center justify-center gap-1 ${isActive ? "text-primary" : "text-on-surface-variant"}`, children: [_jsx("span", { className: "material-symbols-outlined text-xl", children: item.icon }), _jsx("span", { className: "text-[10px] font-medium", children: item.label })] }, item.path))) }));
}
//# sourceMappingURL=BottomNavBar.js.map