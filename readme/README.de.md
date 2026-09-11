# Character Frame Animation — Sprite-Frame-Animations-Viewer

Spielt einen **exportierten 2D-Charakterordner** in hoardodile ab: bildgenaue
Sprite-Animation, Aktionswechsel und das pro Frame ausgelöste Charakter-Audio.

Charaktere sind 2D-Sprite-Animationen (fünf Zeichenebenen mit Sprite-Wechsel-Kurven
plus Position/Skalierung/Rotation, 30 fps, rund 150 Sprites und 75 Aktionen pro
Charakter). Das Exportformat ist in `docs/format.md` dokumentiert; das
Exportwerkzeug selbst ist ein separates, nicht öffentliches Projekt und nicht Teil
dieses Repositorys.

## Funktionen

- Erkennt zwei Ressourcenformen: einen **in sich geschlossenen Charakterordner**
  (`character.json` im Wurzelverzeichnis — einzeln behalt- oder löschbar) und einen
  **Sammelordner** (`catalog.json`, mit Charakterauswahl).
- Viewer: Aktionsliste nach Idle/Bewegung/Angriff/Skill/Treffer/Zustand gruppiert,
  Canvas-Frame-Player (Play/Pause, Einzelbild, Neustart, Tempo, Zoom, Schleife,
  Hilfslinien, Zeitleiste), aktuelles Bild und Anzahl gezeichneter Ebenen.
- Charakter-Audio: die Sound-Events, die der Export pro Frame auslöst, mit
  wiederhergestelltem Pegel (Werte ungleich 1.0 zeigen ein `x0.80`-Badge), abspielbar
  sobald sie auf ein Sample zeigen, inklusive vollständigem Auflösungsstatus
  (unaufgelöste werden angezeigt, nicht versteckt).
- Karte: `cover.png` als Cover, lokalisierte Ecktexte über Manifest-i18n-Keys.

## Voraussetzungen

- hoardodile ≥ 0.2.0.
- Ein exportierter Charakter- oder Sammelordner. Das Plugin liefert keine Daten mit.
- Vertraue dem Repository, bevor du installierst — Plugin-Code läuft serverseitig in
  einer Sandbox.
