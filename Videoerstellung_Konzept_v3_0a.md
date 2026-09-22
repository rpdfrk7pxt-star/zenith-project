# Videoerstellung — geparktes Konzept

**Stand:** 22.09.2026 · **Version:** v3_0a · **Status:** geparkt, nicht umgesetzt

Dieses Dokument hält fest, was das Thema „Videoerstellung" war und wie es sich
umsetzen lässt, nachdem die Konfigurator-App (`index_v3_0a.html`) fertig ist.

---

## 1. Worum es ging

Aus der App soll ein **fertiges Video** des Ferrari 812 GTS entstehen: eine
Kamerafahrt um das konfigurierte Fahrzeug, unterlegt mit Musik aus MP3-Dateien,
die Leo besitzt. Das Video soll teilbar sein (iPhone-Fotomediathek, Messenger).

Verwandt, aber nicht dasselbe: die Gestaltungsrichtung **C) Cinematic** aus dem
Vorgängerchat — dunkler Startbildschirm, „Tap to start", Kamerafahrt, Musik setzt
ein, Bedienelemente blenden sich ein. Das ist ein **Erlebnis in der App**, kein
exportierbares Video. Beides wurde im Gespräch vermischt und ist hier getrennt.

| | Cinematic-Modus | Videoexport |
|---|---|---|
| Ergebnis | Erlebnis in der App | MP4/WebM-Datei |
| Musik | Web Audio, spielt live | in die Datei gemuxt |
| Aufwand | gering | mittel bis hoch |
| Teilbar | nur als Link | als Datei |

---

## 2. Was die Grundlage heute schon hergibt

Die Arbeit an `ferrari_812_gts_v3_0a.glb` und `index_v3_0a.html` liefert bereits
alles, was ein Video braucht:

- **30 benannte Bauteile**, einzeln ansteuerbar (Scheinwerfer, Rückleuchten,
  Felgen, Bremssättel, Glas getrennt von Leuchtengläsern).
- **10 verifizierte Kamerapositionen** (`VIEWS` in der App), jede im
  Software-Rasterizer geprüft — keine Kamera steht in der Karosserie.
- **Kamerafahrten mit Easing** sind implementiert (`goView` / `stepAnim`),
  Dauer 0,95 s, Cubic-Ease. Eine Sequenz ist nur eine Liste solcher Fahrten.
- **Vier Umgebungen** prozedural erzeugt — auch die Beleuchtung lässt sich
  über die Zeit animieren (z. B. Studio → Sonnenuntergang während der Fahrt).
- **Lichtstufen** schaltbar — Scheinwerfer im Video aufblenden zu lassen ist
  ein Einzeiler.
- Das Modell ist **auf reale Maße normalisiert** (4.693 mm, Räder auf Y = 0).
  Kamerapfade lassen sich damit in Metern beschreiben statt in Modelleinheiten.

**Das heißt:** Der aufwendige Teil ist erledigt. Das Video ist Aufsatzarbeit.

---

## 3. Drei Umsetzungswege

### Weg A — Cinematic-Modus in der App *(empfohlen als Erstes)*

Kein Export, nur ein Abspielmodus. Aufwand: ~1 Arbeitsschritt.

**Umsetzung**
1. Sequenz-Datenstruktur: Liste aus `{ view, dauer, licht, umgebung, fov }`.
2. Abspieler, der `anim` nacheinander mit langen Dauern (3–6 s) füttert statt
   mit 0,95 s. Die vorhandene `stepAnim`-Funktion reicht dafür aus.
3. Zusätzliche Bewegung während der Standzeit: langsame Orbit-Drift (die
   `S.spin`-Logik existiert bereits, nur langsamer).
4. Bedienelemente per CSS ausblenden (`body.cinema { ... opacity:0 }`).
5. Musik: `<audio>`-Element, Start erst nach Nutzergeste (iOS-Pflicht),
   Ein-/Ausblenden über `GainNode`.

**Vorschlag für die Sequenz (ca. 42 s)**

