# Wildverkauf

Interne Web-App zur Verwaltung des Wildbretverkaufs: Bestand (Wildtiere &
Teilstücke), Verkauf/Kassensystem mit Belegdruck und Kundenverwaltung.

## Stack

- **Backend**: Node.js, Express, TypeScript, SQLite (`better-sqlite3`)
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, React Router

Die Daten werden lokal in `server/data/wildverkauf.sqlite` gespeichert.

## Funktionen

- **Bestand**: Wildtiere erfassen (Wildart, Erlegungsdatum, Gewicht) und in
  Teilstücke aufteilen (z. B. Rehrücken, Keule, Gulasch) mit Preis pro kg
  oder Festpreis. Status: verfügbar / reserviert / verkauft.
- **Verkauf**: Kassenoberfläche – Teilstücke oder freie Posten in den
  Warenkorb legen, Kunde zuordnen (oder Laufkundschaft), Zahlungsart und
  -status wählen, Verkauf abschließen. Verkaufte Teilstücke werden
  automatisch als "verkauft" markiert.
- **Verkäufe**: Historie aller Verkäufe inkl. druckbarem Beleg, Zahlungsstatus
  umschalten, Stornieren (Teilstücke werden wieder verfügbar).
- **Kunden**: Kontakte verwalten, Bestellhistorie pro Kunde einsehen.
- **Übersicht**: Lagerwert, Umsatz im laufenden Monat, offene Zahlungen,
  Bestandsübersicht.

## Entwicklung

```bash
npm install

# Backend (Port 3001) und Frontend (Port 5173) parallel in zwei Terminals:
npm run dev:server
npm run dev:client
```

Die Vite-Dev-App proxyt `/api`-Aufrufe automatisch an den Server.

## Produktion

```bash
npm run build     # baut Server (dist/) und Client (client/dist)
npm start         # startet den Server auf Port 3001, der die gebaute
                   # Frontend-App mit ausliefert
```

`PORT` kann per Umgebungsvariable angepasst werden.
