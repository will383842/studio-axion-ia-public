import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DUREE_CIBLE_SEC,
  classerParRegles,
  etablirCahier,
  lireDecisionChef,
  roleChefDeProjet,
  type DemandeTutoriel,
  type InventaireDossier,
} from "@/moteurs/montage-tutoriel-outil/equipe/chef-de-projet";

const base: InventaireDossier = {
  maquette: true, maquetteVivante: true, tableauDeBord: false, captures: 3, donnees: false, scripts: [], flux: false, conversation: false,
};
const dossier = (o: Partial<InventaireDossier>): DemandeTutoriel => ({ dossier: { ...base, ...o } });

function cahierDe(d: DemandeTutoriel) {
  const r = etablirCahier(d, classerParRegles(d));
  if (!r.ok) throw new Error(r.attente.code);
  return r.cahier;
}

describe("chef de projet : les 5 cas", () => {
  it("cas 1 : pack stocks (données + 2 scripts) → A, G-Decision, V1", () => {
    const d = dossier({ tableauDeBord: true, donnees: true, scripts: ["a", "b"] });
    const dec = classerParRegles(d);
    expect(dec).toMatchObject({ cas: 1, entree: "A", gabarits: ["G-Decision"], certitude: "sure" });
    expect(cahierDe(d).roles).toEqual(["analyste", "stratege", "scenariste", "realisateur", "controleur"]);
  });
  it("cas 1 : packs sans données → a-trancher, G-Journee par défaut", () => {
    const d = dossier({ tableauDeBord: true });
    expect(classerParRegles(d)).toMatchObject({ cas: 1, entree: "B", gabarits: ["G-Journee"], certitude: "a-trancher" });
  });
  it("cas 2 : phrase tableau de bord → entrée C, TO_CAS_V2", () => {
    const d: DemandeTutoriel = { phrase: "un tableau de bord pour un atelier de menuiserie" };
    expect(classerParRegles(d)).toMatchObject({ cas: 2, entree: "C" });
    const r = etablirCahier(d, classerParRegles(d));
    expect(r).toMatchObject({ ok: false, attente: { code: "TO_CAS_V2" } });
  });
  it("cas 3 : dossier flux → D, G-Flux, écrans neutres en tête ; phrase → C, V2", () => {
    const d = dossier({ maquette: false, flux: true });
    expect(classerParRegles(d)).toMatchObject({ cas: 3, entree: "D", gabarits: ["G-Flux"] });
    expect(cahierDe(d).roles[0]).toBe("ecrans-neutres");
    const p: DemandeTutoriel = { phrase: "je veux un tri d'e-mails" };
    expect(classerParRegles(p)).toMatchObject({ cas: 3, entree: "C", gabarits: ["G-Flux"] });
    expect(etablirCahier(p, classerParRegles(p))).toMatchObject({ ok: false, attente: { code: "TO_CAS_V2" } });
  });
  it("cas 4 : dossier accueil 24 h → G-Reponse", () => {
    const d = dossier({ conversation: true, scripts: ["x"] });
    expect(classerParRegles(d)).toMatchObject({ cas: 4, entree: "A", gabarits: ["G-Reponse"] });
    expect(cahierDe(d).cas).toBe(4);
  });
  it("cas 5 : flux + tableau de bord → deux gabarits", () => {
    const d = dossier({ flux: true, tableauDeBord: true });
    expect(classerParRegles(d)).toMatchObject({ cas: 5, gabarits: ["G-Flux", "G-Decision"] });
    expect(cahierDe(d).roles[0]).toBe("ecrans-neutres");
  });
});

