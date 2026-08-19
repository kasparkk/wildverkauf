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
- **Etiketten**: Teilstücke auswählen und Etiketten auf A4-Bögen drucken
  (70 × 37 mm, 24 pro Bogen – z. B. Herma 4459 / Avery 3474). Auf dem Etikett
  stehen Wildart, Teilstück, Gewicht, Preis, Erlegungs-, Verpackungs- und
  Mindesthaltbarkeitsdatum, die Betriebsangaben und ein QR-Code.
- **Code scannen**: Im Verkauf liest die Kamera sowohl den QR-Code eigener
  Etiketten als auch gängige Strichcodes (EAN-13, EAN-8, UPC, Code 128,
  Code 39, ITF). Ein unbekannter Strichcode kann einmalig einem Teilstück
  zugeordnet werden und wird ab dann direkt erkannt.
- **Etikett abfotografieren**: Fremde Etiketten (z. B. vom Zerlegebetrieb)
  werden per Texterkennung ausgelesen und füllen das Formular für ein neues
  Teilstück vor.

## Etiketten

Das Druckformat ist auf A4-Bögen mit 70 × 37 mm ausgelegt (3 Spalten × 8 Zeilen)
und in `client/src/index.css` unter „Label sheet“ definiert. Für ein anderes
Bogenformat dort die Millimeterwerte und in `client/src/lib/labels.ts` die
Rasterangaben anpassen. Im Druckdialog müssen Ränder auf „keine“ und die
Skalierung auf 100 % stehen, sonst verrutschen die Etiketten.

Der QR-Code enthält `wv:cut:<id>` – also nur die interne Nummer des Teilstücks,
keine Kundendaten.

## Codes scannen

Der Scanner nutzt die im Browser eingebaute Erkennung (`BarcodeDetector`), wo
es sie gibt. Safari auf dem iPhone hat sie nicht; dort wird ZXing nachgeladen –
erst beim Öffnen des Scanners, damit es den normalen Seitenaufruf nicht
verlangsamt.

Fremde Strichcodes werden über die Spalte `cuts.barcode` einem Teilstück
zugeordnet. Ein Code kann immer nur zu einem Teilstück gehören (eindeutiger
Index `idx_cuts_barcode`); ein Zweitversuch wird mit einer entsprechenden
Meldung abgelehnt. Zuordnungen lassen sich im Bestand wieder lösen.

## Texterkennung (optional)

Das Abfotografieren fremder Etiketten läuft über die Claude-API und ist nur
aktiv, wenn im Netlify-Projekt die Variable `ANTHROPIC_API_KEY` gesetzt ist.
Fehlt sie, meldet die App das verständlich und alles andere funktioniert
weiter. Jeder Scan verursacht Kosten nach Anthropic-Preisliste; das Foto wird
vor dem Hochladen im Browser auf max. 1600 px verkleinert.

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
