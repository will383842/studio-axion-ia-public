/**
 * T-MONTEUR-REGLES-SIMPLES-v20d · tests directs du module pur `monteur/regles-simples.ts`.
 * Entrées construites à la main : aucun réseau, aucune base, aucune horloge.
 */
import { describe, expect, it } from "vitest";
import {
  decouperDemande,
  morceauxEt,
  normaliserFrappe,
  operationsComposees,
  phrasesRedites,
  zoneDite,
  type ContexteRegles,
  type MotSimple,
} from "@/moteurs/montage-facecam/monteur/regles-simples";

/** Mots à la main : un mot par seconde, à partir de la seconde 0. */
const parSeconde = (texte: string): MotSimple[] => texte.split(" ").map((mot, index) => ({ index, mot, sec: index }));
const ctxDe = (mots: MotSimple[], occupes: ContexteRegles["occupes"] = []): ContexteRegles => ({ mots, occupes });

describe("normaliserFrappe", () => {
  it("retire accents et majuscules", () => {
    expect(normaliserFrappe("Élève ÇA Été")).toBe("eleve ca ete");
  });
  it("rend les espaces multiples simples et rogne les bords", () => {
    expect(normaliserFrappe("  coupe    le   début  ")).toBe("coupe le debut");
  });
  it("lisse la faute AZERTY « D4ANIMATION » en « d animation »", () => {
    expect(normaliserFrappe("BEAUCOUP D4ANIMATION")).toBe("beaucoup d animation");
  });
  it("remplace apostrophes et tirets par des espaces", () => {
    expect(normaliserFrappe("s'il-te plaît")).toBe("s il te plait");
  });
});

describe("decouperDemande", () => {
  it("« coupe le début. Ajoute un zoom » → 2 points", () => {
    expect(decouperDemande("coupe le début. Ajoute un zoom")).toEqual(["coupe le début", "Ajoute un zoom"]);
  });
  it("coupe aussi sur « puis » et « ensuite »", () => {
    expect(decouperDemande("coupe le début puis ajoute un zoom ensuite enlève la carte")).toEqual(["coupe le début", "ajoute un zoom", "enlève la carte"]);
  });
  it("écarte les points de renvoi (« fixe ce problème », « merci »)", () => {
    expect(decouperDemande("Il manque des plans. Fixe ce problème. Merci")).toEqual(["Il manque des plans"]);
  });
  it("message vide → aucun point", () => {
    expect(decouperDemande("   ")).toEqual([]);
  });
});

describe("morceauxEt", () => {
  it("« X et Y » → 2 morceaux", () => {
    expect(morceauxEt("plus lumineux et bonne mine")).toEqual(["plus lumineux", "bonne mine"]);
  });
  it("sans « et » → un seul morceau", () => {
    expect(morceauxEt("plus lumineux")).toEqual(["plus lumineux"]);
  });
});

describe("zoneDite", () => {
  it("« au début » → [0, 0.3]", () => {
    expect(zoneDite("beaucoup d animation au debut")).toEqual([0, 0.3]);
  });
  it("« vers la fin » → [0.65, 1]", () => {
    expect(zoneDite("vers la fin je begaie")).toEqual([0.65, 1]);
  });
  it("« au milieu » → [0.3, 0.7]", () => {
    expect(zoneDite("au milieu")).toEqual([0.3, 0.7]);
  });
  it("phrase sans zone → null", () => {
    expect(zoneDite("ajoute un zoom")).toBeNull();
  });
  it("« entre 3 s et 5 s » n'est pas une zone dite → null (ancrage ailleurs)", () => {
    expect(zoneDite("entre 3 s et 5 s")).toBeNull();
  });
});

