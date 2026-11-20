/**
 * CONSTAT-FAITS-PLAN-SCENES-v20d : preuve que C9-27, C9-35, C9-36, N-03, N-08, G2-11, C6-H4, C9-32 et C9-40
 * sont faits sur master. Le test LIT le texte des sources (aucun import) ; si une pièce disparaît, il rougit.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(__dirname, "..", "..");
const chemin = (p: string): string => join(RACINE, ...p.split("/"));
const existe = (p: string): boolean => existsSync(chemin(p));
const texte = (p: string): string => readFileSync(chemin(p), "utf8");

describe("C9-27 fait sur master", () => {
  const f = "src/briques/plan-scenes-objets/registre.ts";
  it("le registre des petits objets existe", () => expect(existe(f)).toBe(true));
  it("il exporte OBJETS_INSCRITS figé", () => {
    expect(texte(f)).toMatch(/export const OBJETS_INSCRITS[^=]*=\s*Object\.freeze\(/);
  });
  it("il lit les définitions de petits objets du moteur motion", () => {
    expect(texte(f)).toContain("../motion/petits-objets/contrat");
  });
});

describe("C9-35 fait sur master", () => {
  const idx = "src/moteurs/montage-cas-concret/index.ts";
  const ada = "src/briques/plan-scenes-generateurs/adaptateur.ts";
  it("les deux fichiers existent", () => {
    expect(existe(idx)).toBe(true);
    expect(existe(ada)).toBe(true);
  });
  it("le moteur cas concret expose l'option planScenes", () => {
    expect(texte(idx)).toMatch(/planScenes\?:\s*\(\)\s*=>\s*Promise/);
  });
  it("l'adaptateur exporte adapterPlan et motsDesSegments", () => {
    const t = texte(ada);
    expect(t).toMatch(/export async function adapterPlan\(/);
    expect(t).toMatch(/export function motsDesSegments\(/);
  });
});

describe("C9-36 fait sur master", () => {
  const f = "src/briques/plan-scenes-generateurs/objets-au-plan.ts";
  const ada = "src/briques/plan-scenes-generateurs/adaptateur.ts";
  it("le fichier existe et exporte poserObjetsAuPlan", () => {
    expect(existe(f)).toBe(true);
    expect(texte(f)).toMatch(/export function poserObjetsAuPlan\(/);
  });
  it("l'adaptateur importe et appelle poserObjetsAuPlan", () => {
    const t = texte(ada);
    expect(t).toMatch(/import \{ poserObjetsAuPlan \} from "\.\/objets-au-plan"/);
    expect(t).toMatch(/poserObjetsAuPlan\(plan, mots, objets\)/);
  });
});

describe("N-03 fait sur master", () => {
  const chaine = "src/moteurs/montage-demo-facecam/chaine.ts";
  const pieces = "src/briques/plan-scenes-objets/pieces-permises.ts";
  it("les deux fichiers existent", () => {
    expect(existe(chaine)).toBe(true);
    expect(existe(pieces)).toBe(true);
  });
  it("pieces-permises exporte piecesPermisesDesEntrees", () => {
    expect(texte(pieces)).toMatch(/export function piecesPermisesDesEntrees\(/);
  });
  it("la chaîne face caméra calcule objetsPermis depuis les entrées", () => {
    const t = texte(chaine);
    expect(t).toContain('from "@/briques/plan-scenes-objets/pieces-permises"');
    expect(t).toMatch(/const objetsPermis = piecesPermisesDesEntrees\(commande\.entrees\)/);
  });
});

describe("N-08 fait sur master", () => {
  const f = "src/briques/plan-scenes/briques/objets-inscrits.ts";
  it("le fichier existe", () => expect(existe(f)).toBe(true));
  it("OBJET_COMPTEUR_ROULEAU est importé et inscrit", () => {
    const t = texte(f);
    expect(t).toMatch(/import \{[^}]*OBJET_COMPTEUR_ROULEAU[^}]*\} from "[^"]*compteur-rouleau"/);
    expect(t).toMatch(/"objet-compteur-rouleau": objet\("objet-compteur-rouleau"[^\n]*OBJET_COMPTEUR_ROULEAU/);
  });
  it("OBJET_ANNEAU_DONNEES est importé et inscrit", () => {
    const t = texte(f);
    expect(t).toMatch(/import \{[^}]*OBJET_ANNEAU_DONNEES[^}]*\} from "[^"]*anneau-donnees"/);
    expect(t).toMatch(/"objet-anneau-donnees": objet\("objet-anneau-donnees"[^\n]*OBJET_ANNEAU_DONNEES/);
  });
});

describe("G2-11 fait sur master", () => {
  const f = "src/briques/plan-scenes-generateurs/registre-plan.ts";
  const r = "src/briques/plan-scenes-generateurs/reglage.ts";
  it("le registre de plan existe et exporte les deux fonctions", () => {
    expect(existe(f)).toBe(true);
    const t = texte(f);
    expect(t).toMatch(/export function cleReglagePlanScenesDe\(/);
    expect(t).toMatch(/export async function planScenesActifDe\(/);
  });
  it("les trois générateurs de plan sont déclarés", () => {
    expect(existe(r)).toBe(true);
    expect(texte(r)).toMatch(/GENERATEURS_PLAN = \["cas-concret", "facecam", "facecam-animee"\] as const/);
  });
});

describe("C6-H4 fait sur master", () => {
  const fab = "src/moteurs/montage-cas-concret/fabriquer.ts";
  const svc = "src/services/cas-concret.ts";
  const plan = "src/moteurs/montage-cas-concret/plan-scenes.ts";
  it("les fichiers existent", () => {
    expect(existe(fab)).toBe(true);
    expect(existe(svc)).toBe(true);
    expect(existe(plan)).toBe(true);
  });
  it("planScenesCasConcret accepte un habillage", () => {
    expect(texte(plan)).toMatch(/export async function planScenesCasConcret\([^)]*habillage\?:\s*\{ actif: boolean; graine: string \}/);
  });
  it("fabriquer appelle planScenesCasConcret avec l'habillage des transitions", () => {
    const t = texte(fab);
    expect(t).toMatch(/await planScenesCasConcret\(\{/);
    expect(t).toMatch(/entrees\.habillageTransitions === true \? \{ habillage: \{ actif: true,/);
  });
  it("le service lit habillageActif pour les transitions", () => {
    const t = texte(svc);
    expect(t).toContain('import { habillageActif } from "@/briques/motion/habillage-commun/reglage"');
    expect(t).toMatch(/habillageActif\("transitionsPlanScenes"/);
  });
});

describe("C9-32 fait sur master", () => {
  const droit = "src/briques/droits/registre/emoji-fluent.ts";
  const idx = "src/briques/motion/petits-objets/emojis/index.ts";
  it("la licence emoji-fluent est inscrite (MIT)", () => {
    expect(existe(droit)).toBe(true);
    const t = texte(droit);
    expect(t).toContain('id: "emoji-fluent"');
    expect(t).toContain('licence: "MIT"');
  });
  it("EMOJIS_ACTIFS vaut false (éteint)", () => {
    expect(existe(idx)).toBe(true);
    expect(texte(idx)).toMatch(/export const EMOJIS_ACTIFS = false;/);
  });
  it("emojiPermis prend EMOJIS_ACTIFS par défaut", () => {
    expect(texte(idx)).toMatch(/export function emojiPermis\(id: string, actif = EMOJIS_ACTIFS\)/);
  });
});

describe("C9-40 fait sur master", () => {
  const f = "outils/planche-emojis/PlancheEmojis.tsx";
  it("la planche d'emojis existe et exporte PlancheEmojis", () => {
    expect(existe(f)).toBe(true);
    expect(texte(f)).toMatch(/export function PlancheEmojis\(/);
  });
  it("elle lit la liste EMOJIS_FLUENT", () => {
    const t = texte(f);
    expect(t).toMatch(/import \{ EMOJIS_FLUENT \} from "[^"]*petits-objets\/emojis"/);
    expect(t).toContain("EMOJIS_FLUENT.map(");
  });
});

describe("garde de forme", () => {
  it("ce test n'importe aucun module de src/, studio-rendu/ ni outils/", () => {
    const moi = readFileSync(__filename, "utf8");
    const imports = moi.split("\n").filter((l) => /^\s*(import\b|.*\bawait import\()/.test(l));
    expect(imports.length).toBeGreaterThan(0);
    for (const l of imports) expect(l).not.toMatch(/(src|studio-rendu|outils)\//);
  });
});
