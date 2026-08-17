# Wildverkauf

Interne Web-App zur Verwaltung des Wildbretverkaufs: Bestand (Wildtiere &
Teilstücke), Verkauf/Kassensystem mit Belegdruck und Kundenverwaltung.
Läuft komplett auf Netlify.

## Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, React Router
- **Backend**: Netlify Function (`netlify/functions/api`), TypeScript
- **Datenbank**: Netlify DB (Postgres) – wird beim Deploy automatisch bereitgestellt

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

## Zugriffsschutz

Die App ist durch ein Passwort geschützt. Beim Login wird ein signiertes
Session-Cookie (HttpOnly, 30 Tage Gültigkeit) gesetzt; alle API-Aufrufe außer
Login/Logout erfordern eine gültige Session.

Dafür müssen zwei Umgebungsvariablen im Netlify-Projekt gesetzt sein:

| Variable         | Bedeutung                                              |
| ---------------- | ------------------------------------------------------ |
| `APP_PASSWORD`   | Das Passwort für die Anmeldung                          |
| `SESSION_SECRET` | Zufälliger Schlüssel zum Signieren der Session-Cookies  |

Fehlt eine davon, liefert die API bewusst einen Fehler statt ungeschützte Daten.

`SESSION_SECRET` neu erzeugen:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Wird `SESSION_SECRET` geändert, werden alle bestehenden Sessions ungültig.

## Datenbank

Das Schema liegt als Migration unter `netlify/database/migrations/`. Netlify
wendet neue Migrationen beim Deploy automatisch an. Für eine Änderung einen
neuen Ordner nach dem Muster `<nummer>_<slug>/migration.sql` anlegen – die
bestehenden Migrationen nicht nachträglich ändern.

## Lokale Entwicklung

```bash
npm install
npm install -g netlify-cli   # einmalig
netlify dev
```

`netlify dev` startet Vite, die Functions und eine lokale Datenbank-Branch
zusammen. Für den Login lokal `APP_PASSWORD` und `SESSION_SECRET` setzen,
z. B. in einer `.env`-Datei im Projektverzeichnis.

## Build

```bash
npm run build      # Typecheck der Function + Frontend-Build nach client/dist
```

Netlify nutzt genau diesen Befehl (siehe `netlify.toml`).
