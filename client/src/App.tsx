import { useCallback, useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Pos from "./pages/Pos";
import SaleHistory from "./pages/SaleHistory";
import SaleDetail from "./pages/SaleDetail";
import Labels from "./pages/Labels";
import SettingsPage from "./pages/Settings";
import Login from "./pages/Login";
import { checkSession, logout, setUnauthorizedHandler, type SessionState } from "./lib/api";

const navItems = [
  { to: "/", label: "Übersicht", end: true },
  { to: "/inventar", label: "Bestand" },
  { to: "/verkauf", label: "Verkauf" },
  { to: "/verkaeufe", label: "Verkäufe" },
  { to: "/kunden", label: "Kunden" },
  { to: "/etiketten", label: "Etiketten" },
  { to: "/einstellungen", label: "Einstellungen" },
];

export default function App() {
  const [session, setSession] = useState<SessionState | null>(null);

  useEffect(() => {
    checkSession().then(setSession);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() =>
      setSession((current) => ({ authenticated: false, protected: current?.protected ?? true }))
    );
    return () => setUnauthorizedHandler(null);
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    setSession({ authenticated: false, protected: true });
  }, []);

  if (session === null) {
    return <div className="min-h-screen flex items-center justify-center text-stone-500">Lade…</div>;
  }

  if (!session.authenticated) {
    return <Login onSuccess={() => setSession({ authenticated: true, protected: true })} />;
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="no-print bg-forest-800 text-forest-50 md:w-56 md:min-h-screen md:sticky md:top-0 flex flex-col">
        <div className="p-4 border-b border-forest-700 flex items-center gap-2.5">
          <img src="/icon.svg" alt="" className="w-8 h-8 rounded-lg shrink-0" />
          <h1 className="text-xl font-bold tracking-tight">Wildverkauf</h1>
        </div>
        <nav className="flex md:flex-col overflow-x-auto md:overflow-visible md:flex-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `px-4 py-3 text-sm font-medium whitespace-nowrap border-l-4 ${
                  isActive
                    ? "bg-forest-700 border-forest-300 text-white"
                    : "border-transparent text-forest-100 hover:bg-forest-700/60"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        {session.protected && (
          <button
            onClick={handleLogout}
            className="px-4 py-3 text-sm text-forest-200 hover:text-white hover:bg-forest-700/60 text-left border-t border-forest-700"
          >
            Abmelden
          </button>
        )}
      </aside>
      <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventar" element={<Inventory />} />
          <Route path="/verkauf" element={<Pos />} />
          <Route path="/verkaeufe" element={<SaleHistory />} />
          <Route path="/verkaeufe/:id" element={<SaleDetail />} />
          <Route path="/kunden" element={<Customers />} />
          <Route path="/kunden/:id" element={<CustomerDetail />} />
          <Route path="/etiketten" element={<Labels />} />
          <Route path="/einstellungen" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
