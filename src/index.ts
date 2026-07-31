/**
 * Normalisierung arabischer Schrift für den *Vergleich* — nicht für die Anzeige.
 *
 * Der Anlass: Spracherkennung auf klassisch-arabischem Text. Ein Modell gibt
 * `ی` (Farsi Yeh) aus, die Vorlage enthält `ي` (Arabic Yeh). Für das Ohr
 * identisch, für `===` zwei verschiedene Zeichen — und die Trefferquote bricht
 * ein, obwohl korrekt gesprochen wurde.
 *
 * Diese Bibliothek räumt genau solche Unterschiede weg, und zwar in Stufen,
 * damit man selbst entscheidet, wie weit die Gleichmacherei gehen darf.
 */

/** Kombinierende Zeichen: Fatha, Damma, Kasra, Schadda, Sukun, Tanwin, Dagger-Alif. */
const HARAKAT = /[ً-ْٰٓ-ٕـ]/g;

/** Koranische Rezitationszeichen und Waqf-Marker (U+06D6–U+06ED). */
const QURANIC_MARKS = /[ۖ-ۭ]/g;

/** Zeichenweise Vereinheitlichung regionaler Varianten auf die arabische Form. */
const LETTER_MAP: Record<string, string> = {
  // Yeh: Farsi/Urdu → Arabisch
  "ی": "ي", // ی Farsi Yeh
  "ى": "ي", // ى Alef Maksura
  "ے": "ي", // ے Yeh Barree
  // Kaf: Farsi/Urdu → Arabisch
  "ک": "ك", // ک Keheh
  "ڪ": "ك", // ڪ Swash Kaf
  // Heh: Urdu → Arabisch
  "ہ": "ه", // ہ Heh Goal
  "ۃ": "ه", // ۃ Teh Marbuta Goal
  // Alef mit Hamza/Madda → schlichtes Alef
  "آ": "ا", // آ
  "أ": "ا", // أ
  "إ": "ا", // إ
  "ٱ": "ا", // ٱ Wasla
  // Hamza-Träger
  "ؤ": "و", // ؤ
  "ئ": "ي", // ئ
  // Teh Marbuta → Heh (wird am Wortende oft gleich gesprochen)
  "ة": "ه", // ة
};

/** Arabisch-indische und erweiterte Ziffern → ASCII. */
const DIGIT_OFFSETS: [number, number][] = [
  [0x0660, 0x0669], // ٠-٩
  [0x06f0, 0x06f9], // ۰-۹
];

const TATWEEL = /ـ/g;

export type NormalizeOptions = {
  /** Vokalzeichen entfernen. Standard: true. */
  stripHarakat?: boolean;
  /** Koranische Rezitations- und Pausenzeichen entfernen. Standard: true. */
  stripQuranicMarks?: boolean;
  /** Regionale Buchstabenvarianten vereinheitlichen. Standard: true. */
  unifyLetters?: boolean;
  /** Arabisch-indische Ziffern nach ASCII wandeln. Standard: true. */
  normalizeDigits?: boolean;
  /** Mehrfache Leerzeichen zusammenfassen und trimmen. Standard: true. */
  collapseWhitespace?: boolean;
};

const DEFAULTS: Required<NormalizeOptions> = {
  stripHarakat: true,
  stripQuranicMarks: true,
  unifyLetters: true,
  normalizeDigits: true,
  collapseWhitespace: true,
};

function mapDigits(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    const range = DIGIT_OFFSETS.find(([lo, hi]) => code >= lo && code <= hi);
    out += range ? String(code - range[0]) : ch;
  }
  return out;
}

/**
 * Normalisiert arabischen Text für den Vergleich.
 *
 * Die Reihenfolge ist bewusst: erst Unicode-Komposition vereinheitlichen (NFC),
 * dann Marker entfernen, dann Buchstaben abbilden. Andersherum überleben
 * Kombinationen, die nach dem Mapping nicht mehr erkannt würden.
 */
export function normalizeArabic(input: string, options: NormalizeOptions = {}): string {
  const opts = { ...DEFAULTS, ...options };
  let text = input.normalize("NFC");

  if (opts.stripQuranicMarks) text = text.replace(QURANIC_MARKS, "");
  if (opts.stripHarakat) text = text.replace(HARAKAT, "");
  text = text.replace(TATWEEL, "");

  if (opts.unifyLetters) {
    text = [...text].map((ch) => LETTER_MAP[ch] ?? ch).join("");
  }
  if (opts.normalizeDigits) text = mapDigits(text);
  if (opts.collapseWhitespace) text = text.replace(/\s+/g, " ").trim();

  return text;
}

/**
 * Zerlegt normalisierten Text in Wörter.
 *
 * Wichtig gegenüber `split(/\s+/)`: Zeichen, die *allein* stehen (etwa
 * Waqf-Marker in manchen Uthmani-Ausgaben), werden nach der Normalisierung zu
 * leeren Zeichenketten. Bleiben die im Array, verschiebt sich jeder folgende
 * Wortindex — und damit zum Beispiel jede Wort-Zeitmarke einer Audiospur.
 */
export function tokenize(input: string, options?: NormalizeOptions): string[] {
  return normalizeArabic(input, options)
    .split(" ")
    .filter((token) => token.length > 0);
}

/**
 * Ähnlichkeit zweier Texte zwischen 0 und 1, auf Wortebene.
 *
 * Bewusst mild: Verglichen wird über die Levenshtein-Distanz der Wortfolgen,
 * nicht über exakte Gleichheit. Ein einzelnes abweichendes Wort in einem langen
 * Vers soll das Ergebnis nicht auf null ziehen — bei Rezitationsprüfung ist ein
 * strenger Vergleich für Lernende unbrauchbar.
 */
export function similarity(a: string, b: string, options?: NormalizeOptions): number {
  const left = tokenize(a, options);
  const right = tokenize(b, options);

  if (left.length === 0 && right.length === 0) return 1;
  if (left.length === 0 || right.length === 0) return 0;

  // Zeilenweise Levenshtein — nur zwei Zeilen im Speicher.
  let prev = Array.from({ length: right.length + 1 }, (_, i) => i);
  let curr = new Array<number>(right.length + 1);

  for (let i = 1; i <= left.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= right.length; j++) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }

  const distance = prev[right.length];
  return 1 - distance / Math.max(left.length, right.length);
}

/** True, wenn beide Texte nach der Normalisierung identisch sind. */
export function equals(a: string, b: string, options?: NormalizeOptions): boolean {
  return normalizeArabic(a, options) === normalizeArabic(b, options);
}