describe("phrasesRedites", () => {
  it("phrase dite deux fois → 1 intervalle : la première tentative", () => {
    const mots = parSeconde("alors voici notre offre voici notre offre complete");
    expect(phrasesRedites(mots)).toEqual([{ debutMot: 1, finMot: 3 }]);
  });
  it("aucune répétition → aucun intervalle", () => {
    expect(phrasesRedites(parSeconde("bonjour tout le monde voici notre offre"))).toEqual([]);
  });
  it("répétition de mots vides seulement → ignorée", () => {
    expect(phrasesRedites(parSeconde("le la de le la de"))).toEqual([]);
  });
  it("reprise à plus de 20 s d'écart → ignorée", () => {
    const mots: MotSimple[] = [
      { index: 0, mot: "notre", sec: 0 },
      { index: 1, mot: "offre", sec: 1 },
      { index: 2, mot: "complete", sec: 2 },
      { index: 3, mot: "bref", sec: 10 },
      { index: 4, mot: "notre", sec: 30 },
      { index: 5, mot: "offre", sec: 31 },
      { index: 6, mot: "complete", sec: 32 },
    ];
    expect(phrasesRedites(mots)).toEqual([]);
  });
  it("les mots retirés (sec null) sont ignorés", () => {
    const mots = parSeconde("voici notre offre voici notre offre").map((m, i) => (i === 3 ? { ...m, sec: null } : m));
    expect(phrasesRedites(mots)).toEqual([]);
  });
});

describe("operationsComposees", () => {
  const trente = parSeconde(Array.from({ length: 30 }, (_, i) => `mot${i}`).join(" "));

  it("bégaiement : la première tentative est coupée, comprise", () => {
    const r = operationsComposees("je reprends les memes phrases", ctxDe(parSeconde("alors voici notre offre voici notre offre complete")));
    expect(r).toEqual({ operations: [{ type: "couper", debutMot: 1, finMot: 3 }], resume: "Phrase redite retirée", comprise: true });
  });
  it("bégaiement sans phrase redite → non comprise, aucune opération", () => {
    const r = operationsComposees("je begaie", ctxDe(parSeconde("bonjour tout le monde voici notre offre")));
    expect(r?.comprise).toBe(false);
    expect(r?.operations).toEqual([]);
    expect(r?.resume).toContain("Je n'ai pas trouvé de phrase redite");
  });
  it("demande de plans de caméra → des zooms punch-in sur le visage", () => {
    const r = operationsComposees("il manque des plans de camera", ctxDe(trente));
    expect(r?.comprise).toBe(true);
    expect(r!.operations.length).toBeGreaterThanOrEqual(2);
    expect(r!.operations.every((o) => o.type === "zoom")).toBe(true);
    expect(r!.resume).toBe(`${r!.operations.length} changements de cadre ajoutés`);
  });
  it("demande d'animations au début → cartes « titre », résumé « au début »", () => {
    const mots = parSeconde("Bonjour, voici notre offre. Elle change tout, regardez bien. Merci d'etre la, a bientot. Fin de la video, au revoir.");
    const r = operationsComposees("beaucoup d'animation au debut", ctxDe(mots));
    expect(r?.comprise).toBe(true);
    expect(r!.operations.length).toBeGreaterThanOrEqual(1);
    expect(r!.operations.length).toBeLessThanOrEqual(3);
    expect(r!.operations.every((o) => o.type === "ajouterCarte")).toBe(true);
    expect(r!.resume).toMatch(/animations? ajoutées? au début$/);
  });
  it("demande de retrait (« moins de zooms ») → null", () => {
    expect(operationsComposees("moins de zooms", ctxDe(trente))).toBeNull();
  });
  it("demande non reconnue → null", () => {
    expect(operationsComposees("rends la voix plus grave", ctxDe(trente))).toBeNull();
  });
  it("zone du message utilisée quand le point n'en dit pas", () => {
    const r = operationsComposees("je begaie", ctxDe(parSeconde("bonjour tout le monde voici notre offre")), [0.65, 1]);
    expect(r?.resume).toContain("vers la fin");
  });
});