| # | Ansicht | Dauer | Ereignis |
|---|---|---|---|
| 1 | Scheinwerfer, sehr nah | 4 s | Licht aus → Standlicht blendet auf |
| 2 | Hero 3/4 vorn | 6 s | langsame Orbitdrift, Licht auf Voll |
| 3 | Rad | 4 s | Bremssattel im Bild |
| 4 | Seite | 5 s | Umgebung wechselt zu Sonnenuntergang |
| 5 | Heck 3/4 | 6 s | Rückleuchten glühen |
| 6 | Heckleuchten, nah | 4 s | |
| 7 | Cockpit | 5 s | |
| 8 | Draufsicht | 4 s | |
| 9 | Hero, zurückfahrend | 4 s | Umgebung Nacht, Titel wird eingeblendet |

### Weg B — Videoexport im Browser

Nimmt den Canvas direkt auf. Aufwand: mittel.

**Umsetzung**
- `canvas.captureStream(60)` + `MediaRecorder` → WebM.
- Musik über `AudioContext.createMediaStreamDestination()` in denselben Stream
  mischen, dann Video- und Audiospur zu einem `MediaStream` kombinieren.
- Ergebnis als Blob herunterladen.

**Bekannte Hürden — vorher prüfen, nicht annehmen**
- **Safari auf iOS** unterstützt `MediaRecorder` erst spät und nur mit
  eingeschränkten Codecs. Ob das auf Leos iPhone 17 Pro funktioniert, muss
  **getestet** werden, bevor darauf gebaut wird. Auf dem Desktop (Chrome) ist
  es unkritisch.
- WebM lässt sich auf iOS nicht in die Fotomediathek speichern. Für ein
  teilbares Ergebnis wäre MP4/H.264 nötig.
- Die Aufnahme läuft in Echtzeit: 42 s Video = 42 s Wartezeit, und Framedrops
  landen mit im Video.

### Weg C — Bildfolge + Zusammenbau *(höchste Qualität)*

Rendert Einzelbilder statt in Echtzeit aufzunehmen.

**Umsetzung**
- Die Sequenz mit festem Zeitschritt durchlaufen (z. B. 1/30 s), nach jedem
  Bild `canvas.toBlob()` → in einer Liste sammeln.
- Zusammenbau entweder
  - **im Browser** mit `ffmpeg.wasm` (rund 25 MB Nachladung, läuft aber ohne
    Server), oder
  - **außerhalb**: ZIP mit PNG-Folge herunterladen und lokal mit ffmpeg
    zusammensetzen.
- Vorteil: keine Framedrops, freie Auflösung (4K möglich), MP4 direkt.
- Nachteil: deutlich mehr Aufwand, 42 s × 30 fps = 1.260 Bilder im Speicher —
  braucht Batching, sonst läuft das iPhone voll.

---

## 4. Empfohlene Reihenfolge

1. **Weg A umsetzen.** Bringt sofort das sichtbare Erlebnis und erzeugt die
   Sequenzdaten, die B und C ohnehin brauchen.
2. **Weg B testen** — ein Wegwerf-Test, ob `MediaRecorder` auf dem iPhone 17 Pro
   überhaupt aufnimmt. Das Ergebnis entscheidet, ob B reicht oder C nötig ist.
3. Erst danach entscheiden, ob C gebaut wird.

---

## 5. Offene Punkte

Vor dem Start von Weg A zu klären:

- **Musikdateien**: Welche MP3s, wo liegen sie, wie lang? Das Video sollte zur
  Musik geschnitten sein, nicht umgekehrt. Bei GitHub Pages: Dateigröße
  beachten (Repo-Limit 1 GB, Einzeldatei 100 MB).
- **Lizenz**: Eigene Musik ist unproblematisch. Bei gekaufter Musik ist ein
  öffentlich erreichbares GitHub-Pages-Repo eine Veröffentlichung — das ist
  lizenzrechtlich nicht automatisch gedeckt.
- **Zielformat**: Reicht ein Erlebnis in der App, oder muss am Ende wirklich
  eine Datei herauskommen, die sich verschicken lässt?
- **Länge**: 30 s, 60 s oder länger?
- **Text im Video**: Titel, technische Daten, Konfigurationsname?

---

## 6. Randnotiz zum Modell

Das 3D-Modell stammt aus einem Sketchfab-Export („2020 Ferrari 812 GTS").
Für ein Video, das über den privaten Gebrauch hinausgeht, ist die
Lizenzbedingung des Modells zu prüfen (in der Regel CC-BY mit
Namensnennungspflicht). Die App weist das im Bereich „Daten" aus;
ein Video müsste den Hinweis im Abspann führen.
