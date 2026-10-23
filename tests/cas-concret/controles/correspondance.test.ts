/**
 * L0c (15/10, analyse A1) : « l'image suit la parole ». Sur l'écran « Avant, c'était ça » de la vidéo v-52c3dd9b4f37,
 * « Le référencement » apparaissait sur « chercher une photo » et « La photo » sur « mettre en ligne » ; cinq tâches
 * dites pour quatre cases. Contrôle PUR, en AVERTISSEMENT montré à Will à la validation du script (jamais bloquant).
 */
import { describe, expect, it } from "vitest";
import { avertissementsCorrespondance } from "@/moteurs/montage-cas-concret/correspondance";
import { scriptValideDuCatalogue } from "@/moteurs/montage-cas-concret/script-valide";
import type { EcranCorps } from "@/moteurs/montage-cas-concret/fiche";

/** L'écran e03 du script validé « articles-blog » (base du studio, calage de la v-52c3dd9b4f37). */
const E03_BLOG = {
  id: "e03",
  type: "liste-avant",
  fond: "ivoire",
  texteDit: "Avant, c'était ça : trouver un sujet, écrire, vérifier, chercher une photo, mettre en ligne.",
  avanceMs: 100,
  taches: ["Le sujet", "L'article long", "Le référencement", "La photo"],
  evenements: [
    { cible: "tache-1", surMot: 3, avanceMs: 0 },
    { cible: "tache-2", surMot: 6, avanceMs: 0 },
    { cible: "tache-3", surMot: 8, avanceMs: 0 },
    { cible: "tache-4", surMot: 11, avanceMs: 0 },
  ],
} as unknown as EcranCorps;

const etape = (texteDit: string, titre: string, ligne: string, puces: string[] = []) =>
  ({ id: "e05", type: "etape", fond: "ivoire", texteDit, avanceMs: 0, numero: 1, total: 4, titre, ligne, visuel: { sorte: "objet", objet: "chrono" }, puces, evenements: [] }) as unknown as EcranCorps;

describe("L0c · cases de la liste « avant » sur les mots qui les disent", () => {
  it("l'écran e03 de la v-52c3dd9b4f37 déclenche l'avertissement (cases décalées, tâches sans case)", () => {
    const a = avertissementsCorrespondance([E03_BLOG]);
    const textes = a.map((x) => x.detail).join(" | ");
    expect(a.length).toBeGreaterThan(0);
    expect(a.every((x) => x.ecranId === "e03")).toBe(true);
    expect(textes).toContain("« Le référencement »");
    expect(textes).toContain("« La photo » apparaît sur « mettre »");
    expect(textes).toMatch(/5 tâches dites.*4 cases/);
  });

  it("la même liste corrigée (une case par tâche dite, chacune sur son mot) ne déclenche rien", () => {
    const corrige = {
      ...E03_BLOG,
      taches: ["Trouver un sujet", "Écrire", "Vérifier", "Chercher une photo", "Mettre en ligne"],
      evenements: [3, 6, 7, 8, 11].map((surMot, i) => ({ cible: `tache-${i + 1}`, surMot, avanceMs: 0 })),
    } as unknown as EcranCorps;
    expect(avertissementsCorrespondance([corrige])).toEqual([]);
  });

  it("le script de la v4 (référence validée par Will) ne déclenche rien", () => {
    const v4 = scriptValideDuCatalogue("recrutement-apporteurs")!;
    const ecrans = v4.ecrans.map((e, i) => ({ ...e, id: `e${String(i + 1).padStart(2, "0")}` })) as unknown as EcranCorps[];
    expect(avertissementsCorrespondance(ecrans)).toEqual([]);
  });
});

describe("L0c · une étape reprend un mot-clé ou un chiffre dit", () => {
  it("rien de commun entre l'écran et la phrase dite : avertissement", () => {
    const a = avertissementsCorrespondance([etape("Toutes les quinze minutes, un nouveau départ.", "Le *calendrier*", "Pioché dans une réserve.")]);
    expect(a).toHaveLength(1);
    expect(a[0].detail).toContain("ne reprend aucun mot");
  });

  it("un mot-clé (même conjugué ou élidé) ou un chiffre dit en lettres suffit", () => {
    expect(avertissementsCorrespondance([etape("s'inscrit toute seule, en vingt secondes.", "L'*inscription*", "Sans attendre.")])).toEqual([]);
    expect(avertissementsCorrespondance([etape("Toutes les quinze minutes.", "Le *rythme*", "Un sujet toutes les 15 min.")])).toEqual([]);
  });
});
