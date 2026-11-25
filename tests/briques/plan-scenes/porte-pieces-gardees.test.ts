/* eslint-disable @typescript-eslint/no-explicit-any -- pièce factice injectée dans le catalogue, le temps du test */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CATALOGUE_BRIQUES, pieceLaPlusProche } from "@/briques/plan-scenes/catalogue";
import { consignePlan } from "@/briques/plan-scenes/generateur";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import { TOILES } from "@/briques/plan-scenes/toiles";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { estGardee, PIECES_GARDEES } from "@/briques/plan-scenes/pieces-gardees";
import { appliquerOperations } from "@/services/retouche-chat/appliquer";
import { consigneRetouche } from "@/services/retouche-chat/comprendre";

const lire = (f: string) => readFileSync(new URL(`./__fixtures__/${f}`, import.meta.url), "utf8");
const AVANT = lire("consigne-avant-porte.txt");
const RETOUCHE_AVANT = lire("consigne-retouche-avant-objets.txt");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
// Valeurs relevées sur master (avant la fiche) : consignePlan(tous les ids objet) et consigneRetouche().
const SHA_PLAN_TOUS_OBJETS = "72be20c2a347af3ea5ba1bd529e890242dbeda0bcd92652499256b9883b18830";
const catalogue = CATALOGUE_BRIQUES as unknown as Record<string, any>;
const toiles = TOILES as unknown as Record<string, unknown>;
const copie = () => structuredClone(PLAN_DEMO) as unknown as Record<string, any>;
const gardees = PIECES_GARDEES as unknown as string[];
// VL-10 : la liste d'origine (les 3 pièces 16:9), restaurée après chaque test qui y pose une pièce factice.
const GARDEES_DE_ORIGINE = [...PIECES_GARDEES];
// C9-34-TRAITS-v19c : les 6 traits inscrits ensuite ne font pas partie des 18 objets d'avant ; on les exclut pour garder SHA_PLAN_TOUS_OBJETS figé (sha non recalculé).
const TRAITS_C9_34 = ["objet-soulignement-vague", "objet-soulignement-double", "objet-surligneur", "objet-fleche-droite", "objet-fleche-courbe", "objet-fleche-pointillee"];
// C9-34-CADRES-v20b : les 6 cadres et entourages inscrits ensuite sont exclus de la même façon (sha non recalculé).
const CADRES_C9_34 = ["objet-cadre-rectangle", "objet-cadre-coins", "objet-cadre-passage", "objet-cercle", "objet-ovale", "objet-double-boucle"];
// C9-34-ETIQUETTES-v20f : les 8 étiquettes et bulles inscrites ensuite sont exclues de la même façon (sha non recalculé).
const ETIQUETTES_C9_34 = ["objet-pastille-icone", "objet-etiquette-icone", "objet-badge", "objet-tampon", "objet-bulle-parole", "objet-bulle-pensee", "objet-bulle-notification", "objet-post-it"];
// C9-34-SCHEMAS-v20g : les 8 schémas, fenêtre et terminal inscrits ensuite sont exclus de la même façon (sha figé gardé).
const SCHEMAS_C9_34 = ["objet-schema-flux", "objet-schema-etoile", "objet-icones-reliees", "objet-agents-globe", "objet-grille-pointillee", "objet-vignettes-numerotees", "objet-fenetre-app", "objet-terminal-commande"];
// C9-34-FIN-v20h : les 10 derniers petits objets inscrits sont exclus de la même façon (sha figé gardé).
const FIN_C9_34 = ["objet-dossier", "objet-chrono", "objet-barre-progression", "objet-etape-segments", "objet-appel-action", "objet-appel-mot", "objet-appel-rdv", "objet-frise-montage", "objet-pellicule", "objet-onde-motif"];
// N-05-VOLET-d-v20j : le volet inscrit ensuite est exclu de la même façon (sha figé gardé).
const VOLET_N05 = ["objet-volet-avant-apres"];
const idsObjets = () => Object.values(CATALOGUE_BRIQUES).filter((d) => (d as any).famille === "objet" && !TRAITS_C9_34.includes(d.id) && !CADRES_C9_34.includes(d.id) && !ETIQUETTES_C9_34.includes(d.id) && !SCHEMAS_C9_34.includes(d.id) && !FIN_C9_34.includes(d.id) && !VOLET_N05.includes(d.id)).map((d) => d.id);

