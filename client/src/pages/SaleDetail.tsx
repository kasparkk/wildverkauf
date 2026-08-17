import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, formatCurrency, formatDate } from "../lib/api";
import { Sale } from "../lib/types";
import StatusBadge from "../components/StatusBadge";

export default function SaleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sale, setSale] = useState<Sale | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<Sale>(`/sales/${id}`).then(setSale).catch((e) => setError(e.message));
  }

  useEffect(load, [id]);

  async function togglePaymentStatus() {
    if (!sale) return;
    const next = sale.payment_status === "bezahlt" ? "offen" : "bezahlt";
    await api.put(`/sales/${sale.id}`, { payment_status: next });
    load();
  }

  async function cancelSale() {
    if (!sale) return;
    if (!confirm("Verkauf wirklich stornieren? Die Teilstücke werden wieder als verfügbar markiert.")) return;
    await api.del(`/sales/${sale.id}`);
    navigate("/verkaeufe");
  }

  if (error) return <p className="text-red-600">Fehler: {error}</p>;
  if (!sale) return <p className="text-stone-500">Lade…</p>;

  return (
    <div className="space-y-6">
      <div className="no-print flex items-center justify-between flex-wrap gap-3">
        <Link to="/verkaeufe" className="text-sm text-forest-700 hover:underline">
          ← Zurück zu Verkäufen
        </Link>
        <div className="flex gap-2">
          <button
            onClick={togglePaymentStatus}
            className="px-3 py-2 text-sm rounded-md border border-stone-300 hover:bg-stone-100"
          >
            Als {sale.payment_status === "bezahlt" ? "offen" : "bezahlt"} markieren
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-2 text-sm rounded-md border border-stone-300 hover:bg-stone-100"
          >
            Drucken
          </button>
          <button
            onClick={cancelSale}
            className="px-3 py-2 text-sm rounded-md border border-red-300 text-red-600 hover:bg-red-50"
          >
            Stornieren
          </button>
        </div>
      </div>

      <div className="print-area bg-white rounded-lg border border-stone-200 shadow-sm p-6 max-w-2xl">
        <div className="flex justify-between items-start border-b border-stone-200 pb-4 mb-4">
          <div>
            <h1 className="text-xl font-bold">🦌 Wildverkauf</h1>
            <p className="text-sm text-stone-500">Beleg #{sale.id}</p>
          </div>
          <div className="text-right text-sm">
            <p>{formatDate(sale.date)}</p>
            <StatusBadge status={sale.payment_status} />
          </div>
        </div>

        <div className="mb-4 text-sm">
          <p className="font-medium">Kunde</p>
          <p className="text-stone-600">{sale.customer_name ?? "Laufkundschaft"}</p>
          {sale.customer_phone && <p className="text-stone-500">{sale.customer_phone}</p>}
        </div>

        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="text-left border-b border-stone-200 text-stone-500">
              <th className="py-2 font-medium">Artikel</th>
              <th className="py-2 font-medium text-right">Menge</th>
              <th className="py-2 font-medium text-right">Preis</th>
              <th className="py-2 font-medium text-right">Summe</th>
            </tr>
          </thead>
          <tbody>
            {sale.items?.map((item) => (
              <tr key={item.id} className="border-b border-stone-100">
                <td className="py-2">
                  {item.description}
                  {item.weight_kg != null && <span className="text-stone-400"> ({item.weight_kg} kg)</span>}
                </td>
                <td className="py-2 text-right">{item.quantity}</td>
                <td className="py-2 text-right">{formatCurrency(item.unit_price)}</td>
                <td className="py-2 text-right">{formatCurrency(item.total_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-48 flex justify-between font-semibold border-t border-stone-300 pt-2">
            <span>Gesamt</span>
            <span>{formatCurrency(sale.total)}</span>
          </div>
        </div>

        <div className="mt-4 text-sm text-stone-500">
          <p>Zahlungsart: {sale.payment_method}</p>
          {sale.notes && <p>Notizen: {sale.notes}</p>}
        </div>
      </div>
    </div>
  );
}
