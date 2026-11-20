import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DUREE_CIBLE_SEC,
  MOTS_TABLEAU,
  PHRASE_MAX,
  PHRASE_MIN,
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

describe("corrections du verdict Opus", () => {
  it("avis cas 1 sur un dossier sans tableau de bord (phrase seule en appui) → écarté, TO_CAS_V2", () => {
    const d: DemandeTutoriel = { ...dossier({}), phrase: "un tableau de bord et le tri des factures" };
    const regles = classerParRegles(d);
    expect(regles.entree).toBe("C");
    const r = lireDecisionChef({ cas: 1, gabarits: ["G-Journee"], raison: "x" }, d, regles);
    expect(r.cas).toBe(regles.cas);
    expect(r.entree).toBe("C");
    expect(etablirCahier(d, r)).toMatchObject({ ok: false, attente: { code: "TO_CAS_V2" } });
  });
  it("avis cas 4 retenu sur la phrase seule, dossier sans conversation → reste en entrée C, TO_CAS_V2", () => {
    const d: DemandeTutoriel = { ...dossier({}), phrase: "un assistant qui répond aux clients" };
    const regles = classerParRegles(d);
    expect(regles.entree).toBe("C");
    const r = lireDecisionChef({ cas: 4, gabarits: ["G-Reponse"], raison: "x" }, d, regles);
    expect(r.entree).toBe("C");
    expect(etablirCahier(d, r)).toMatchObject({ ok: false, attente: { code: "TO_CAS_V2" } });
  });
  it("dossier sans tableau de bord, flux ni conversation → TO_CAS_V2, pas de cahier V1", () => {
    const d = dossier({ tableauDeBord: false });
    const dec = classerParRegles(d);
    expect(dec).toMatchObject({ cas: 2, entree: "C" });
    expect(etablirCahier(d, dec)).toMatchObject({ ok: false, attente: { code: "TO_CAS_V2" } });
  });
  it("dossier sans maquette + phrase tri et tableau de bord → entrée C, TO_CAS_V2", () => {
    const d: DemandeTutoriel = { ...dossier({ maquette: false }), phrase: "tri des factures et tableau de bord" };
    const dec = classerParRegles(d);
    expect(dec.entree).toBe("C");
    expect(etablirCahier(d, dec)).toMatchObject({ ok: false, attente: { code: "TO_CAS_V2" } });
  });
  it("avis cas 2 avec un dossier → écarté", () => {
    const d = dossier({ tableauDeBord: true });
    const r = lireDecisionChef({ cas: 2, gabarits: ["G-Journee"], raison: "x" }, d, classerParRegles(d));
    expect(r.cas).toBe(1);
    expect(r.raisons.join("|")).toContain("avis écarté");
  });
  it("avis cas 5 sans flux ni phrase d'automatisation → écarté ; sans tableau de bord → écarté", () => {
    const d = dossier({ tableauDeBord: true });
    const a = lireDecisionChef({ cas: 5, gabarits: ["G-Flux", "G-Decision"], raison: "x" }, d, classerParRegles(d));
    expect(a.cas).toBe(1);
    expect(a.raisons.join("|")).toContain("avis écarté");
    const f = dossier({ flux: true });
    const b = lireDecisionChef({ cas: 5, gabarits: ["G-Flux", "G-Decision"], raison: "x" }, f, classerParRegles(f));
    expect(b.cas).toBe(3);
    expect(b.raisons.join("|")).toContain("avis écarté");
  });
  it("avis cas 3 retenu pour un dossier de flux → entrée D", () => {
    const d = dossier({ flux: true, scripts: ["a"] });
    const r = lireDecisionChef({ cas: 3, gabarits: ["G-Flux"], raison: "x" }, d, classerParRegles(d));
    expect(r).toMatchObject({ cas: 3, entree: "D" });
  });
  it("MOTS_TABLEAU : « piloter », plus de faute de frappe", () => {
    expect(MOTS_TABLEAU).toContain("piloter");
    expect(MOTS_TABLEAU).not.toContain("pilotier");
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
  it("git grep : aucun appelant de equipe/chef-de-projet dans src ni studio-rendu", () => {
    let sortie = "";
    try {
      sortie = execFileSync("git", ["grep", "-n", "equipe/chef-de-projet", "--", "src", "studio-rendu"], { encoding: "utf8" });
    } catch {
      sortie = ""; // code 1 = aucune ligne trouvée
    }
    // Appelants permis : le chef de projet lui-même, et diffusion-tutoriel.ts (T-EXT-43, qui lit DUREE_CIBLE_SEC, seule source de la durée).
    // AUTORISATION PERMANENTE (a) : ajout d'un appelant permis, rien de retiré.
    // AUTORISATION PERMANENTE (a) : grille-qualite.ts (T-EXT-27) lit aussi DUREE_CIBLE_SEC.
    const PERMIS = [
      "src/moteurs/montage-tutoriel-outil/equipe/chef-de-projet.ts:",
      "src/moteurs/montage-tutoriel-outil/diffusion-tutoriel.ts:",
      "src/moteurs/montage-tutoriel-outil/grille-qualite.ts:",
    ];
    const appelants = sortie.split("\n").filter((l) => l && !PERMIS.some((p) => l.startsWith(p)));
    expect(appelants).toEqual([]);
  });
});

describe("V2-01 : option phraseOuverte (cas 2 et 3 depuis une phrase)", () => {
  // Message d'aujourd'hui, recopié tel quel de la version d'avant (le test d'avant le comparait à ce texte).
  const MESSAGE_D_AUJOURD_HUI =
    "Cette demande part d'une phrase seule : la création de la maquette arrive dans une version suivante. Votre demande est gardée, rien n'a échoué.";
  const atelier: DemandeTutoriel = { phrase: "un tableau de bord pour un atelier de menuiserie" };
  const tri: DemandeTutoriel = { phrase: "je veux un tri d'e-mails" };
  const ouvrir = (d: DemandeTutoriel) => etablirCahier(d, classerParRegles(d), { phraseOuverte: true });

  it("sans option, avec {} ou avec false : la pause d'aujourd'hui, mot pour mot", () => {
    const dec = classerParRegles(atelier);
    const attendu = { ok: false, attente: { code: "TO_CAS_V2", message: MESSAGE_D_AUJOURD_HUI } };
    expect(etablirCahier(atelier, dec)).toEqual(attendu);
    expect(etablirCahier(atelier, dec, {})).toEqual(attendu);
    expect(etablirCahier(atelier, dec, { phraseOuverte: false })).toEqual(attendu);
  });
  it("seul le booléen exact true allume", () => {
    const dec = classerParRegles(atelier);
    for (const faux of ["true", 1, "oui", null, undefined]) {
      const r = etablirCahier(atelier, dec, { phraseOuverte: faux as unknown as boolean });
      expect(r).toMatchObject({ ok: false, attente: { code: "TO_CAS_V2", message: MESSAGE_D_AUJOURD_HUI } });
    }
  });
  it("true : tableau de bord pour un atelier → cas 2, entrée C, maquettiste en tête, manque « maquette »", () => {
    const r = ouvrir(atelier);
    if (!r.ok) throw new Error(r.attente.code);
    expect(r.cahier).toMatchObject({ entree: "C", cas: 2, manques: ["maquette"], scriptsFournis: [] });
    expect(r.cahier.roles[0]).toBe("maquettiste");
    expect(r.cahier.roles).toEqual(["maquettiste", "analyste", "stratege", "scenariste", "realisateur", "controleur"]);
    expect(r.cahier.dureeCibleSec).toEqual(DUREE_CIBLE_SEC);
  });
  it("true : tri d'e-mails → cas 3, G-Flux, maquettiste puis écrans neutres, manque « flux-automatisation »", () => {
    const r = ouvrir(tri);
    if (!r.ok) throw new Error(r.attente.code);
    expect(r.cahier).toMatchObject({ entree: "C", cas: 3, gabarits: ["G-Flux"], manques: ["flux-automatisation"] });
    expect(r.cahier.roles.slice(0, 2)).toEqual(["maquettiste", "ecrans-neutres"]);
  });
  it("true : assistant → pause « assistant ou mélange » ; mélange tableau + automatisation aussi", () => {
    const a = ouvrir({ phrase: "un assistant qui répond aux questions" });
    expect(a).toMatchObject({ ok: false, attente: { code: "TO_CAS_V2" } });
    if (a.ok) throw new Error("attendu : pause");
    expect(a.attente.message).toContain("assistant ou un mélange");
    const m = ouvrir({ phrase: "un tableau de bord avec un tri des e-mails" });
    expect(m).toMatchObject({ ok: false, attente: { code: "TO_CAS_V2" } });
  });
  it("true : phrase trop longue → raccourcissez-la ; trop courte → TO_DEMANDE_VIDE", () => {
    expect(PHRASE_MIN).toBe(10);
    expect(PHRASE_MAX).toBe(300);
    const longue = ouvrir({ phrase: "tableau ".repeat(40).slice(0, PHRASE_MAX + 1) });
    expect(longue).toMatchObject({ ok: false, attente: { code: "TO_CAS_V2" } });
    if (longue.ok) throw new Error("attendu : pause");
    expect(longue.attente.message).toContain("raccourcissez-la");
    expect(ouvrir({ phrase: "atelier" })).toMatchObject({ ok: false, attente: { code: "TO_DEMANDE_VIDE" } });
    expect(ouvrir({ phrase: "  atelier  " })).toMatchObject({ ok: false, attente: { code: "TO_DEMANDE_VIDE" } });
    // limites exactes : 10 et 300 caractères passent
    expect(ouvrir({ phrase: "tableau 10" }).ok).toBe(true);
    expect(ouvrir({ phrase: "tableau ".repeat(40).slice(0, PHRASE_MAX) }).ok).toBe(true);
  });
  it("true avec un dossier : cahier d'aujourd'hui, l'option ne change rien", () => {
    const d = dossier({ tableauDeBord: true, donnees: true, scripts: ["a", "b"] });
    const dec = classerParRegles(d);
    expect(etablirCahier(d, dec, { phraseOuverte: true })).toEqual(etablirCahier(d, dec));
    const sans = dossier({});
    expect(etablirCahier(sans, classerParRegles(sans), { phraseOuverte: true })).toEqual(etablirCahier(sans, classerParRegles(sans)));
  });
  it("la phrase reste une donnée : absente de tout le cahier", () => {
    for (const d of [atelier, tri]) {
      const r = ouvrir(d);
      if (!r.ok) throw new Error(r.attente.code);
      const json = JSON.stringify(r.cahier).toLowerCase();
      expect(json).not.toContain("menuiserie");
      expect(json).not.toContain("e-mails");
      expect(json).not.toContain("atelier");
    }
  });
  it("un avis de Claude ne transforme toujours pas une phrase en dossier (entrée C gardée)", () => {
    const dec = lireDecisionChef({ cas: 2, gabarits: ["G-Journee"], raison: "tableau" }, atelier, classerParRegles(atelier));
    expect(dec.entree).toBe("C");
    expect(etablirCahier(atelier, dec)).toMatchObject({ ok: false, attente: { code: "TO_CAS_V2" } });
  });
});
