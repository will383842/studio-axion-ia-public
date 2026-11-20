/**
 * Tests directs des 4 fonctions exportées de `mise-en-page-reference.ts` (style « reference/1 ») : unités, largeur,
 * coupe en rangées, mise en page d'une fiche. Entrées faites à la main, aucune donnée neuve.
 */
import { describe, expect, it } from "vitest";
import { couperReference, largeurReference, mettreEnPageReference, unites } from "@/moteurs/montage-tableau/mise-en-page-reference";
import { copie, ficheAvantApres } from "../regles/exemples";

describe("unites", () => {
  it("découpe sur les espaces, sans mot vide", () => {
    expect(unites("Bonjour le monde")).toEqual(["Bonjour", "le", "monde"]);
    expect(unites("  deux   mots \n ici ")).toEqual(["deux", "mots", "ici"]);
  });
  it("texte vide ou d'espaces seuls : aucune unité", () => {
    expect(unites("")).toEqual([]);
    expect(unites("   ")).toEqual([]);
  });
  it("un signe isolé reste avec le mot précédent", () => {
    expect(unites("a : b")).toEqual(["a :", "b"]);
  });
  it("un guillemet ouvrant reste avec le mot suivant, le fermant avec le précédent", () => {
    expect(unites("« Quoi ? »")).toEqual(["« Quoi ? »"]);
  });
});

describe("largeurReference", () => {
  it("texte vide : 0", () => {
    expect(largeurReference("", 52)).toBe(0);
  });
  it("croît avec le texte", () => {
    expect(largeurReference("aaaa", 52)).toBeGreaterThan(largeurReference("a", 52));
    expect(largeurReference("a", 52)).toBeGreaterThan(0);
  });
  it("croît avec la taille, proportionnellement (double taille = double largeur)", () => {
    expect(largeurReference("aaaa", 104)).toBeCloseTo(2 * largeurReference("aaaa", 52), 6);
  });
});

describe("couperReference", () => {
  it("texte court : une seule rangée qui porte tout le texte", () => {
    const r = couperReference("Bonjour le monde", 52, 2000);
    expect(r).toHaveLength(1);
    expect(r![0].texte).toBe("Bonjour le monde");
    expect(r![0].largeur).toBeCloseTo(largeurReference("Bonjour le monde", 52), 0);
  });
  it("texte long : plusieurs rangées, chacune ≤ largeurMax, tous les mots dans l'ordre", () => {
    const texte = "Bonjour le monde entier ici présent";
    const r = couperReference(texte, 52, 300)!;
    expect(r.length).toBeGreaterThan(1);
    for (const l of r) expect(l.largeur).toBeLessThanOrEqual(300);
    expect(r.map((l) => l.texte).join(" ")).toBe(texte);
  });
  it("mot plus large que largeurMax : null", () => {
    expect(couperReference("Extraordinairement", 52, 100)).toBeNull();
  });
  it("texte vide : null", () => {
    expect(couperReference("", 52, 500)).toBeNull();
  });
});

describe("mettreEnPageReference", () => {
  it("met en page une fiche : pages non vides, éléments écrits, format vertical par défaut", () => {
    const m = mettreEnPageReference(copie(ficheAvantApres));
    const pagesFiche = new Set(ficheAvantApres.scenes.map((s) => s.page));
    expect(m.pages.map((p) => p.page)).toEqual([...pagesFiche].sort((a, b) => a - b));
    for (const p of m.pages) {
      expect(p.elements.length).toBeGreaterThan(0);
      expect(p.elements.some((e) => e.lignes.length > 0)).toBe(true);
    }
    expect([m.largeurPx, m.hauteurPx]).toEqual([1080, 1920]);
    expect(m.styleReference?.style).toBe("reference/1");
  });
  it("est déterministe", () => {
    expect(mettreEnPageReference(copie(ficheAvantApres))).toEqual(mettreEnPageReference(copie(ficheAvantApres)));
  });
  it("ne modifie pas la fiche reçue", () => {
    const f = copie(ficheAvantApres);
    const avant = copie(ficheAvantApres);
    mettreEnPageReference(f);
    expect(f).toEqual(avant);
  });
  it("chaque bloc écrit reste dans la zone sûre", () => {
    const m = mettreEnPageReference(copie(ficheAvantApres));
    const z = m.zoneSure.px;
    for (const p of m.pages)
      for (const e of p.elements) {
        expect(e.px.x).toBeGreaterThanOrEqual(z.x);
        expect(e.px.x + e.px.largeur).toBeLessThanOrEqual(z.x + z.largeur);
        expect(e.px.y).toBeGreaterThanOrEqual(z.y);
        expect(e.px.y + e.px.hauteur).toBeLessThanOrEqual(z.y + z.hauteur);
      }
  });
  it("sortie horizontale : dimensions de la sortie demandée", () => {
    const m = mettreEnPageReference(copie(ficheAvantApres), { format: "horizontal" });
    expect(m.largeurPx).toBeGreaterThan(m.hauteurPx);
    expect(m.format).toBe("horizontal");
  });
  it("fin avec site : ajoute le bloc « ~site » en dernière page", () => {
    const m = mettreEnPageReference(copie(ficheAvantApres), { appel: { site: true, phrase: "Essayez maintenant" } as never });
    expect(m.styleReference?.ajouts.some((id) => id.endsWith("~site"))).toBe(true);
    expect(m.styleReference?.pagesSansSignature).toHaveLength(1);
  });
  it("un mot trop large pour la page : ErreurMiseEnPage nommant le mot", () => {
    const f = copie(ficheAvantApres);
    const el = f.scenes.flatMap((s) => s.elements).find((e) => e.type === "ligne");
    if (!el || el.type !== "ligne") throw new Error("ligne absente");
    el.texte = "Anticonstitutionnellement".repeat(4);
    expect(() => mettreEnPageReference(f)).toThrow(/le mot « Anticonstitutionnellement/);
  });
});
