# Einsatz-Lageboard

Mobile, offlinefähige Grundbasis für ein digitales Feuerwehr-Lageboard. Alle Einsatzdaten werden ausschließlich im Browser des verwendeten Geräts gespeichert.

## Enthalten

- Einsatzgrunddaten und Laufzeit
- Trupps, Aufträge und Status
- Atemschutz-Timer pro Trupp
- automatische Einsatzchronik
- lokaler JSON-Export
- Offlinebetrieb als Progressive Web App
- responsive Darstellung für Smartphone und Tablet

## Lokal starten

Ein lokaler Webserver ist notwendig, damit der Service Worker funktioniert:

```bash
python3 -m http.server 8080
```

Danach `http://localhost:8080` öffnen.

## GitHub Pages

Das Repository kann ohne Build-Schritt über GitHub Pages veröffentlicht werden:

1. In GitHub `Settings` öffnen.
2. Unter `Pages` als Quelle `Deploy from a branch` auswählen.
3. Branch `main` und Ordner `/ (root)` auswählen.
4. Nach der Veröffentlichung die Seite einmal online öffnen und zum Startbildschirm hinzufügen.

## Datenschutz

Die Anwendung besitzt kein Backend und überträgt keine Eingaben an GitHub. Trotzdem sollten in dieser frühen Version keine Patienten- oder besonders schützenswerten personenbezogenen Daten erfasst werden.

## Status

Früher Prototyp, nicht für den verbindlichen Einsatzbetrieb freigegeben. Vor einer realen Nutzung sind unter anderem Praxistests, ein belastbares Sicherungskonzept und eine Datenschutzprüfung erforderlich.
