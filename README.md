# Einsatz-Lageboard V2

Komplett neu aufgebaute, mobile und offlinefähige Einsatzdokumentation mit Atemschutzüberwachung nach FwDV 7.

## Neue Bedienoberfläche

- klar getrennte Bereiche für Übersicht, Trupps und Chronik
- feste mobile Navigation am unteren Bildschirmrand
- sichtbare Versionskennung `V2.0`
- große Touchflächen und kontrastreiche Statusdarstellung
- zentrale Atemschutztafel mit allen aktiven PA-Trupps
- Warnleiste für fällige Kontrollen

## Funktionen

- Einsatznummer, Stichwort und Einsatzstelle
- dokumentierter Einsatzstart und Einsatzabschluss
- schnelle Auftragserfassung über MR, BK, BR oder Freitext
- Geschossauswahl bei Menschenrettung mit freier Alternative
- Truppstatus und wiederholte Atemschutzeinsätze
- Geräteträger, Geräteart, Startdrücke und Nennfülldruck
- einstellbare erwartete Einsatzzeit
- 1/3- und 2/3-Kontrolle mit Druckwerten und Rückmeldung
- Einsatzziel, Rückzug und Ende des Atemschutzeinsatzes
- akustische Warnung und Vibration, soweit unterstützt
- automatische Einsatzchronik
- vollständiger TXT-Bericht, der mit Word geöffnet werden kann
- ausschließlich lokale Speicherung im Browser
- Datenübernahme aus der bisherigen V1, sofern lokal vorhanden

## Upload zu GitHub

Den Inhalt dieses Ordners in das Stammverzeichnis des GitHub-Repositorys hochladen. Vorhandene Dateien gleichen Namens müssen ersetzt werden. Nicht nur die ZIP-Datei hochladen.

Die neue Version verwendet bewusst die Dateinamen `app-v2.js` und `ui-v2.css`. Zusätzlich ersetzt sie `index.html`, `service-worker.js`, `manifest.webmanifest` und den Ordner `assets`.

Nach dem Upload GitHub Pages einmal mit `Strg + F5` neu laden. Ob die richtige Version aktiv ist, erkennt man oben neben dem Namen an `V2.0`.

## Lokal testen

```bash
python3 -m http.server 8080
```

Danach `http://localhost:8080` öffnen.

## Sicherheitshinweis

Die Zeitüberwachung ist ein unterstützendes Hilfsmittel. Sie ersetzt weder die Kontrolle der Behälterdrücke und die Funkmeldungen noch die Beurteilung von Luftverbrauch, Rückweg und Einsatzlage. Vor einem verbindlichen Einsatzbetrieb sind Praxistests, eine Datenschutzprüfung und eine Freigabe durch die verantwortliche Organisation erforderlich.

Grundlage: [FwDV 7, Ausgabe 2002 mit Änderungen 2005](https://www.lfs-bw.de/fileadmin/LFS-BW/themen/gesetze_vorschriften/fwdv/dokumente/FwDV_7.pdf)