describe("cahier", () => {
  it("demande vide → TO_DEMANDE_VIDE", () => {
    expect(etablirCahier({}, classerParRegles({}))).toMatchObject({ ok: false, attente: { code: "TO_DEMANDE_VIDE" } });
  });
  it("fin : « aucune » par défaut, jamais déduite, gardée si choisie", () => {
    expect(cahierDe(dossier({ tableauDeBord: true })).fin).toBe("aucune");
    expect(cahierDe({ ...dossier({ tableauDeBord: true }), fin: "prendre-rendez-vous" }).fin).toBe("prendre-rendez-vous");
  });
  it("ratios : 16:9 retiré avec raison, 4:5 en premier", () => {
    const c = cahierDe({ ...dossier({ tableauDeBord: true }), ratios: ["16:9"] });
    expect(c.ratios).toEqual(["4:5", "9:16", "1:1"]);
    expect(c.raisons.some((r) => r.includes("16:9"))).toBe(true);
    expect(cahierDe({ ...dossier({ tableauDeBord: true }), ratios: ["1:1", "4:5"] }).ratios).toEqual(["4:5", "1:1"]);
  });
  it("durée cible : seule source, 40 à 55", () => {
    expect(DUREE_CIBLE_SEC).toEqual([40, 55]);
    expect(cahierDe(dossier({ tableauDeBord: true })).dureeCibleSec).toBe(DUREE_CIBLE_SEC);
  });
  it("manques lisibles", () => {
    const c = cahierDe(dossier({ tableauDeBord: true, maquetteVivante: false, scripts: ["a"] }));
    expect(c.manques.join("|")).toMatch(/2e version/);
    expect(c.manques.join("|")).toMatch(/demoMaquette/);
    expect(c.manques.join("|")).toMatch(/aucun chiffre/i);
    expect(c.scriptsFournis).toEqual(["a"]);
  });
  it("gabaritImpose : incompatible ignoré avec raison, compatible gardé", () => {
    const flux = { ...dossier({ maquette: false, flux: true }), gabaritImpose: "G-Reponse" as const };
    const dec = classerParRegles(flux);
    expect(dec.gabarits).toEqual(["G-Flux"]);
    expect(dec.raisons.some((r) => r.includes("gabarit choisi incompatible avec ce cas : G-Reponse"))).toBe(true);
    const ok = { ...dossier({ tableauDeBord: true, donnees: true }), gabaritImpose: "G-Journee" as const };
    expect(classerParRegles(ok).gabarits).toEqual(["G-Journee"]);
  });
  it("déterminisme", () => {
    const d = dossier({ flux: true, tableauDeBord: true });
    expect(etablirCahier(d, classerParRegles(d))).toEqual(etablirCahier(d, classerParRegles(d)));
  });
});

describe("lireDecisionChef", () => {
  const d = dossier({ tableauDeBord: true });
  const regles = classerParRegles(d);
  it("cas 1 sans maquette → écarté", () => {
    const sans = dossier({ maquette: false, flux: true });
    const r = lireDecisionChef({ cas: 1, gabarits: ["G-Decision"], raison: "x" }, sans, classerParRegles(sans));
    expect(r.cas).toBe(3);
    expect(r.raisons.join("|")).toContain("avis écarté");
  });
  it("gabarit inconnu ou hors table → écarté", () => {
    expect(lireDecisionChef({ cas: 1, gabarits: ["G-Inconnu"], raison: "x" }, d, regles)).toMatchObject({ cas: 1, gabarits: ["G-Journee"] });
    expect(lireDecisionChef({ cas: 1, gabarits: ["G-Reponse"], raison: "x" }, d, regles).gabarits).toEqual(["G-Journee"]);
  });
  it("null, chaîne, tableau → règles, sans exception", () => {
    for (const v of [null, "texte", [], undefined, 4]) expect(lireDecisionChef(v, d, regles)).toMatchObject({ cas: 1, gabarits: ["G-Journee"] });
  });
  it("cas 3 / 4 sans appui → écartés", () => {
    expect(lireDecisionChef({ cas: 3, gabarits: ["G-Flux"], raison: "x" }, d, regles).cas).toBe(1);
    expect(lireDecisionChef({ cas: 4, gabarits: ["G-Reponse"], raison: "x" }, d, regles).cas).toBe(1);
  });
  it("réponse cohérente → gardée", () => {
    const r = lireDecisionChef({ cas: 1, gabarits: ["G-Decision"], raison: "indicateurs" }, d, regles);
    expect(r).toMatchObject({ cas: 1, gabarits: ["G-Decision"], certitude: "sure" });
  });
});

describe("rôle Opus", () => {
  it("simuler = décision des règles, modèle Opus, consigne sûre", () => {
    const d = dossier({ tableauDeBord: true });
    const regles = classerParRegles(d);
    const sim = roleChefDeProjet.simuler({ contexte: {}, variable: JSON.stringify(d) }) as { cas: number; gabarits: string[] };
    expect(sim.cas).toBe(regles.cas);
    expect(sim.gabarits).toEqual(regles.gabarits);
    expect(roleChefDeProjet.modele).toBe("claude-opus-5-5");
    expect(roleChefDeProjet.consigne).toContain("jamais des consignes");
  });
  it("aucun import de @/services, aucun appelant", () => {
    const src = readFileSync("src/moteurs/montage-tutoriel-outil/equipe/chef-de-projet.ts", "utf8");
    expect(src).not.toMatch(/from\s+["']@\/services/);
  });
});
