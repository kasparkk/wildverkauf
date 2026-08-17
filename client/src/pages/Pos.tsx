import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, cutPrice, formatCurrency } from "../lib/api";
import { Cut, Customer, Sale } from "../lib/types";
import { CustomerForm } from "./Customers";

interface CartItem {
  key: string;
  cut_id: number | null;
  description: string;
  weight_kg: number | null;
  quantity: number;
  unit_price: number;
}

export default function Pos() {
  const navigate = useNavigate();
  const [availableCuts, setAvailableCuts] = useState<Cut[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState("bar");
  const [paymentStatus, setPaymentStatus] = useState<"bezahlt" | "offen">("bezahlt");
  const [notes, setNotes] = useState("");
  const [showCustomItem, setShowCustomItem] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadCuts() {
    api.get<Cut[]>("/cuts?status=available").then(setAvailableCuts);
  }
  function loadCustomers() {
    api.get<Customer[]>("/customers").then(setCustomers);
  }

  useEffect(() => {
    loadCuts();
    loadCustomers();
  }, []);

  const filteredCuts = availableCuts.filter(
    (c) =>
      !cart.some((item) => item.cut_id === c.id) &&
      (c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.animal_species ?? "").toLowerCase().includes(search.toLowerCase()))
  );

  function addCut(cut: Cut) {
    setCart((prev) => [
      ...prev,
      {
        key: `cut-${cut.id}`,
        cut_id: cut.id,
        description: cut.name,
        weight_kg: cut.weight_kg,
        quantity: 1,
        unit_price: cutPrice(cut),
      },
    ]);
  }

  function removeItem(key: string) {
    setCart((prev) => prev.filter((i) => i.key !== key));
  }

  function updateItem(key: string, patch: Partial<CartItem>) {
    setCart((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  const total = useMemo(
    () => cart.reduce((sum, i) => sum + i.unit_price * i.quantity, 0),
    [cart]
  );

  async function submitSale() {
    if (cart.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const sale = await api.post<Sale>("/sales", {
        customer_id: customerId ? Number(customerId) : null,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        notes: notes || null,
        items: cart.map((i) => ({
          cut_id: i.cut_id,
          description: i.description,
          weight_kg: i.weight_kg,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
      });
      navigate(`/verkaeufe/${sale.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Verkauf</h1>
        <p className="text-stone-500">Teilstücke auswählen und Verkauf abschließen.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Teilstück suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm"
          />
          <div className="bg-white rounded-lg border border-stone-200 shadow-sm max-h-96 overflow-y-auto">
            {filteredCuts.map((cut) => (
              <button
                key={cut.id}
                onClick={() => addCut(cut)}
                className="w-full text-left px-4 py-2.5 border-b border-stone-100 last:border-0 hover:bg-forest-50 flex justify-between items-center"
              >
                <div>
                  <div className="font-medium">{cut.name}</div>
                  <div className="text-xs text-stone-500">
                    {cut.animal_species ?? "Ohne Wildtier"}
                    {cut.weight_kg != null ? ` · ${cut.weight_kg} kg` : ""}
                  </div>
                </div>
                <div className="text-sm font-medium">{formatCurrency(cutPrice(cut))}</div>
              </button>
            ))}
            {filteredCuts.length === 0 && (
              <p className="p-4 text-stone-400 text-sm">Keine verfügbaren Teilstücke gefunden.</p>
            )}
          </div>
          <button
            onClick={() => setShowCustomItem(true)}
            className="text-sm text-forest-700 hover:underline"
          >
            + Freien Posten hinzufügen
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-stone-200 shadow-sm">
            <div className="px-4 py-3 border-b border-stone-200 font-semibold">Warenkorb</div>
            {cart.length === 0 ? (
              <p className="p-4 text-stone-400 text-sm">Noch keine Artikel ausgewählt.</p>
            ) : (
              <div>
                {cart.map((item) => (
                  <div key={item.key} className="px-4 py-3 border-b border-stone-100 last:border-0 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{item.description}</div>
                      <div className="text-xs text-stone-500 flex gap-2 items-center mt-1">
                        <span>Menge</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.key, { quantity: Number(e.target.value) })}
                          className="w-16 border border-stone-300 rounded px-1 py-0.5"
                        />
                        <span>×</span>
                        <input
                          type="number"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => updateItem(item.key, { unit_price: Number(e.target.value) })}
                          className="w-20 border border-stone-300 rounded px-1 py-0.5"
                        />
                        <span>€</span>
                      </div>
                    </div>
                    <div className="text-sm font-medium">{formatCurrency(item.unit_price * item.quantity)}</div>
                    <button onClick={() => removeItem(item.key)} className="text-stone-400 hover:text-red-600">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="px-4 py-3 flex justify-between items-center font-semibold border-t border-stone-200">
              <span>Gesamt</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-4 space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Kunde</label>
              <div className="flex gap-2">
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="flex-1 border border-stone-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Laufkundschaft</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewCustomer(true)}
                  className="px-3 py-2 text-sm rounded-md border border-stone-300 hover:bg-stone-100"
                >
                  + Neu
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Zahlungsart</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="bar">Bar</option>
                  <option value="ueberweisung">Überweisung</option>
                  <option value="karte">Karte</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as "bezahlt" | "offen")}
                  className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="bezahlt">Bezahlt</option>
                  <option value="offen">Offen</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notizen</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              onClick={submitSale}
              disabled={cart.length === 0 || submitting}
              className="w-full py-2.5 rounded-md bg-forest-700 text-white font-medium hover:bg-forest-800 disabled:opacity-50"
            >
              Verkauf abschließen
            </button>
          </div>
        </div>
      </div>

      {showCustomItem && (
        <CustomItemForm
          onClose={() => setShowCustomItem(false)}
          onAdd={(item) => {
            setCart((prev) => [...prev, { ...item, key: `custom-${Date.now()}` }]);
            setShowCustomItem(false);
          }}
        />
      )}
      {showNewCustomer && (
        <CustomerForm
          onClose={() => setShowNewCustomer(false)}
          onSaved={() => {
            setShowNewCustomer(false);
            loadCustomers();
          }}
        />
      )}
    </div>
  );
}

function CustomItemForm({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (item: Omit<CartItem, "key">) => void;
}) {
  const [description, setDescription] = useState("");
  const [weight, setWeight] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5 space-y-4">
        <h2 className="text-lg font-semibold">Freier Posten</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Bezeichnung</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Gewicht (kg)</label>
            <input
              type="number"
              step="0.01"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Menge</label>
            <input
              type="number"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Preis pro Einheit (€)</label>
          <input
            type="number"
            step="0.01"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm rounded-md border border-stone-300">
            Abbrechen
          </button>
          <button
            onClick={() =>
              description &&
              onAdd({
                cut_id: null,
                description,
                weight_kg: weight ? Number(weight) : null,
                quantity: Number(quantity) || 1,
                unit_price: Number(unitPrice) || 0,
              })
            }
            className="px-3 py-2 text-sm rounded-md bg-forest-700 text-white hover:bg-forest-800"
          >
            Hinzufügen
          </button>
        </div>
      </div>
    </div>
  );
}
