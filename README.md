# arabic-normalize

**Normalise Arabic script for comparison, not for display.**

[![CI](https://github.com/DomenicMoran/arabic-normalize/actions/workflows/ci.yml/badge.svg)](https://github.com/DomenicMoran/arabic-normalize/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
![Dependencies](https://img.shields.io/badge/dependencies-0-success)

---

## The problem

A speech model returns `علی`. The source has `علي`. Identical to the ear — two
different strings to `===`. The match rate collapses although the speaker was
right.

The same happens with harakat (`بِسْمِ` vs. `بسم`), with Quranic pause marks,
with Alef variants (`آ أ إ ٱ`), with Urdu Heh, with tatweel and with
Arabic-Indic digits. Every one of these differences is invisible to a human and
fatal to a comparison.

This library clears them away in stages, so you decide how far the levelling
is allowed to go.

> **For comparison only.** The normalised text is deliberately no longer
> correctly typeset. What you display is always the original.

## Install

```bash
npm install arabic-normalize
```

No dependencies. ESM. TypeScript types included.

## Usage

```ts
import { normalizeArabic, tokenize, similarity, equals } from "arabic-normalize";

normalizeArabic("بِسْمِ ٱللَّهِ");   // → "بسم الله"
equals("علی", "علي");                // → true  (Farsi Yeh = Arabic Yeh)
equals("کتاب", "كتاب");              // → true  (Keheh = Kaf)

similarity("الحمد لله رب العالمين",
           "الحمد لله رب الناس");    // → 0.75
```

### Options

Every stage can be switched off on its own:

```ts
normalizeArabic(text, {
  stripHarakat: true,       // remove vowel marks
  stripQuranicMarks: true,  // recitation and pause marks (U+06D6–U+06ED)
  unifyLetters: true,       // unify regional variants
  normalizeDigits: true,    // ٠-٩ and ۰-۹ to ASCII
  collapseWhitespace: true, // collapse runs of whitespace
});
```

## Why `similarity` scores leniently

It compares the Levenshtein distance of **word sequences**, not exact equality.
A single differing word in a long verse does not drag the result to zero.

That is a product decision, not a mathematical one: in a recitation check a
strict comparison is useless to a learner — it only ever says "wrong", never
"almost".

## The trap `tokenize` solves

A naive `split(/\s+/)` breaks on Quranic Uthmani text. Some editions carry
**free-standing** waqf markers: a pause mark with a space on either side. Strip
the mark and an empty string is left in the array, shifting **every following
word index by one**.

What hangs off that: word-level timestamps for audio sync, highlighting the
current word, every mapping between text and sound. The defect stays invisible
until the highlight drifts apart mid-verse.

```ts
"الحمد ۖ لله".split(/\s+/);  // → ["الحمد", "ۖ", "لله"]   after strip: ["الحمد", "", "لله"]
tokenize("الحمد ۖ لله");      // → ["الحمد", "لله"]
```

## Coverage

| Category | Example | Result |
|---|---|---|
| Harakat | `بِسْمِ` | `بسم` |
| Quranic marks | `الحمدۖ` | `الحمد` |
| Farsi/Urdu Yeh | `ی ى ے` | `ي` |
| Keheh / Swash Kaf | `ک ڪ` | `ك` |
| Urdu Heh | `ہ ۃ` | `ه` |
| Alef variants | `آ أ إ ٱ` | `ا` |
| Hamza carriers | `ؤ ئ` | `و ي` |
| Teh Marbuta | `ة` | `ه` |
| Tatweel | `كــتــاب` | `كتاب` |
| Digits | `٢٠٢٦ ۲۰۲۶` | `2026` |

## Order of the steps

Deliberate, not arbitrary:

1. **NFC**: unify Unicode composition
2. **Strip marks**: Quranic marks, then harakat, then tatweel
3. **Map letters**: regional variants
4. **Digits**, then **whitespace**

The other way round, combinations survive that would no longer be recognisable
as combinations after the letter mapping.

## Development

```bash
npm install
npm test        # 23 tests
npm run typecheck
npm run build
```

## Licence

MIT © Domenic Moran
