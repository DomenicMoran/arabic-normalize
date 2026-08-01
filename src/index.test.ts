import { describe, expect, it } from "vitest";
import { equals, normalizeArabic, similarity, tokenize } from "./index";

describe("normalizeArabic", () => {
  it("entfernt Vokalzeichen", () => {
    expect(normalizeArabic("بِسْمِ")).toBe("بسم");
  });

  it("entfernt koranische Pausen- und Rezitationszeichen", () => {
    expect(normalizeArabic("الحمدۖ لله")).toBe("الحمد لله");
  });

  it("vereinheitlicht Farsi Yeh zu arabischem Yeh", () => {
    expect(normalizeArabic("علی")).toBe(normalizeArabic("علي"));
  });

  it("vereinheitlicht Urdu Heh zu arabischem Heh", () => {
    expect(normalizeArabic("ہم")).toBe(normalizeArabic("هم"));
  });

  it("vereinheitlicht Keheh zu arabischem Kaf", () => {
    expect(normalizeArabic("کتاب")).toBe(normalizeArabic("كتاب"));
  });

  it("reduziert Alef-Varianten auf schlichtes Alef", () => {
    const forms = ["آمن", "أمن", "إمن", "ٱمن"];
    const normalized = forms.map((f) => normalizeArabic(f));
    expect(new Set(normalized).size).toBe(1);
    expect(normalized[0]).toBe("امن");
  });

  it("entfernt Tatweel", () => {
    expect(normalizeArabic("كــتــاب")).toBe("كتاب");
  });

  it("wandelt arabisch-indische Ziffern nach ASCII", () => {
    expect(normalizeArabic("٢٠٢٦")).toBe("2026");
    expect(normalizeArabic("۲۰۲۶")).toBe("2026");
  });

  it("fasst Leerraum zusammen und trimmt", () => {
    expect(normalizeArabic("  الحمد    لله  ")).toBe("الحمد لله");
  });

  it("respektiert abgeschaltete Optionen", () => {
    expect(normalizeArabic("بِسْمِ", { stripHarakat: false })).toContain("ِ");
    expect(normalizeArabic("علی", { unifyLetters: false })).toContain("ی");
  });

  it("ist idempotent", () => {
    const once = normalizeArabic("بِسْمِ ٱللَّهِ");
    expect(normalizeArabic(once)).toBe(once);
  });

  it("lässt bereits normalisierten Text unverändert", () => {
    expect(normalizeArabic("كتاب")).toBe("كتاب");
  });
});

describe("tokenize", () => {
  it("zerlegt in Wörter", () => {
    expect(tokenize("الحمد لله رب العالمين")).toEqual([
      "الحمد",
      "لله",
      "رب",
      "العالمين",
    ]);
  });

  it("erzeugt keine leeren Einträge aus allein stehenden Markern", () => {
    // Der Marker steht als eigenes "Wort": nach dem Entfernen bliebe sonst
    // eine leere Zeichenkette und würde jeden folgenden Index verschieben.
    const tokens = tokenize("الحمد ۖ لله");
    expect(tokens).toEqual(["الحمد", "لله"]);
    expect(tokens).not.toContain("");
  });

  it("liefert bei leerer Eingabe ein leeres Array", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("   ")).toEqual([]);
  });
});

describe("similarity", () => {
  it("gibt 1 für identische Texte", () => {
    expect(similarity("الحمد لله", "الحمد لله")).toBe(1);
  });

  it("gibt 1 für Texte, die sich nur in der Schreibvariante unterscheiden", () => {
    expect(similarity("بِسْمِ ٱللَّهِ", "بسم الله")).toBe(1);
  });

  it("bestraft ein einzelnes abweichendes Wort nur anteilig", () => {
    const score = similarity("الحمد لله رب العالمين", "الحمد لله رب الناس");
    expect(score).toBeGreaterThan(0.7);
    expect(score).toBeLessThan(1);
  });

  it("gibt 0 bei vollständig verschiedenen Texten gleicher Länge", () => {
    expect(similarity("واحد اثنان", "ثلاثة اربعة")).toBe(0);
  });

  it("behandelt leere Eingaben definiert", () => {
    expect(similarity("", "")).toBe(1);
    expect(similarity("الحمد", "")).toBe(0);
    expect(similarity("", "الحمد")).toBe(0);
  });

  it("ist symmetrisch", () => {
    const a = "الحمد لله رب العالمين";
    const b = "الحمد لله رب الناس";
    expect(similarity(a, b)).toBeCloseTo(similarity(b, a), 10);
  });
});

describe("equals", () => {
  it("erkennt Gleichheit über Schreibvarianten hinweg", () => {
    expect(equals("علی", "علي")).toBe(true);
    expect(equals("کتاب", "كتاب")).toBe(true);
  });

  it("unterscheidet tatsächlich verschiedene Wörter", () => {
    expect(equals("كتاب", "كتب")).toBe(false);
  });
});
