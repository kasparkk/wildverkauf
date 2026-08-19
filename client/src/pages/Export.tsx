import { useState } from "react";

const SHEETS = [
  { key: "bestand", name: "Bestand", detail: "Alle Teilstücke mit Preis, Status, Barcode und Daten" },
  { key: "wildtiere", name: "Wildtiere", detail: "Erlegte Tiere mit Anzahl der Teilstücke" },
  { key: "verkaeufe", name: "Verkäufe", detail: "Belege mit Kunde, Zahlungsart und Summe" },
  { key: "positionen", name: "Verkaufspositionen", detail: "Jede einzelne verkaufte Position" },
  { key: "kunden", name: "Kunden", detail: "Kontaktdaten mit Anzahl Käufe und Umsatz" },
];

export default function Export() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [linkSheet, setLinkSheet] = useState(SHEETS[0].key);
  const [linkCopied, setLinkCopied] = useState(false);

  const rangeInvalid = Boolean(from && to && from > to);

  function query(extra: Record<string, string> = {}) {
    const params = new URLSearchParams(extra);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params.toString() ? `?${params}` : "";
  }

  function checkRange(e: React.MouseEvent) {
    if (rangeInvalid) {
      e.preventDefault();
      setError("Das Startdatum liegt nach dem Enddatum.");
      return;
    }
    setError(null);
  }

  /** Absolute address a spreadsheet can pull from and refresh on demand. */
  const linkUrl = `${window.location.origin}/api/export${query({
    format: "csv",
    sheet: linkSheet,
    locale: "neutral",
  })}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(linkUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 4000);
    } catch {
      setError("Die Adresse konnte nicht kopiert werden – du kannst sie von Hand markieren.");
    }
  }

  /** Copies the dataset as tab-separated text, which pastes into columns. */
  async function copySheet(key: string, name: string) {
    if (rangeInvalid) {
      setError("Das Startdatum liegt nach dem Enddatum.");
      return;
    }
    setError(null);
    setCopied(null);
    try {
      const res = await fetch(`/api/export${query({ format: "tsv", sheet: key })}`);
      if (!res.ok) throw new Error(`Fehler ${res.status}`);
      await navigator.clipboard.writeText(await res.text());
      setCopied(key);
      setTimeout(() => setCopied((current) => (current === key ? null : current)), 4000);
    } catch {
      setError(
        `„${name}“ konnte nicht kopiert werden. Manche Browser erlauben das nur über HTTPS – ` +
          "als Alternative funktioniert der CSV-Download."
      );
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Export</h1>
        <p className="text-stone-500">
          Daten als Excel-Datei herunterladen oder einzelne Tabellen direkt kopieren.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-5 space-y-4">
        <div>
          <p className="text-sm font-medium mb-1">Zeitraum (optional)</p>
          <p className="text-xs text-stone-500 mb-3">
            Schränkt die Verkäufe ein. Bestand und Kunden werden immer vollständig exportiert, da
            sie den aktuellen Stand zeigen.
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
          href={`/api/export${query()}`}
          onClick={checkRange}
          className="inline-block px-4 py-2.5 text-sm rounded-md bg-forest-700 text-white hover:bg-forest-800"
        >
          Alles als Excel-Datei herunterladen
        </a>
      </div>

      <div className="bg-white rounded-lg border border-stone-200 shadow-sm">
        <div className="px-5 py-3 border-b border-stone-200">
          <h2 className="font-semibold">Einzelne Tabellen</h2>
          <p className="text-sm text-stone-500 mt-0.5">
            „Kopieren“ legt die Tabelle in die Zwischenablage – in Excel oder Google Tabellen
            einfach einfügen, die Spalten stehen dann richtig.
          </p>
        </div>
        <ul className="divide-y divide-stone-100">
          {SHEETS.map((sheet) => (
            <li key={sheet.key} className="px-5 py-3 flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[12rem]">
                <p className="font-medium text-sm">{sheet.name}</p>
                <p className="text-sm text-stone-500">{sheet.detail}</p>
              </div>
              <div className="flex items-center gap-2">
                {copied === sheet.key && (
                  <span className="text-sm text-green-700">Kopiert.</span>
                )}
                <button
                  onClick={() => copySheet(sheet.key, sheet.name)}
                  className="px-3 py-1.5 text-sm rounded-md border border-forest-700 text-forest-700 hover:bg-forest-50"
                >
                  Kopieren
                </button>
                <a
                  href={`/api/export${query({ format: "csv", sheet: sheet.key })}`}
                  onClick={checkRange}
                  className="px-3 py-1.5 text-sm rounded-md border border-stone-300 hover:bg-stone-100"
                >
                  CSV
                </a>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white rounded-lg border border-stone-200 shadow-sm">
        <div className="px-5 py-3 border-b border-stone-200">
          <h2 className="font-semibold">Mit Excel verbinden</h2>
          <p className="text-sm text-stone-500 mt-0.5">
            Excel kann die Daten selbst von einer Adresse holen. Einmal einrichten, danach genügt in
            Excel ein Klick auf „Aktualisieren“ – ohne erneutes Herunterladen.
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label htmlFor="linkSheet" className="block text-sm font-medium mb-1">
              Datensatz
            </label>
            <select
              id="linkSheet"
              value={linkSheet}
              onChange={(e) => setLinkSheet(e.target.value)}
              className="border border-stone-300 rounded-md px-3 py-2 text-sm"
            >
              {SHEETS.map((sheet) => (
                <option key={sheet.key} value={sheet.key}>
                  {sheet.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-sm font-medium mb-1">Adresse</p>
            <div className="flex gap-2 items-start">
              <code className="flex-1 text-xs bg-stone-100 rounded-md px-3 py-2 break-all font-mono">
                {linkUrl}
              </code>
              <button
                onClick={copyLink}
                className="px-3 py-2 text-sm rounded-md border border-forest-700 text-forest-700 hover:bg-forest-50 whitespace-nowrap"
              >
                {linkCopied ? "Kopiert." : "Adresse kopieren"}
              </button>
            </div>
          </div>

          <div className="text-sm text-stone-600 space-y-3">
            <div>
              <p className="font-medium text-stone-900">In Excel</p>
              <ol className="list-decimal list-inside space-y-0.5 mt-1">
                <li>Reiter „Daten“ → „Daten abrufen“ → „Aus anderen Quellen“ → „Aus dem Web“</li>
                <li>Adresse einfügen und bestätigen</li>
                <li>Im Vorschaufenster auf „Laden“ klicken</li>
                <li>
                  Später aktualisieren: Reiter „Daten“ → „Alle aktualisieren“
                </li>
              </ol>
            </div>
            <div>
              <p className="font-medium text-stone-900">In Google Tabellen</p>
              <p className="mt-1">
                In eine leere Zelle schreiben:{" "}
                <code className="text-xs bg-stone-100 rounded px-1.5 py-0.5 font-mono">
                  =IMPORTDATA("…Adresse…")
                </code>{" "}
                – die Tabelle aktualisiert sich dann von selbst.
              </p>
            </div>
          </div>

          <p className="text-xs text-stone-500 border-t border-stone-100 pt-3">
            Die Adresse liefert die Zahlen maschinenlesbar (Punkt als Dezimalzeichen, Datum als
            JJJJ-MM-TT), damit Excel sie beim Import als Zahl und Datum erkennt und nicht als Text.
            Wer die Adresse kennt, kann diese Daten abrufen – behandle sie wie ein Passwort.
          </p>
        </div>
      </div>
    </div>
  );
}
