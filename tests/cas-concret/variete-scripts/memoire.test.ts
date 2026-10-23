/** Mémoire anti-copie (pure) : extraction des séquences déjà dites, plafond, contrôle de similarité. */
import { describe, expect, it } from "vitest";
import {
  MEMOIRE_MAX_CARACTERES,
  MEMOIRE_MAX_SEQUENCES,
  TAILLE_MEMOIRE,
  TAILLE_SIMILARITE,
  blocMemoire,
  copiesDe,
  memoireAntiCopie,
  sequencesDe,
} from "@/domaine/cas-concret-variete";

const V4 = "On recrute nos collaborateurs en quinze minutes. Oui, quinze minutes. Avant, c'était ça : trier les candidatures, répondre à chacun, relancer, caler un rendez-vous. Alors on a tout automatisé.";

describe("sequencesDe : séquences normalisées", () => {
  it("ignore la casse, la ponctuation et les accents", () => {
    const a = sequencesDe("Avant, c'était ÇA : trier les candidatures !", TAILLE_MEMOIRE);
    const b = sequencesDe("avant c’etait ca trier les candidatures", TAILLE_MEMOIRE);
    expect(a.length).toBeGreaterThan(0);
    expect(a).toEqual(b);
  });

  it("ne traverse pas la fin d'une phrase", () => {
    expect(sequencesDe("Trois mots seulement. Puis encore trois.", TAILLE_MEMOIRE)).toEqual([]);
  });

  it("écarte les séquences faites de mots outils", () => {
    expect(sequencesDe("Et puis il y a de la", TAILLE_MEMOIRE)).toEqual([]);
  });
});

describe("memoireAntiCopie", () => {
  it("rend les séquences déjà dites, avec leur texte d'origine", () => {
    const m = memoireAntiCopie([V4]);
    expect(m.length).toBeGreaterThan(0);
    expect(m.every((s) => s.mots >= TAILLE_MEMOIRE)).toBe(true);
    expect(m.some((s) => s.texte.includes("trier les candidatures"))).toBe(true);
  });

  it("laisse de côté les mots de la promesse et des éléments du cas", () => {
    const m = memoireAntiCopie([V4], { tolere: ["On recrute nos collaborateurs en quinze minutes"] });
    expect(m.some((s) => s.cle.includes("recrute nos collaborateurs"))).toBe(false);
    expect(m.some((s) => s.texte.includes("trier les candidatures"))).toBe(true);
  });

  it("garde en premier la séquence reprise par plusieurs scripts", () => {
    const m = memoireAntiCopie(["Alors on a tout automatisé pour vous. Rien d'autre ici.", "Zéro souci : alors on a tout automatisé pour vous. Autre chose."]);
    expect(m[0].texte.toLowerCase()).toContain("on a tout automatisé pour vous");
    expect(m[0].scripts).toBe(2);
  });

  it("plafonne le nombre de séquences et la taille", () => {
    const longs = Array.from({ length: 200 }, (_, i) => `Mot${i}a mot${i}b mot${i}c mot${i}d mot${i}e mot${i}f.`);
    const m = memoireAntiCopie(longs);
    expect(m.length).toBeLessThanOrEqual(MEMOIRE_MAX_SEQUENCES);
    expect(blocMemoire(m).length).toBeLessThanOrEqual(MEMOIRE_MAX_CARACTERES + 400);
  });

  it("grossit avec chaque nouveau script", () => {
    const un = memoireAntiCopie([V4]);
    const deux = memoireAntiCopie([V4, "Chaque lundi matin, le camion repart avec les colis du jour."]);
    expect(deux.length).toBeGreaterThan(un.length);
  });

  it("sans script : rien", () => {
    expect(memoireAntiCopie([])).toEqual([]);
    expect(blocMemoire([])).toBe("");
  });
});

describe("copiesDe : contrôle de similarité", () => {
  it("repère une séquence de 5 mots ou plus reprise d'un script antérieur", () => {
    const c = copiesDe("Le rappel part. Avant, c'était ça : trier les candidatures à la main.", [V4]);
    expect(c.length).toBeGreaterThan(0);
    expect(c[0].mots).toBeGreaterThanOrEqual(TAILLE_SIMILARITE);
  });

  it("ne dit rien d'un script différent", () => {
    expect(copiesDe("Le colis arrive demain matin chez le client, sans appel.", [V4])).toEqual([]);
  });

  it("ne compte pas la promesse ni les éléments obligatoires du cas", () => {
    const script = "On recrute nos collaborateurs en quinze minutes. Puis le reste est neuf.";
    expect(copiesDe(script, [V4]).length).toBeGreaterThan(0);
    expect(copiesDe(script, [V4], { tolere: ["On recrute nos collaborateurs en quinze minutes"] })).toEqual([]);
  });

  it("quatre mots communs ne suffisent pas", () => {
    expect(copiesDe("Alors on a tout planifié ce matin.", [V4])).toEqual([]);
  });
});
