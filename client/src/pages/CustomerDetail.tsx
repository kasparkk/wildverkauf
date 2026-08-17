import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, formatCurrency, formatDate } from "../lib/api";
import { Customer } from "../lib/types";
import StatusBadge from "../components/StatusBadge";

export default function CustomerDetail() {
  const { id } = useParams();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Customer>(`/customers/${id}`).then(setCustomer).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="text-red-600">Fehler: {error}</p>;
  if (!customer) return <p className="text-stone-500">Lade…</p>;

  return (
    <div className="space-y-6">
      <Link to="/kunden" className="text-sm text-forest-700 hover:underline">
        ← Zurück zu Kunden
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-stone-900">{customer.name}</h1>
        <div className="text-stone-500 text-sm mt-1 space-y-0.5">
          {customer.phone && <p>Telefon: {customer.phone}</p>}
          {customer.email && <p>E-Mail: {customer.email}</p>}
          {customer.address && <p>Adresse: {customer.address}</p>}
          {customer.notes && <p>Notizen: {customer.notes}</p>}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-stone-200 shadow-sm">
        <div className="px-5 py-3 border-b border-stone-200">
          <h2 className="font-semibold">Bestellhistorie</h2>
        </div>
        {!customer.sales || customer.sales.length === 0 ? (
          <p className="p-5 text-stone-400 text-sm">Noch keine Käufe.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {customer.sales.map((sale) => (
                <tr key={sale.id} className="border-t border-stone-100">
                  <td className="px-5 py-3">
                    <Link to={`/verkaeufe/${sale.id}`} className="text-forest-700 hover:underline">
                      #{sale.id}
                    </Link>
                  </td>
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
