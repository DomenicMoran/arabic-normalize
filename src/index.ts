/**
 * Normalise Arabic script for *comparison*, not for display.
 *
 * The occasion: speech recognition on classical Arabic text. A model returns
 * `ی` (Farsi Yeh) where the source has `ي` (Arabic Yeh). Identical to the ear,
 * two different characters to `===` — and the match rate collapses although
 * the speaker was right.
 *
 * This library clears exactly those differences away, in stages, so the caller
 * decides how far the levelling is allowed to go.
 */

/** Combining marks: fatha, damma, kasra, shadda, sukun, tanwin, dagger alif. */
const HARAKAT = /[ً-ْٰٓ-ٕـ]/g;

/** Quranic recitation marks and waqf markers (U+06D6–U+06ED). */
const QURANIC_MARKS = /[ۖ-ۭ]/g;

/** Per-character unification of regional variants onto the Arabic form. */
const LETTER_MAP: Record<string, string> = {
  // Yeh: Farsi/Urdu -> Arabic
  "ی": "ي", // ی Farsi Yeh
  "ى": "ي", // ى Alef Maksura
  "ے": "ي", // ے Yeh Barree
  // Kaf: Farsi/Urdu -> Arabic
  "ک": "ك", // ک Keheh
  "ڪ": "ك", // ڪ Swash Kaf
  // Heh: Urdu -> Arabic
  "ہ": "ه", // ہ Heh Goal
  "ۃ": "ه", // ۃ Teh Marbuta Goal
  // Alef with hamza/madda -> plain alef
  "آ": "ا", // آ
  "أ": "ا", // أ
  "إ": "ا", // إ
  "ٱ": "ا", // ٱ Wasla
  // Hamza carriers
  "ؤ": "و", // ؤ
  "ئ": "ي", // ئ
  // Teh marbuta -> heh (often spoken the same way at the end of a word)
  "ة": "ه", // ة
};

/** Arabic-Indic and extended Arabic-Indic digits -> ASCII. */
const DIGIT_OFFSETS: [number, number][] = [
  [0x0660, 0x0669], // ٠-٩
  [0x06f0, 0x06f9], // ۰-۹
];

const TATWEEL = /ـ/g;

export type NormalizeOptions = {
  /** Remove vowel marks. Default: true. */
  stripHarakat?: boolean;
  /** Remove Quranic recitation and pause marks. Default: true. */
  stripQuranicMarks?: boolean;
  /** Unify regional letter variants. Default: true. */
  unifyLetters?: boolean;
  /** Convert Arabic-Indic digits to ASCII. Default: true. */
  normalizeDigits?: boolean;
  /** Collapse runs of whitespace and trim. Default: true. */
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
 * Normalises Arabic text for comparison.
 *
 * The order is deliberate: unify Unicode composition first (NFC), then strip
 * marks, then map letters. The other way round, combinations survive that
 * would no longer be recognised after the mapping.
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
 * Splits normalised text into words.
 *
 * What this does that `split(/\s+/)` does not: characters that stand *alone*
 * (waqf markers in some Uthmani editions, for instance) become empty strings
 * after normalisation. Left in the array, they shift every following word
 * index — and with it, for example, every word-level timestamp of an audio
 * track.
 */
export function tokenize(input: string, options?: NormalizeOptions): string[] {
  return normalizeArabic(input, options)
    .split(" ")
    .filter((token) => token.length > 0);
}

/**
 * Similarity of two texts between 0 and 1, at word level.
 *
 * Deliberately lenient: it compares the Levenshtein distance of the word
 * sequences, not exact equality. A single differing word in a long verse must
 * not drag the result to zero — in a recitation check a strict comparison is
 * useless to a learner.
 */
export function similarity(a: string, b: string, options?: NormalizeOptions): number {
  const left = tokenize(a, options);
  const right = tokenize(b, options);

  if (left.length === 0 && right.length === 0) return 1;
  if (left.length === 0 || right.length === 0) return 0;

  // Row-wise Levenshtein: only two rows are ever held in memory.
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

/** True when both texts are identical after normalisation. */
export function equals(a: string, b: string, options?: NormalizeOptions): boolean {
  return normalizeArabic(a, options) === normalizeArabic(b, options);
}
