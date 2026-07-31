# arabic-normalize

**Normalisierung arabischer Schrift für den Vergleich — nicht für die Anzeige.**

[![CI](https://github.com/DomenicMoran/arabic-normalize/actions/workflows/ci.yml/badge.svg)](https://github.com/DomenicMoran/arabic-normalize/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
![Dependencies](https://img.shields.io/badge/dependencies-0-success)

---

## Das Problem

Ein Spracherkennungsmodell gibt `علی` aus. Die Vorlage enthält `علي`. Für das
Ohr identisch — für `===` zwei verschiedene Zeichenketten. Die Trefferquote
bricht ein, obwohl der Sprecher korrekt gesprochen hat.

Dasselbe passiert mit Vokalzeichen (`بِسْمِ` vs. `بسم`), mit koranischen
Pausenzeichen, mit Alef-Varianten (`آ أ إ ٱ`), mit Urdu-Heh, mit Tatweel und mit
arabisch-indischen Ziffern. Jede dieser Abweichungen ist für einen Menschen
unsichtbar und für einen Vergleich fatal.

Diese Bibliothek räumt sie weg — in Stufen, damit man selbst entscheidet, wie
weit die Gleichmacherei gehen darf.

> **Nur zum Vergleichen.** Der normalisierte Text ist bewusst nicht mehr
> korrekt gesetzt. Angezeigt wird immer das Original.

## Installation

```bash
npm install arabic-normalize
```

Keine Abhängigkeiten. ESM. TypeScript-Typen enthalten.

## Benutzung

```ts
import { normalizeArabic, tokenize, similarity, equals } from "arabic-normalize";

normalizeArabic("بِسْمِ ٱللَّهِ");   // → "بسم الله"
equals("علی", "علي");                // → true  (Farsi Yeh = Arabic Yeh)
equals("کتاب", "كتاب");              // → true  (Keheh = Kaf)

similarity("الحمد لله رب العالمين",
           "الحمد لله رب الناس");    // → 0.75
```

### Optionen

Jede Stufe lässt sich einzeln abschalten:

```ts
normalizeArabic(text, {
  stripHarakat: true,       // Vokalzeichen entfernen
  stripQuranicMarks: true,  // Rezitations- und Pausenzeichen (U+06D6–U+06ED)
  unifyLetters: true,       // regionale Varianten vereinheitlichen
  normalizeDigits: true,    // ٠-٩ und ۰-۹ nach ASCII
  collapseWhitespace: true, // Mehrfach-Leerraum zusammenfassen
});
```

## Warum `similarity` mild bewertet

Verglichen wird die Levenshtein-Distanz der **Wortfolgen**, nicht exakte
Gleichheit. Ein einzelnes abweichendes Wort in einem langen Vers zieht das
Ergebnis nicht auf null.

Das ist eine Produktentscheidung, keine mathematische: Bei einer
Rezitationsprüfung ist ein strenger Vergleich für Lernende unbrauchbar — er
sagt nur „falsch", nie „fast".

## Die Falle, die `tokenize` löst

Naives `split(/\s+/)` bricht bei koranischem Uthmani-Text. Manche Ausgaben
enthalten **allein stehende** Waqf-Marker — ein Pausenzeichen mit Leerzeichen
davor und dahinter. Nach dem Entfernen bleibt eine leere Zeichenkette im Array
zurück und verschiebt **jeden folgenden Wortindex um eins**.

Was daran hängt: Wort-Zeitmarken für Audio-Synchronisierung, Hervorhebung des
aktuellen Wortes, jede Zuordnung zwischen Text und Ton. Der Fehler ist
unsichtbar, bis die Markierung mitten im Vers auseinanderläuft.

```ts
"الحمد ۖ لله".split(/\s+/);  // → ["الحمد", "ۖ", "لله"]   nach Strip: ["الحمد", "", "لله"]
tokenize("الحمد ۖ لله");      // → ["الحمد", "لله"]
```

## Abdeckung

| Kategorie | Beispiel | Ergebnis |
|---|---|---|
| Vokalzeichen | `بِسْمِ` | `بسم` |
| Koranische Marker | `الحمدۖ` | `الحمد` |
| Farsi/Urdu Yeh | `ی ى ے` | `ي` |
| Keheh / Swash Kaf | `ک ڪ` | `ك` |
| Urdu Heh | `ہ ۃ` | `ه` |
| Alef-Varianten | `آ أ إ ٱ` | `ا` |
| Hamza-Träger | `ؤ ئ` | `و ي` |
| Teh Marbuta | `ة` | `ه` |
| Tatweel | `كــتــاب` | `كتاب` |
| Ziffern | `٢٠٢٦ ۲۰۲۶` | `2026` |

## Reihenfolge der Schritte

Bewusst festgelegt und nicht beliebig:

1. **NFC** — Unicode-Komposition vereinheitlichen
2. **Marker entfernen** — koranische Zeichen, dann Vokalzeichen, dann Tatweel
3. **Buchstaben abbilden** — regionale Varianten
4. **Ziffern**, dann **Leerraum**

Andersherum überleben Kombinationen, die nach dem Buchstaben-Mapping nicht mehr
als Kombination erkennbar wären.

## Entwicklung

```bash
npm install
npm test        # 25 Tests
npm run typecheck
npm run build
```

## Lizenz

MIT © Domenic Moran
