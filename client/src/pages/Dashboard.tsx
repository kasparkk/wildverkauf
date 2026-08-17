import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatCurrency, formatDate } from "../lib/api";
import { Stats } from "../lib/types";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Stats>("/stats")
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-600">Fehler: {error}</p>;
  if (!stats) return <p className="text-stone-500">Lade…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Übersicht</h1>
        <p className="text-stone-500">Willkommen zurück – hier ist dein aktueller Stand.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Lagerwert (verfügbar)" value={formatCurrency(stats.inventory_value)} />
        <StatCard label="Umsatz diesen Monat" value={formatCurrency(stats.revenue_this_month)} />
        <StatCard label="Offene Zahlungen" value={formatCurrency(stats.open_payments)} />
        <StatCard label="Kunden" value={String(stats.customer_count)} hint={`${stats.animal_count} erfasste Tiere`} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Verfügbar" value={String(stats.cut_counts.available ?? 0)} />
        <StatCard label="Reserviert" value={String(stats.cut_counts.reserved ?? 0)} />
        <StatCard label="Verkauft" value={String(stats.cut_counts.sold ?? 0)} />
      </div>

      <div className="bg-white rounded-lg border border-stone-200 shadow-sm">
        <div className="px-5 py-3 border-b border-stone-200 flex items-center justify-between">
          <h2 className="font-semibold">Letzte Verkäufe</h2>
          <Link to="/verkaeufe" className="text-sm text-forest-700 hover:underline">
            Alle anzeigen
          </Link>
        </div>
        {stats.recent_sales.length === 0 ? (
          <p className="p-5 text-stone-400 text-sm">Noch keine Verkäufe erfasst.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {stats.recent_sales.map((sale) => (
                <tr key={sale.id} className="border-t border-stone-100">
                  <td className="px-5 py-3">
                    <Link to={`/verkaeufe/${sale.id}`} className="text-forest-700 hover:underline">
                      #{sale.id}
                    </Link>
                  </td>
                  <td className="px-5 py-3">{sale.customer_name ?? "Laufkundschaft"}</td>
                  <td className="px-5 py-3 text-stone-500">{formatDate(sale.date)}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={sale.payment_status} />
                  </td>
                  <td className="px-5 py-3 text-right font-medium">{formatCurrency(sale.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
