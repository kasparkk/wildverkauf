import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatCurrency, formatDate } from "../lib/api";
import { Sale } from "../lib/types";
import StatusBadge from "../components/StatusBadge";

export default function SaleHistory() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Sale[]>("/sales").then(setSales).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Verkäufe</h1>
        <p className="text-stone-500">Alle bisherigen Verkäufe.</p>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-stone-500 border-b border-stone-200">
              <th className="px-4 py-2 font-medium">Nr.</th>
              <th className="px-4 py-2 font-medium">Datum</th>
              <th className="px-4 py-2 font-medium">Kunde</th>
              <th className="px-4 py-2 font-medium">Zahlungsart</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium text-right">Summe</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-t border-stone-100 hover:bg-stone-50">
                <td className="px-4 py-2">
                  <Link to={`/verkaeufe/${s.id}`} className="text-forest-700 hover:underline font-medium">
                    #{s.id}
                  </Link>
                </td>
                <td className="px-4 py-2 text-stone-500">{formatDate(s.date)}</td>
                <td className="px-4 py-2">{s.customer_name ?? "Laufkundschaft"}</td>
                <td className="px-4 py-2 text-stone-500">{s.payment_method}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={s.payment_status} />
                </td>
                <td className="px-4 py-2 text-right font-medium">{formatCurrency(s.total)}</td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-stone-400">
                  Noch keine Verkäufe.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
