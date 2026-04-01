import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Contacts from "@/pages/Contacts";
import Groups from "@/pages/Groups";
import Campaigns from "@/pages/Campaigns";
import Schedule from "@/pages/Schedule";
import Senders from "@/pages/Senders";
import Settings from "@/pages/Settings";
import Admin from "@/pages/Admin";
import Birthdays from "@/pages/Birthdays";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary text-lg">Carregando...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/contacts" element={<Contacts />} />
                <Route path="/groups" element={<Groups />} />
                <Route path="/campaigns" element={<Campaigns />} />
                <Route path="/birthdays" element={<Birthdays />} />
                <Route path="/schedule" element={<Schedule />} />
                <Route path="/senders" element={<Senders />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/admin" element={<Admin />} />
              </Routes>
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
