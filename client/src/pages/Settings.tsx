import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Settings as SettingsData } from "../lib/types";
import { useBegriffe, VORLAGEN, type Begriffe } from "../lib/begriffe";

// Felder der Begriffe, die man direkt eintippen kann
const BEGRIFF_FELDER: Array<[keyof Begriffe, string]> = [
  ["app", "Name der App"],
  ["gruppe", "Gruppe (Einzahl), z. B. Wildtier, Charge, Ernte"],
  ["gruppen", "Gruppe (Mehrzahl)"],
  ["stueck", "Einzelstück (Einzahl), z. B. Teilstück, Artikel, Glas"],
  ["stuecke", "Einzelstück (Mehrzahl)"],
  ["art", "Art/Sorte, z. B. Wildart, Sorte"],
  ["datum", "Datum der Gruppe, z. B. Erlegt am, Erzeugt am"],
  ["gruppenGewicht", "Gewicht der Gruppe, z. B. Wildbretgewicht"],
  ["lagerHinweis", "Lagerhinweis auf dem Etikett (leer = keiner)"],
];

// Vorschlaege als Text: eine Zeile je Gruppe, "Gruppe: a, b, c"
const vorschlaegeAlsText = (v: Record<string, string[]>) =>
  Object.entries(v).map(([g, l]) => `${g}: ${l.join(", ")}`).join("\n");
const vorschlaegeAusText = (t: string) =>
  Object.fromEntries(
    t
      .split("\n")
      .map((zeile) => zeile.split(":"))
      .filter(([g, l]) => g?.trim() && l?.trim())
      .map(([g, l]) => [g.trim(), l.split(",").map((x) => x.trim()).filter(Boolean)])
  );

export default function Settings() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { b, setzen } = useBegriffe();
  const [begriffe, setBegriffe] = useState<Begriffe>(b);
  const [artenText, setArtenText] = useState(b.arten.join(", "));
  const [vorschlagText, setVorschlagText] = useState(vorschlaegeAlsText(b.stueckVorschlaege));

  function vorlageWaehlen(schluessel: string) {
    const v = VORLAGEN[schluessel]?.begriffe;
    if (!v) return;
    setBegriffe(v);
    setArtenText(v.arten.join(", "));
    setVorschlagText(vorschlaegeAlsText(v.stueckVorschlaege));
  }

  useEffect(() => {
    api
      .get<SettingsData>("/settings")
      .then(setSettings)
      .catch((e) => setError(e.message));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    const neueBegriffe: Begriffe = {
      ...begriffe,
      arten: artenText.split(",").map((x) => x.trim()).filter(Boolean),
      stueckVorschlaege: vorschlaegeAusText(vorschlagText),
    };
    try {
      const updated = await api.put<SettingsData>("/settings", {
        business_name: settings.business_name,
        business_address: settings.business_address,
        shelf_life_days: settings.shelf_life_days,
        begriffe: JSON.stringify(neueBegriffe),
      });
      setSettings(updated);
      setzen(neueBegriffe);
      setSaved(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (error && !settings) return <p className="text-red-600">Fehler: {error}</p>;
  if (!settings) return <p className="text-stone-500">Lade…</p>;

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Einstellungen</h1>
        <p className="text-stone-500">Angaben, die auf die gedruckten Etiketten kommen.</p>
      </div>

      <form onSubmit={submit} className="bg-white rounded-lg border border-stone-200 shadow-sm p-5 space-y-4">
        <div>
          <label htmlFor="business_name" className="block text-sm font-medium mb-1">
            Betriebsname
          </label>
          <input
            id="business_name"
            type="text"
            value={settings.business_name}
            onChange={(e) => setSettings({ ...settings, business_name: e.target.value })}
            placeholder="z. B. Jagdrevier Musterhausen"
            className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="business_address" className="block text-sm font-medium mb-1">
            Anschrift
          </label>
          <textarea
            id="business_address"
            value={settings.business_address}
            onChange={(e) => setSettings({ ...settings, business_address: e.target.value })}
            rows={2}
            placeholder="Dorfstraße 1, 12345 Musterdorf"
            className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm"
          />
          <p className="text-xs text-stone-500 mt-1">
            Name und Anschrift stehen beim Verkauf an Kunden auf jedem Etikett.
          </p>
        </div>

        <div>
          <label htmlFor="shelf_life_days" className="block text-sm font-medium mb-1">
            Haltbarkeit ab Verpackung (Tage)
          </label>
          <input
            id="shelf_life_days"
            type="number"
            min="1"
            value={settings.shelf_life_days}
            onChange={(e) =>
              setSettings({ ...settings, shelf_life_days: Number(e.target.value) })
            }
            className="w-32 border border-stone-300 rounded-md px-3 py-2 text-sm"
          />
          <p className="text-xs text-stone-500 mt-1">
            Daraus wird beim Etikettendruck das Mindesthaltbarkeitsdatum berechnet.
          </p>
        </div>

        <div className="border-t border-stone-200 pt-4 space-y-3">
          <div>
            <h2 className="font-semibold">Begriffe</h2>
            <p className="text-xs text-stone-500">
              Wie die App deinen Bestand nennt. Mit einer Vorlage anfangen und bei Bedarf anpassen.
            </p>
          </div>
          <div>
            <label htmlFor="vorlage" className="block text-sm font-medium mb-1">Vorlage</label>
            <select
              id="vorlage"
              value={VORLAGEN[begriffe.vorlage] ? begriffe.vorlage : ""}
              onChange={(e) => vorlageWaehlen(e.target.value)}
              className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="" disabled>Eigene Begriffe</option>
              {Object.entries(VORLAGEN).map(([schluessel, v]) => (
                <option key={schluessel} value={schluessel}>{v.name}</option>
              ))}
            </select>
          </div>
          {BEGRIFF_FELDER.map(([feld, beschriftung]) => (
            <div key={feld}>
              <label htmlFor={`b-${feld}`} className="block text-sm font-medium mb-1">{beschriftung}</label>
              <input
                id={`b-${feld}`}
                type="text"
                value={String(begriffe[feld] ?? "")}
                onChange={(e) => setBegriffe({ ...begriffe, [feld]: e.target.value, vorlage: "eigen" })}
                className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          ))}
          <div>
            <label htmlFor="b-arten" className="block text-sm font-medium mb-1">
              Auswahl für „{begriffe.art}“ (durch Komma getrennt, leer = freies Feld)
            </label>
            <input
              id="b-arten"
              type="text"
              value={artenText}
              onChange={(e) => setArtenText(e.target.value)}
              className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="b-vorschlaege" className="block text-sm font-medium mb-1">
              Vorschläge für „{begriffe.stueck}“ (je Zeile „Gruppe: a, b, c“)
            </label>
            <textarea
              id="b-vorschlaege"
              value={vorschlagText}
              onChange={(e) => setVorschlagText(e.target.value)}
              rows={4}
              className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm font-mono"
            />
          </div>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-3 py-2 text-sm rounded-md bg-forest-700 text-white hover:bg-forest-800 disabled:opacity-50"
          >
            Speichern
          </button>
          {saved && <span className="text-sm text-green-700">Gespeichert.</span>}
        </div>
      </form>

      <p className="text-xs text-stone-500">
        Hinweis: Beim Verkauf von Lebensmitteln an Endkunden gibt es gesetzliche Vorgaben dazu, was auf
        dem Etikett stehen muss. Prüfe die Angaben bitte mit deiner zuständigen Behörde ab – die App
        druckt, was du hier einträgst.
      </p>
    </div>
  );
}
