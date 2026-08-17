import { NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Pos from "./pages/Pos";
import SaleHistory from "./pages/SaleHistory";
import SaleDetail from "./pages/SaleDetail";

const navItems = [
  { to: "/", label: "Übersicht", end: true },
  { to: "/inventar", label: "Bestand" },
  { to: "/verkauf", label: "Verkauf" },
  { to: "/verkaeufe", label: "Verkäufe" },
  { to: "/kunden", label: "Kunden" },
];

export default function App() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="no-print bg-forest-800 text-forest-50 md:w-56 md:min-h-screen md:sticky md:top-0">
        <div className="p-4 border-b border-forest-700">
          <h1 className="text-xl font-bold tracking-tight">🦌 Wildverkauf</h1>
        </div>
        <nav className="flex md:flex-col overflow-x-auto md:overflow-visible">
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
        </Routes>
      </main>
    </div>
  );
}
