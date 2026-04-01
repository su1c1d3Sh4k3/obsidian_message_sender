import { NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { path: "/", icon: "dashboard", label: "Dashboard" },
  { path: "/contacts", icon: "person_add", label: "Contatos" },
  { path: "/groups", icon: "folder_shared", label: "Grupos" },
  { path: "/campaigns", icon: "campaign", label: "Campanhas" },
  { path: "/birthdays", icon: "cake", label: "Aniversários" },
  { path: "/schedule", icon: "calendar_month", label: "Agendamentos" },
  { path: "/senders", icon: "phone_android", label: "Remetentes" },
  { path: "/settings", icon: "settings", label: "Configurações" },
];

const ADMIN_EMAIL = "suicideshake@gmail.com";

export default function SideNavBar() {
  const { signOut, user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;

  const allItems = isAdmin
    ? [...navItems, { path: "/admin", icon: "admin_panel_settings", label: "Admin" }]
    : navItems;

  return (
    <aside className="hidden md:flex flex-col h-screen w-64 border-r border-outline-variant bg-surface-dim fixed left-0 top-0 z-50">
      <div className="px-6 py-8">
        <h1 className="text-on-surface font-bold text-xl tracking-tight">Obsidian</h1>
        <p className="text-xs text-secondary font-medium uppercase tracking-widest mt-1">
          Precision MSGR
        </p>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {allItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                isActive
                  ? "bg-surface-variant text-primary border-r-2 border-primary"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant"
              }`
            }
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span className="text-sm font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-6 border-t border-outline-variant space-y-1">
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-all w-full"
        >
          <span className="material-symbols-outlined">logout</span>
          <span className="text-sm font-medium">Sair</span>
        </button>
      </div>
    </aside>
  );
}
