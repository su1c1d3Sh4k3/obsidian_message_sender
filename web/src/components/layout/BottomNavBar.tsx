import { NavLink } from "react-router-dom";

const navItems = [
  { path: "/", icon: "dashboard", label: "Home" },
  { path: "/contacts", icon: "person_add", label: "Contatos" },
  { path: "/groups", icon: "folder_shared", label: "Grupos" },
  { path: "/campaigns", icon: "campaign", label: "Campanhas" },
  { path: "/birthdays", icon: "cake", label: "Aniversários" },
  { path: "/settings", icon: "settings", label: "Ajustes" },
];

export default function BottomNavBar() {
  return (
    <nav className="md:hidden flex justify-around items-center h-16 bg-surface-dim border-t border-outline-variant fixed bottom-0 w-full z-40 px-2">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === "/"}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 ${
              isActive ? "text-primary" : "text-on-surface-variant"
            }`
          }
        >
          <span className="material-symbols-outlined text-xl">{item.icon}</span>
          <span className="text-[10px] font-medium">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
