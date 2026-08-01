import { describe, expect, it } from "vitest";
import { equals, normalizeArabic, similarity, tokenize } from "./index";

describe("normalizeArabic", () => {
  it("strips vowel marks", () => {
    expect(normalizeArabic("بِسْمِ")).toBe("بسم");
  });

  it("strips Quranic pause and recitation marks", () => {
    expect(normalizeArabic("الحمدۖ لله")).toBe("الحمد لله");
  });

  it("unifies Farsi Yeh to Arabic Yeh", () => {
    expect(normalizeArabic("علی")).toBe(normalizeArabic("علي"));
  });

  it("unifies Urdu Heh to Arabic Heh", () => {
    expect(normalizeArabic("ہم")).toBe(normalizeArabic("هم"));
  });

  it("unifies Keheh to Arabic Kaf", () => {
    expect(normalizeArabic("کتاب")).toBe(normalizeArabic("كتاب"));
  });

  it("reduces Alef variants to plain Alef", () => {
    const forms = ["آمن", "أمن", "إمن", "ٱمن"];
    const normalized = forms.map((f) => normalizeArabic(f));
    expect(new Set(normalized).size).toBe(1);
    expect(normalized[0]).toBe("امن");
  });

  it("strips tatweel", () => {
    expect(normalizeArabic("كــتــاب")).toBe("كتاب");
  });

  it("converts Arabic-Indic digits to ASCII", () => {
    expect(normalizeArabic("٢٠٢٦")).toBe("2026");
    expect(normalizeArabic("۲۰۲۶")).toBe("2026");
  });

  it("collapses whitespace and trims", () => {
    expect(normalizeArabic("  الحمد    لله  ")).toBe("الحمد لله");
  });

  it("respects options that are switched off", () => {
    expect(normalizeArabic("بِسْمِ", { stripHarakat: false })).toContain("ِ");
    expect(normalizeArabic("علی", { unifyLetters: false })).toContain("ی");
  });

  it("is idempotent", () => {
    const once = normalizeArabic("بِسْمِ ٱللَّهِ");
    expect(normalizeArabic(once)).toBe(once);
  });

  it("leaves already normalised text unchanged", () => {
    expect(normalizeArabic("كتاب")).toBe("كتاب");
  });
});

describe("tokenize", () => {
  it("splits into words", () => {
    expect(tokenize("الحمد لله رب العالمين")).toEqual([
      "الحمد",
      "لله",
      "رب",
      "العالمين",
    ]);
  });

  it("produces no empty entries from free-standing markers", () => {
    // The marker stands as a "word" of its own: strip it and an empty string
    // would be left, shifting every following index.
    const tokens = tokenize("الحمد ۖ لله");
    expect(tokens).toEqual(["الحمد", "لله"]);
    expect(tokens).not.toContain("");
  });

  it("returns an empty array for empty input", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("   ")).toEqual([]);
  });
});

describe("similarity", () => {
  it("returns 1 for identical texts", () => {
    expect(similarity("الحمد لله", "الحمد لله")).toBe(1);
  });

  it("returns 1 for texts that differ only in spelling variant", () => {
    expect(similarity("بِسْمِ ٱللَّهِ", "بسم الله")).toBe(1);
  });

  it("penalises a single differing word only proportionally", () => {
    const score = similarity("الحمد لله رب العالمين", "الحمد لله رب الناس");
    expect(score).toBeGreaterThan(0.7);
    expect(score).toBeLessThan(1);
  });

  it("returns 0 for entirely different texts of equal length", () => {
    expect(similarity("واحد اثنان", "ثلاثة اربعة")).toBe(0);
  });

  it("handles empty input in a defined way", () => {
    expect(similarity("", "")).toBe(1);
    expect(similarity("الحمد", "")).toBe(0);
    expect(similarity("", "الحمد")).toBe(0);
  });

  it("is symmetric", () => {
    const a = "الحمد لله رب العالمين";
    const b = "الحمد لله رب الناس";
    expect(similarity(a, b)).toBeCloseTo(similarity(b, a), 10);
  });
});

describe("equals", () => {
  it("recognises equality across spelling variants", () => {
    expect(equals("علی", "علي")).toBe(true);
    expect(equals("کتاب", "كتاب")).toBe(true);
  });

  it("distinguishes genuinely different words", () => {
    expect(equals("كتاب", "كتب")).toBe(false);
  });
});
