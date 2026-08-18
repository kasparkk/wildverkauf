import { useEffect, useMemo, useState } from "react";
import { api, cutPrice, formatCurrency, formatDate } from "../lib/api";
import { Cut, Settings } from "../lib/types";
import {
  LABELS_PER_SHEET,
  LABEL_SHEET,
  addDays,
  qrDataUrl,
  today,
} from "../lib/labels";

export default function Labels() {
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [packedOn, setPackedOn] = useState(today());
  const [qrCodes, setQrCodes] = useState<Record<number, string>>({});
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Cut[]>("/cuts").then(setCuts).catch((e) => setError(e.message));
    api.get<Settings>("/settings").then(setSettings).catch((e) => setError(e.message));
  }, []);

  const bestBefore = useMemo(
    () => (settings ? addDays(packedOn, settings.shelf_life_days) : ""),
    [packedOn, settings]
  );

  const selectedCuts = useMemo(
    () => cuts.filter((cut) => selected.has(cut.id)),
    [cuts, selected]
  );

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === cuts.length ? new Set() : new Set(cuts.map((c) => c.id))));
  }

  /**
   * Stamps the dates onto the selected cuts, renders their QR codes and then
   * opens the print dialog, so the printed label matches what is stored.
   */
  async function prepareAndPrint() {
    if (selectedCuts.length === 0 || !settings) return;
    setPreparing(true);
    setError(null);
    try {
      const ids = selectedCuts.map((cut) => cut.id);
      await api.post("/labels", { cut_ids: ids, packed_on: packedOn, best_before: bestBefore });

      const codes: Record<number, string> = {};
      for (const id of ids) codes[id] = await qrDataUrl(id);
      setQrCodes(codes);

      setCuts((prev) =>
        prev.map((cut) =>
          selected.has(cut.id) ? { ...cut, packed_on: packedOn, best_before: bestBefore } : cut
        )
      );

      // Let React paint the label sheet before the print dialog opens.
      await new Promise((resolve) => setTimeout(resolve, 150));
      window.print();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPreparing(false);
    }
  }

  const sheetsNeeded = Math.ceil(selectedCuts.length / LABELS_PER_SHEET) || 0;
  const ready = selectedCuts.length > 0 && Object.keys(qrCodes).length === selectedCuts.length;

  return (
    <div className="space-y-6">
      <div className="no-print space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Etiketten</h1>
          <p className="text-stone-500">
            Teilstücke auswählen und Etiketten auf A4-Bögen drucken ({LABEL_SHEET.widthMm} ×{" "}
            {LABEL_SHEET.heightMm} mm, {LABELS_PER_SHEET} pro Bogen).
          </p>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        {settings && !settings.business_name && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            Es sind noch keine Betriebsangaben hinterlegt. Beim Verkauf an Kunden gehören Name und
            Anschrift auf das Etikett – du kannst sie unter „Einstellungen“ eintragen.
          </p>
        )}

        <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-4 flex flex-wrap gap-4 items-end">
          <div>
            <label htmlFor="packed" className="block text-sm font-medium mb-1">
              Verpackt am
            </label>
            <input
              id="packed"
              type="date"
              value={packedOn}
              onChange={(e) => setPackedOn(e.target.value)}
              className="border border-stone-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <span className="block text-sm font-medium mb-1">Mindestens haltbar bis</span>
            <p className="px-3 py-2 text-sm text-stone-600">
              {bestBefore ? formatDate(bestBefore) : "–"}
              {settings && (
                <span className="text-stone-400"> ({settings.shelf_life_days} Tage)</span>
              )}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-sm text-stone-600 mb-1">
              {selectedCuts.length} ausgewählt
              {sheetsNeeded > 0 && ` · ${sheetsNeeded} Bogen`}
            </p>
            <button
              onClick={prepareAndPrint}
              disabled={selectedCuts.length === 0 || preparing}
              className="px-4 py-2 text-sm rounded-md bg-forest-700 text-white hover:bg-forest-800 disabled:opacity-50"
            >
              {preparing ? "Bereite vor…" : "Etiketten drucken"}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-stone-500 border-b border-stone-200">
                <th className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={cuts.length > 0 && selected.size === cuts.length}
                    onChange={toggleAll}
                    aria-label="Alle auswählen"
                  />
                </th>
                <th className="px-4 py-2 font-medium">Teilstück</th>
                <th className="px-4 py-2 font-medium">Wildart</th>
                <th className="px-4 py-2 font-medium">Gewicht</th>
                <th className="px-4 py-2 font-medium">Preis</th>
                <th className="px-4 py-2 font-medium">Zuletzt etikettiert</th>
              </tr>
            </thead>
            <tbody>
              {cuts.map((cut) => (
                <tr key={cut.id} className="border-t border-stone-100 hover:bg-stone-50">
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(cut.id)}
                      onChange={() => toggle(cut.id)}
                      aria-label={`${cut.name} auswählen`}
                    />
                  </td>
                  <td className="px-4 py-2 font-medium">{cut.name}</td>
                  <td className="px-4 py-2 text-stone-500">{cut.animal_species ?? "–"}</td>
                  <td className="px-4 py-2">{cut.weight_kg != null ? `${cut.weight_kg} kg` : "–"}</td>
                  <td className="px-4 py-2">{formatCurrency(cutPrice(cut))}</td>
                  <td className="px-4 py-2 text-stone-500">
                    {cut.packed_on ? formatDate(cut.packed_on) : "–"}
                  </td>
                </tr>
              ))}
              {cuts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-stone-400">
                    Keine Teilstücke im Bestand.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {ready && (
        <LabelSheet cuts={selectedCuts} settings={settings!} qrCodes={qrCodes} bestBefore={bestBefore} packedOn={packedOn} />
      )}
    </div>
  );
}

function LabelSheet({
  cuts,
  settings,
  qrCodes,
  packedOn,
  bestBefore,
}: {
  cuts: Cut[];
  settings: Settings;
  qrCodes: Record<number, string>;
  packedOn: string;
  bestBefore: string;
}) {
  return (
    <div className="label-sheet">
      {cuts.map((cut) => (
        <div key={cut.id} className="label">
          <div className="label-text">
            <div className="label-title">
              {cut.animal_species ? `${cut.animal_species} · ` : ""}
              {cut.name}
            </div>
            <div className="label-line label-strong">
              {cut.weight_kg != null ? `${cut.weight_kg.toLocaleString("de-DE")} kg` : ""}
              {cut.weight_kg != null ? " · " : ""}
              {formatCurrency(cutPrice(cut))}
            </div>
            {cut.animal_date && <div className="label-line">Erlegt: {formatDate(cut.animal_date)}</div>}
            <div className="label-line">Verpackt: {formatDate(packedOn)}</div>
            <div className="label-line label-strong">Mindestens haltbar bis: {formatDate(bestBefore)}</div>
            <div className="label-line">Kühl lagern bei max. 7 °C</div>
            <div className="label-business">
              {settings.business_name}
              {settings.business_address ? `, ${settings.business_address.replace(/\n/g, ", ")}` : ""}
            </div>
          </div>
          <img className="label-qr" src={qrCodes[cut.id]} alt="" />
        </div>
      ))}
    </div>
  );
}
