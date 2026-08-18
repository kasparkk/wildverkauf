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

Der Passwortschutz wird allein über Umgebungsvariablen gesteuert:

| Variable         | Bedeutung                                              |
| ---------------- | ------------------------------------------------------ |
| `APP_PASSWORD`   | Passwort für die Anmeldung – **steuert den Schutz**    |
| `SESSION_SECRET` | Zufälliger Schlüssel zum Signieren der Session-Cookies  |

- **Ist `APP_PASSWORD` gesetzt**, verlangt die App eine Anmeldung. Beim Login
  wird ein signiertes Session-Cookie (HttpOnly, 30 Tage) gesetzt; alle
  API-Aufrufe außer Login/Logout erfordern eine gültige Session.
- **Ist `APP_PASSWORD` nicht gesetzt**, läuft die App offen – ohne Login und
  ohne Abmelden-Knopf. Achtung: Dann kommt jeder mit der URL an sämtliche
  Daten, auch an die Kundendaten.

Ist `APP_PASSWORD` gesetzt, `SESSION_SECRET` aber nicht, liefert die API
bewusst einen Fehler, statt die Daten ungeschützt auszuliefern.

Schutz wieder einschalten: `APP_PASSWORD` im Netlify-Projekt setzen und neu
deployen. `SESSION_SECRET` neu erzeugen:

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

## App-Icon

`client/public/icon.svg` ist die Quelle für alle Icons; die PNG-Varianten
(`icon-180/192/512.png`) sind daraus gerendert. Wird das SVG geändert, müssen
die PNGs neu erzeugt werden.

Die Hirsch-Grafik stammt aus [Tabler Icons](https://tabler.io/icons)
(Copyright © 2020–2024 Paweł Kuna) und steht unter der MIT-Lizenz – frei
verwendbar, auch kommerziell. Hintergrund und Farbgebung sind projekteigen.
