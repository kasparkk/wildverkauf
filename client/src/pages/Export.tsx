import { useState } from "react";

const SHEETS = [
  { name: "Bestand", detail: "Alle Teilstücke mit Preis, Status, Barcode und Daten" },
  { name: "Wildtiere", detail: "Erlegte Tiere mit Anzahl der Teilstücke" },
  { name: "Verkäufe", detail: "Belege mit Kunde, Zahlungsart und Summe" },
  { name: "Verkaufspositionen", detail: "Jede einzelne verkaufte Position" },
  { name: "Kunden", detail: "Kontaktdaten mit Anzahl Käufe und Umsatz" },
];

export default function Export() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const href = `/api/export${params.toString() ? `?${params}` : ""}`;

  function check(e: React.MouseEvent) {
    if (from && to && from > to) {
      e.preventDefault();
      setError("Das Startdatum liegt nach dem Enddatum.");
      return;
    }
    setError(null);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Export</h1>
        <p className="text-stone-500">
          Alle erfassten Daten als Excel-Datei herunterladen – z. B. für die Buchhaltung.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-5 space-y-4">
        <div>
          <p className="text-sm font-medium mb-1">Zeitraum (optional)</p>
          <p className="text-xs text-stone-500 mb-3">
            Schränkt die Verkäufe ein. Bestand und Kunden werden immer vollständig
            exportiert, da sie den aktuellen Stand zeigen.
          </p>
          <div className="flex flex-wrap gap-4">
            <div>
              <label htmlFor="from" className="block text-sm mb-1">
                Von
              </label>
              <input
                id="from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="border border-stone-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="to" className="block text-sm mb-1">
                Bis
              </label>
              <input
                id="to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="border border-stone-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <a
          href={href}
          onClick={check}
          className="inline-block px-4 py-2.5 text-sm rounded-md bg-forest-700 text-white hover:bg-forest-800"
        >
          Excel-Datei herunterladen
        </a>
      </div>

      <div className="bg-white rounded-lg border border-stone-200 shadow-sm">
        <div className="px-5 py-3 border-b border-stone-200">
          <h2 className="font-semibold">Enthaltene Tabellenblätter</h2>
        </div>
        <ul className="divide-y divide-stone-100">
          {SHEETS.map((sheet) => (
            <li key={sheet.name} className="px-5 py-3">
              <p className="font-medium text-sm">{sheet.name}</p>
              <p className="text-sm text-stone-500">{sheet.detail}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
