import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Settings as SettingsData } from "../lib/types";

export default function Settings() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    try {
      const updated = await api.put<SettingsData>("/settings", {
        business_name: settings.business_name,
        business_address: settings.business_address,
        shelf_life_days: settings.shelf_life_days,
      });
      setSettings(updated);
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
        Hinweis: Beim Verkauf von Wildbret an Endkunden gibt es gesetzliche Vorgaben dazu, was auf
        dem Etikett stehen muss. Prüfe die Angaben bitte mit deiner zuständigen Behörde ab – die App
        druckt, was du hier einträgst.
      </p>
    </div>
  );
}