describe("G4-11-PORTE-a : éteint = identique à master", () => {
  it("la liste ne contient que les 3 pièces 16:9 de VL-10 et la courbe à plusieurs séries, et estGardee ≡ famille objet ou liste", () => {
    expect(PIECES_GARDEES).toEqual(["intercalaire-chapitre", "flux-ramifie", "cadre-capture", "courbe-series"]);
    for (const d of Object.values(CATALOGUE_BRIQUES) as any[]) expect(estGardee(d)).toBe(d.famille === "objet" || GARDEES_DE_ORIGINE.includes(d.id));
  });
  it("test 1 : consignePlan identique (sans argument, liste vide, tous les objets)", () => {
    expect(consignePlan()).toBe(AVANT);
    expect(consignePlan([])).toBe(AVANT);
    expect(sha(consignePlan(idsObjets()))).toBe(SHA_PLAN_TOUS_OBJETS);
  });
  it("test 4 : consigneRetouche identique au caractère près", () => {
    expect(consigneRetouche()).toBe(RETOUCHE_AVANT);
  });
});

describe("G4-11-PORTE-a : pièce de données factice gardée", () => {
  beforeEach(() => {
    catalogue["donnee-test"] = { ...catalogue["legende"], id: "donnee-test", nom: "Donnée test", famille: "donnee", alias: ["chiffres-test"] };
    toiles["donnee-test"] = { largeur: 800, hauteur: 460 };
    gardees.push("donnee-test");
  });
  afterEach(() => {
    delete catalogue["donnee-test"];
    delete toiles["donnee-test"];
    gardees.splice(0, gardees.length, ...GARDEES_DE_ORIGINE);
  });

  it("test 2 : consigne du plan, pièce la plus proche, validation", () => {
    expect(consignePlan()).toBe(AVANT);
    expect(consignePlan([])).toBe(AVANT);
    expect(consignePlan(["donnee-test"])).toContain("- donnee-test (Donnée test)");
    expect(pieceLaPlusProche("donnee-test")).not.toBe("donnee-test");
    expect(pieceLaPlusProche("chiffres-test")).not.toBe("donnee-test");
    expect(pieceLaPlusProche("chiffres-test", undefined, ["donnee-test"])).toBe("donnee-test");
    const p = copie();
    p.scenes[0].piece = "donnee-test";
    p.scenes[0].parametres = { texte: "Essai", sousTexte: "", style: "bandeau" };
    const sans = validerPlan(p);
    expect(sans.plan.scenes[0]!.piece).not.toBe("donnee-test");
    expect(sans.remarques.some((r) => /objet non permis/i.test(r.message))).toBe(true);
    const avec = validerPlan(p, { objetsPermis: ["donnee-test"] });
    expect(avec.plan.scenes[0]!.piece).toBe("donnee-test");
  });

  it("jamais l'exemple : paramètres faux → scène retirée, pas réparée", () => {
    const p = copie();
    p.scenes[0].piece = "donnee-test";
    p.scenes[0].parametres = { faux: true };
    const r = validerPlan(p, { objetsPermis: ["donnee-test"] });
    expect(r.plan.scenes.some((s) => (s.piece as string) === "donnee-test")).toBe(false);
  });

  it("test 4 : le chat de retouche ne la propose jamais, et la revalidation sans liste la remplace", () => {
    expect(consigneRetouche()).toBe(RETOUCHE_AVANT);
    expect(consigneRetouche()).not.toContain("donnee-test");
    const plan = validerPlan(PLAN_DEMO).plan;
    const r = appliquerOperations(plan, [{ type: "changer-brique", sceneId: plan.scenes[0]!.id, piece: "donnee-test" as any }]);
    expect(r.plan.scenes.some((s) => (s.piece as string) === "donnee-test")).toBe(false);
  });
});
