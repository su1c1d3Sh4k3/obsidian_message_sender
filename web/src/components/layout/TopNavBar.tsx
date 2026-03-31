import { useAuth } from "@/contexts/AuthContext";

export default function TopNavBar() {
  const { user } = useAuth();

  return (
    <header className="flex justify-between items-center h-16 px-6 w-full z-40 bg-background border-b border-outline-variant sticky top-0">
      <div className="flex items-center gap-4">
        <span className="text-xl font-black text-primary md:hidden">Obsidian MSGR</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center bg-surface-container rounded-md border border-outline-variant px-3 py-1.5 w-64">
          <span className="material-symbols-outlined text-secondary text-lg">search</span>
          <input
            className="bg-transparent border-none text-xs focus:ring-0 focus:outline-none text-on-surface w-full placeholder:text-secondary ml-2"
            placeholder="Buscar..."
            type="text"
          />
        </div>

        <div className="flex items-center gap-2">
          <button className="p-2 text-secondary hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <div className="h-8 w-8 rounded-full bg-primary-container flex items-center justify-center overflow-hidden ml-2 border border-outline-variant">
            <span className="text-xs font-bold text-on-primary-container">
              {user?.name?.charAt(0).toUpperCase() ?? "U"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
