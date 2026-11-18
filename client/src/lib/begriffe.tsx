import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";

/**
 * Die Woerter, mit denen die App ueber den Bestand spricht. Urspruenglich
 * fest auf Wild (Wildtier, Teilstueck, Wildart ...); jetzt in den
 * Einstellungen waehlbar, damit dieselbe App auch fuer Hofladen, Imkerei
 * oder Marktstand passt. Gespeichert als JSON unter dem Einstellungs-
 * schluessel "begriffe"; zusaetzlich im Browser zwischengespeichert, damit
 * App-Name und Begriffe sofort stimmen, auch vor dem Laden.
 */
export interface Begriffe {
  vorlage: string;
  app: string; // Name der App
  gruppe: string; // z. B. Wildtier, Charge, Ernte
  gruppen: string;
  stueck: string; // z. B. Teilstueck, Artikel, Glas
  stuecke: string;
  art: string; // z. B. Wildart, Sorte
  datum: string; // z. B. Erlegt am, Erzeugt am
  gruppenGewicht: string; // z. B. Wildbretgewicht
  lagerHinweis: string; // Zeile auf dem Etikett, leer = keine
  arten: string[]; // Auswahl beim Anlegen einer Gruppe; leer = freies Feld
  stueckVorschlaege: Record<string, string[]>; // Auswahl beim Anlegen eines Stuecks
}

export const VORLAGEN: Record<string, { name: string; begriffe: Begriffe }> = {
  wild: {
    name: "Wild (Jagd)",
    begriffe: {
      vorlage: "wild",
      app: "Wildverkauf",
      gruppe: "Wildtier",
      gruppen: "Wildtiere",
      stueck: "Teilstück",
      stuecke: "Teilstücke",
      art: "Wildart",
      datum: "Erlegt am",
      gruppenGewicht: "Wildbretgewicht",
      lagerHinweis: "Kühl lagern bei max. 7 °C",
      arten: ["Reh", "Rothirsch", "Wildschwein", "Hase", "Fasan", "Ente", "Sonstiges"],
      stueckVorschlaege: {
        Edelteile: ["Rücken", "Filet", "Keule", "Blatt (Schulter)", "Nuss", "Oberschale"],
        Verarbeitet: ["Gulasch", "Braten", "Ragout", "Geschnetzeltes", "Hackfleisch"],
        Wurst: ["Bratwurst", "Salami", "Leberwurst"],
        Sonstiges: ["Rippchen", "Suppenknochen", "Leber", "Ganzes Tier", "Hälfte"],
      },
    },
  },
  hofladen: {
    name: "Hofladen / Direktvermarktung",
    begriffe: {
      vorlage: "hofladen",
      app: "Hofladen",
      gruppe: "Charge",
      gruppen: "Chargen",
      stueck: "Artikel",
      stuecke: "Artikel",
      art: "Sorte",
      datum: "Erzeugt am",
      gruppenGewicht: "Gesamtgewicht",
      lagerHinweis: "",
      arten: [],
      stueckVorschlaege: {},
    },
  },
  imkerei: {
    name: "Imkerei",
    begriffe: {
      vorlage: "imkerei",
      app: "Imkerei",
      gruppe: "Ernte",
      gruppen: "Ernten",
      stueck: "Glas",
      stuecke: "Gläser",
      art: "Honigsorte",
      datum: "Geerntet am",
      gruppenGewicht: "Erntemenge",
      lagerHinweis: "Trocken und nicht über 20 °C lagern",
      arten: ["Frühtracht", "Sommertracht", "Rapshonig", "Akazienhonig", "Waldhonig", "Lindenhonig"],
      stueckVorschlaege: { Gläser: ["250 g", "500 g", "1 kg"] },
    },
  },
};

const STANDARD = VORLAGEN.wild.begriffe;
const SPEICHER = "begriffe";

function ausSpeicher(): Begriffe {
  try {
    const roh = localStorage.getItem(SPEICHER);
    return roh ? { ...STANDARD, ...JSON.parse(roh) } : STANDARD;
  } catch {
    return STANDARD;
  }
}

function merken(b: Begriffe) {
  try {
    localStorage.setItem(SPEICHER, JSON.stringify(b));
  } catch {
    // Kein Speicher (privater Modus): dann eben beim naechsten Laden vom Server.
  }
}

/** Liest den Einstellungswert "begriffe" (JSON-Text) robust ein. */
export function begriffeAus(text: string | null | undefined): Begriffe {
  if (!text) return STANDARD;
  try {
    return { ...STANDARD, ...JSON.parse(text) };
  } catch {
    return STANDARD;
  }
}

const Kontext = createContext<{ b: Begriffe; setzen: (b: Begriffe) => void }>({
  b: STANDARD,
  setzen: () => {},
});

export function BegriffeProvider({ children, angemeldet }: { children: ReactNode; angemeldet: boolean }) {
  const [b, setB] = useState<Begriffe>(ausSpeicher);

  const setzen = useCallback((neu: Begriffe) => {
    setB(neu);
    merken(neu);
  }, []);

  useEffect(() => {
    if (!angemeldet) return;
    api
      .get<{ begriffe?: string }>("/settings")
      .then((s) => setzen(begriffeAus(s.begriffe)))
      .catch(() => {});
  }, [angemeldet, setzen]);

  useEffect(() => {
    document.title = b.app;
  }, [b.app]);

  return <Kontext.Provider value={{ b, setzen }}>{children}</Kontext.Provider>;
}

export const useBegriffe = () => useContext(Kontext);
