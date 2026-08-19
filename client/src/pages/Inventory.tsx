import { useEffect, useRef, useState } from "react";
import { api, formatCurrency, formatDate, cutPrice } from "../lib/api";
import { Animal, Cut, CutStatus } from "../lib/types";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";
import { LabelScan, downscaleToBase64 } from "../lib/scan";

type Tab = "cuts" | "animals";

export default function Inventory() {
  const [tab, setTab] = useState<Tab>("cuts");
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showAnimalForm, setShowAnimalForm] = useState(false);
  const [showCutForm, setShowCutForm] = useState(false);
  const [prefill, setPrefill] = useState<LabelScan | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function loadAnimals() {
    api.get<Animal[]>("/animals").then(setAnimals).catch((e) => setError(e.message));
  }
  function loadCuts() {
    const qs = statusFilter ? `?status=${statusFilter}` : "";
    api.get<Cut[]>(`/cuts${qs}`).then(setCuts).catch((e) => setError(e.message));
  }

  useEffect(loadAnimals, []);
  useEffect(loadCuts, [statusFilter]);

  async function updateCutStatus(cut: Cut, status: CutStatus) {
    await api.put(`/cuts/${cut.id}`, { status });
    loadCuts();
  }

  async function deleteCut(cut: Cut) {
    if (!confirm(`Teilstück "${cut.name}" wirklich löschen?`)) return;
    await api.del(`/cuts/${cut.id}`);
    loadCuts();
  }

  async function clearBarcode(cut: Cut) {
    if (!confirm(`Barcode ${cut.barcode} von "${cut.name}" lösen?`)) return;
    await api.put(`/cuts/${cut.id}`, { barcode: null });
    loadCuts();
  }

  /** Photographs a foreign label and opens the cut form with what was read. */
  async function scanPhoto(file: File) {
    setScanning(true);
    setScanError(null);
    try {
      const image = await downscaleToBase64(file);
      const result = await api.post<LabelScan>("/scan", { image, media_type: "image/jpeg" });
      setPrefill(result);
      setShowCutForm(true);
    } catch (err: any) {
      setScanError(err.message);
    } finally {
      setScanning(false);
      if (photoInput.current) photoInput.current.value = "";
    }
  }

  async function deleteAnimal(animal: Animal) {
    if (!confirm(`Wildtier "${animal.species}" wirklich löschen? Zugehörige Teilstücke bleiben erhalten.`)) return;
    await api.del(`/animals/${animal.id}`);
    loadAnimals();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Bestand</h1>
          <p className="text-stone-500">Wildtiere und Teilstücke verwalten.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAnimalForm(true)}
            className="px-3 py-2 text-sm rounded-md border border-forest-700 text-forest-700 hover:bg-forest-50"
          >
            + Wildtier
          </button>
          <button
            onClick={() => photoInput.current?.click()}
            disabled={scanning}
            className="px-3 py-2 text-sm rounded-md border border-forest-700 text-forest-700 hover:bg-forest-50 disabled:opacity-50"
          >
            {scanning ? "Lese Etikett…" : "Etikett abfotografieren"}
          </button>
          <button
            onClick={() => {
              setPrefill(null);
              setShowCutForm(true);
            }}
            className="px-3 py-2 text-sm rounded-md bg-forest-700 text-white hover:bg-forest-800"
          >
            + Teilstück
          </button>
        </div>
      </div>

      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) scanPhoto(file);
        }}
      />

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {scanError && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          {scanError}
        </p>
      )}

      <div className="flex gap-1 border-b border-stone-200">
        <button
          onClick={() => setTab("cuts")}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            tab === "cuts" ? "border-forest-700 text-forest-800" : "border-transparent text-stone-500"
          }`}
        >
          Teilstücke ({cuts.length})
        </button>
        <button
          onClick={() => setTab("animals")}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            tab === "animals" ? "border-forest-700 text-forest-800" : "border-transparent text-stone-500"
          }`}
        >
          Wildtiere ({animals.length})
        </button>
      </div>

      {tab === "cuts" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {["", "available", "reserved", "sold"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 text-xs rounded-full border ${
                  statusFilter === s
                    ? "bg-forest-700 text-white border-forest-700"
                    : "border-stone-300 text-stone-600 hover:bg-stone-100"
                }`}
              >
                {s === "" ? "Alle" : s === "available" ? "Verfügbar" : s === "reserved" ? "Reserviert" : "Verkauft"}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-stone-500 border-b border-stone-200">
                  <th className="px-4 py-2 font-medium">Teilstück</th>
                  <th className="px-4 py-2 font-medium">Wildtier</th>
                  <th className="px-4 py-2 font-medium">Gewicht</th>
                  <th className="px-4 py-2 font-medium">Preis</th>
                  <th className="px-4 py-2 font-medium">Barcode</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {cuts.map((cut) => (
                  <tr key={cut.id} className="border-t border-stone-100">
                    <td className="px-4 py-2 font-medium">{cut.name}</td>
                    <td className="px-4 py-2 text-stone-500">
                      {cut.animal_species ? `${cut.animal_species} (${formatDate(cut.animal_date)})` : "-"}
                    </td>
                    <td className="px-4 py-2">{cut.weight_kg != null ? `${cut.weight_kg} kg` : "-"}</td>
                    <td className="px-4 py-2">{formatCurrency(cutPrice(cut))}</td>
                    <td className="px-4 py-2">
                      {cut.barcode ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="font-mono text-xs">{cut.barcode}</span>
                          <button
                            onClick={() => clearBarcode(cut)}
                            className="text-stone-400 hover:text-red-600"
                            title="Barcode lösen"
                            aria-label={`Barcode von ${cut.name} lösen`}
                          >
                            ×
                          </button>
                        </span>
                      ) : (
                        <span className="text-stone-300">–</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={cut.status}
                        onChange={(e) => updateCutStatus(cut, e.target.value as CutStatus)}
                        className="text-xs border border-stone-300 rounded px-1.5 py-0.5"
                      >
                        <option value="available">Verfügbar</option>
                        <option value="reserved">Reserviert</option>
                        <option value="sold">Verkauft</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => deleteCut(cut)} className="text-stone-400 hover:text-red-600 text-xs">
                        Löschen
                      </button>
                    </td>
                  </tr>
                ))}
                {cuts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-stone-400">
                      Keine Teilstücke gefunden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "animals" && (
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-stone-500 border-b border-stone-200">
                <th className="px-4 py-2 font-medium">Wildart</th>
                <th className="px-4 py-2 font-medium">Erlegt am</th>
                <th className="px-4 py-2 font-medium">Gewicht</th>
                <th className="px-4 py-2 font-medium">Teilstücke</th>
                <th className="px-4 py-2 font-medium">Notizen</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {animals.map((a) => (
                <tr key={a.id} className="border-t border-stone-100">
                  <td className="px-4 py-2 font-medium">{a.species}</td>
                  <td className="px-4 py-2 text-stone-500">{formatDate(a.date_harvested)}</td>
                  <td className="px-4 py-2">{a.weight_kg != null ? `${a.weight_kg} kg` : "-"}</td>
                  <td className="px-4 py-2">
                    {a.cuts_available ?? 0} verfügbar / {a.cut_count ?? 0} gesamt
                  </td>
                  <td className="px-4 py-2 text-stone-500">{a.notes ?? "-"}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => deleteAnimal(a)} className="text-stone-400 hover:text-red-600 text-xs">
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
              {animals.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-stone-400">
                    Keine Wildtiere erfasst.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showAnimalForm && (
        <AnimalForm
          onClose={() => setShowAnimalForm(false)}
          onSaved={() => {
            setShowAnimalForm(false);
            loadAnimals();
          }}
        />
      )}
      {showCutForm && (
        <CutForm
          animals={animals}
          prefill={prefill}
          onClose={() => {
            setShowCutForm(false);
            setPrefill(null);
          }}
          onSaved={() => {
            setShowCutForm(false);
            setPrefill(null);
            loadCuts();
          }}
        />
      )}
    </div>
  );
}

function AnimalForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [species, setSpecies] = useState("Reh");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/animals", {
        species,
        date_harvested: date,
        weight_kg: weight ? Number(weight) : null,
        notes: notes || null,
      });
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Neues Wildtier" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Wildart</label>
          <select
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
            className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm"
          >
            {["Reh", "Rothirsch", "Wildschwein", "Hase", "Fasan", "Ente", "Sonstiges"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Erlegt am</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Wildbretgewicht (kg)</label>
          <input
            type="number"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Notizen</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm"
            rows={2}
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm rounded-md border border-stone-300">
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-3 py-2 text-sm rounded-md bg-forest-700 text-white hover:bg-forest-800 disabled:opacity-50"
          >
            Speichern
          </button>
        </div>
      </form>
    </Modal>
  );
}

const CUT_PRESETS: Record<string, string[]> = {
  Edelteile: ["Rücken", "Filet", "Keule", "Blatt (Schulter)", "Nuss", "Oberschale"],
  Verarbeitet: ["Gulasch", "Braten", "Ragout", "Geschnetzeltes", "Hackfleisch"],
  Wurst: ["Bratwurst", "Salami", "Leberwurst"],
  Sonstiges: ["Rippchen", "Suppenknochen", "Leber", "Ganzes Tier", "Hälfte"],
};

const CUSTOM_NAME = "__custom__";

const ALL_PRESETS = Object.values(CUT_PRESETS).flat();

function CutForm({
  animals,
  prefill,
  onClose,
  onSaved,
}: {
  animals: Animal[];
  prefill?: LabelScan | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  // A scanned name only preselects the dropdown when it matches a preset,
  // otherwise it lands in the free-text field so nothing gets silently changed.
  const scannedName = prefill?.cut_name?.trim() ?? "";
  const matchedPreset = ALL_PRESETS.find(
    (preset) => preset.toLowerCase() === scannedName.toLowerCase()
  );

  const [animalId, setAnimalId] = useState<string>("");
  const [nameChoice, setNameChoice] = useState(
    matchedPreset ?? (scannedName ? CUSTOM_NAME : "")
  );
  const [customName, setCustomName] = useState(matchedPreset ? "" : scannedName);
  const name = nameChoice === CUSTOM_NAME ? customName.trim() : nameChoice;
  const [weight, setWeight] = useState(prefill?.weight_kg != null ? String(prefill.weight_kg) : "");
  const [pricingMode, setPricingMode] = useState<"perKg" | "fixed">(
    prefill?.fixed_price != null && prefill?.price_per_kg == null ? "fixed" : "perKg"
  );
  const [pricePerKg, setPricePerKg] = useState(
    prefill?.price_per_kg != null ? String(prefill.price_per_kg) : ""
  );
  const [fixedPrice, setFixedPrice] = useState(
    prefill?.fixed_price != null ? String(prefill.fixed_price) : ""
  );
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/cuts", {
        animal_id: animalId ? Number(animalId) : null,
        name,
        weight_kg: weight ? Number(weight) : null,
        price_per_kg: pricingMode === "perKg" && pricePerKg ? Number(pricePerKg) : null,
        fixed_price: pricingMode === "fixed" && fixedPrice ? Number(fixedPrice) : null,
        notes: notes || null,
        packed_on: prefill?.packed_on ?? null,
        best_before: prefill?.best_before ?? null,
      });
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Neues Teilstück" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {prefill && (
          <div className="text-sm bg-forest-50 border border-forest-200 rounded-md px-3 py-2">
            <p className="text-forest-900 font-medium">Vom Etikett übernommen</p>
            <p className="text-forest-800 mt-0.5">
              Bitte kurz prüfen – die Texterkennung liegt nicht immer richtig.
            </p>
            {prefill.species && (
              <p className="text-forest-700 mt-1">Erkannte Wildart: {prefill.species}</p>
            )}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Bezeichnung</label>
          <select
            value={nameChoice}
            onChange={(e) => setNameChoice(e.target.value)}
            required
            className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Bitte wählen…
            </option>
            {Object.entries(CUT_PRESETS).map(([group, options]) => (
              <optgroup key={group} label={group}>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value={CUSTOM_NAME}>Andere Bezeichnung…</option>
          </select>
          {nameChoice === CUSTOM_NAME && (
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              required
              autoFocus
              placeholder="z. B. Rehrücken am Knochen"
              className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm mt-2"
            />
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Wildtier (optional)</label>
          <select
            value={animalId}
            onChange={(e) => setAnimalId(e.target.value)}
            className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">Kein Wildtier zugeordnet</option>
            {animals.map((a) => (
              <option key={a.id} value={a.id}>
                {a.species} – {formatDate(a.date_harvested)}
              </option>
            ))}
          </select>
        </div>
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
          <label className="block text-sm font-medium mb-1">Preis</label>
          <div className="flex gap-3 mb-2 text-sm">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={pricingMode === "perKg"}
                onChange={() => setPricingMode("perKg")}
              />
              pro kg
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={pricingMode === "fixed"}
                onChange={() => setPricingMode("fixed")}
              />
              Festpreis
            </label>
          </div>
          {pricingMode === "perKg" ? (
            <input
              type="number"
              step="0.01"
              value={pricePerKg}
              onChange={(e) => setPricePerKg(e.target.value)}
              placeholder="€ pro kg"
              className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm"
            />
          ) : (
            <input
              type="number"
              step="0.01"
              value={fixedPrice}
              onChange={(e) => setFixedPrice(e.target.value)}
              placeholder="€ gesamt"
              className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm"
            />
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Notizen</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm"
            rows={2}
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm rounded-md border border-stone-300">
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={saving || !name}
            className="px-3 py-2 text-sm rounded-md bg-forest-700 text-white hover:bg-forest-800 disabled:opacity-50"
          >
            Speichern
          </button>
        </div>
      </form>
    </Modal>
  );
}
