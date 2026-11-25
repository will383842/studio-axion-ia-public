/**
 * QUAL-4 · La note ne peut plus afficher « 100 » pour une vidéo illisible : la grille a un critère de composition,
 * et la note sans grille tient compte du contrôle (absent = « non vérifié », jamais réussi).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PlanValide } from "../../src/briques/plan-scenes/schema";
import { controlerComposition } from "../../src/briques/plan-scenes/tutoriel/controle-composition";
import type { ResultatControleComposition } from "../../src/briques/plan-scenes/tutoriel/sans-voix/types";
import type { DonneesCalque } from "../../src/briques/sous-titres/scene";
import { noterTutoriel, type EntreeGrille } from "../../src/moteurs/montage-tutoriel-outil/grille-qualite";
import { imagesPlanValideA, rectsSousTitresA } from "../../src/moteurs/montage-tutoriel-outil/geometrie-plan-valide";
import { alertesDe, noteSansGrille } from "../../src/moteurs/montage-tutoriel-outil/index";
import type { EtatTutoriel } from "../../src/moteurs/montage-tutoriel-outil/chaine";

const avant = JSON.parse(readFileSync(join(__dirname, "fixtures/qual-repli-avant.json"), "utf8"))[0] as { plan: PlanValide; sousTitres: DonneesCalque };
const propre: ResultatControleComposition = { ok: true, defauts: [], mesures: { textePlusPetitPx: 60, videMaxMs: 0, echantillons: 100 } };
const defaut = (gravite: "bloquant" | "a-corriger"): ResultatControleComposition => ({ ok: false, defauts: [{ code: "HORS_CADRE", gravite, debutMs: 0, finMs: 1000, message: "0,0 s → 1,0 s : x" }], mesures: { textePlusPetitPx: 40, videMaxMs: 0, echantillons: 10 } });

describe("note sans grille", () => {
  it("100 seulement avec un contrôle passé et rien à signaler", () => {
    expect(noteSansGrille({ bloquants: 0, aCorriger: 0, attention: 0 })).toBe(100);
  });
  it("un défaut fait tomber sous 100 ; poids 25 / 8 / 10 ; bornée à 0", () => {
    expect(noteSansGrille({ bloquants: 1, aCorriger: 0, attention: 0 })).toBe(75);
    expect(noteSansGrille({ bloquants: 0, aCorriger: 1, attention: 0 })).toBe(92);
    expect(noteSansGrille({ bloquants: 0, aCorriger: 0, attention: 1 })).toBe(90);
    expect(noteSansGrille({ bloquants: 9, aCorriger: 9, attention: 9 })).toBe(0);
  });
  it("contrôle absent = « non vérifié » (−8) : au plus 92", () => {
    expect(noteSansGrille({ bloquants: 0, aCorriger: 1, attention: 0 })).toBeLessThanOrEqual(92);
  });
  it("« scène retirée » compte (une alerte attention) : 90", () => {
    expect(noteSansGrille({ bloquants: 0, aCorriger: 0, attention: 1 })).toBeLessThan(100);
  });
  it("propriétés « avant » : note ≤ 25", () => {
    const r = controlerComposition({ format: avant.plan.format, dureeMs: avant.plan.dureeMs, imagesA: imagesPlanValideA(avant.plan), sousTitresA: rectsSousTitresA(avant.sousTitres) });
    const bloquants = r.defauts.filter((d) => d.gravite === "bloquant").length;
    const note = noteSansGrille({ bloquants, aCorriger: r.defauts.length - bloquants, attention: 0 });
    expect(bloquants).toBeGreaterThanOrEqual(3);
    expect(note).toBeLessThanOrEqual(25);
  });
});

describe("critère « Composition de l'image » de la grille", () => {
  // Entrée minimale : seuls les critères de composition nous intéressent.
  const entree = (composition?: ResultatControleComposition | null) => ({ controleImage: { controles: [], verdict: "livrable", nonFaits: 0, resume: "" }, controleur: { controles: [] }, dureeSec: 47, composition }) as unknown as EntreeGrille;
  const critere = (c?: ResultatControleComposition | null) => noterTutoriel(entree(c)).criteres.find((x) => x.id === "composition");

  it("absent (undefined) : « non fait », jamais réussi (comme null)", () => expect(critere(undefined)).toMatchObject({ etat: "non-fait" }));
  it("null : non fait, jamais réussi", () => expect(critere(null)).toMatchObject({ etat: "non-fait" }));
  it("propre : réussi", () => expect(critere(propre)).toMatchObject({ etat: "reussi" }));
  it("défaut bloquant : échoue en bloquant et rend la vidéo non proposable", () => {
    expect(critere(defaut("bloquant"))).toMatchObject({ etat: "echoue", gravite: "bloquant" });
    expect(noterTutoriel(entree(defaut("bloquant"))).proposable).toBe(false);
  });
  it("défaut à corriger : échoue en à corriger", () => expect(critere(defaut("a-corriger"))).toMatchObject({ etat: "echoue", gravite: "a-corriger" }));
});

describe("alertes de plan : la fonction réelle `alertesDe`", () => {
  const etat = (codes: string[]) => ({ reserves: [], plan: { remarques: codes.map((code) => ({ code, message: `m ${code}` })) } }) as unknown as EtatTutoriel;
  it("SCENE_RETIREE, SOUS_TITRES, LITTERALITE, TROP_COURT, DENSITE, TEXTE_TROP_LONG : « attention »", () => {
    const a = alertesDe(etat(["SCENE_RETIREE", "SOUS_TITRES", "LITTERALITE", "TROP_COURT", "DENSITE", "TEXTE_TROP_LONG"]));
    expect(a).toHaveLength(6);
    expect(a.every((x) => x.gravite === "attention" && x.message.startsWith("Plan · "))).toBe(true);
  });
  it("une autre remarque reste « info » ; les remarques du LLM indisponible sont écartées", () => {
    const a = alertesDe(etat(["AUTRE", "LLM_INDISPONIBLE", "LLM_ILLISIBLE"]));
    expect(a).toEqual([{ code: "defaut-visuel", gravite: "info", message: "Plan · m AUTRE" }]);
  });
});
