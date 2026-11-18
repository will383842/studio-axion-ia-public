import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { GENERATEURS, NEUTRES, versCommun, type GenerateurCommun } from "@/briques/variete-commune/vocabulaire";
import { empreinteTutoriel } from "@/services/variete-commune/empreintes-tutoriel";

const LE = "2026-11-18T10:00:00.000Z";
const tr = (entree: string, sortie: string) => ({ entree, sortie, dureeMs: 400 });
const scene = (id: string, piece: string, entree: string, sortie: string, calques?: { piece: string }[]) => ({
  id, version: 1, empreinte: "0123456789abcdef", mots: { premier: 0, dernier: 1 }, debutMs: 0, finMs: 1000, niveau: 1,
  position: "centre", transition: tr(entree, sortie), piece, parametres: {}, calques,
});
/** Plan fictif de 4 scènes : aucun appel, aucune validation (le test ne lit que `scenes`). */
const PLAN = {
  version: "plan-scenes-1", format: { largeur: 1080, hauteur: 1350, fps: 25 }, facecam: false, dureeMs: 4000,
  habillage: { fond: "ivoire", accent: "terracotta" }, mots: [],
  scenes: [
    scene("a", "legende", "fondu", "fondu"),
    scene("b", "curseur", "fondu", "glisse-haut"),
    scene("c", "zoom-camera", "glisse-haut", "zoom-doux"),
    scene("d", "carte-kpi", "glisse-gauche", "fondu"),
  ],
} as unknown as PlanValide;

describe("T-EXT-26b empreinte du tutoriel", () => {
  it("objets : pièces réellement dessinées, triées, sans doublon, sans équivalent commun", () => {
    const e = empreinteTutoriel("v1", LE, PLAN, {});
    expect(e.formatId).toBe("tutoriel-outil");
    expect(e.axes.objets).toEqual(["autre:tutoriel:carte-kpi", "autre:tutoriel:curseur", "autre:tutoriel:legende", "autre:tutoriel:zoom-camera"]);
    const plan2 = { ...PLAN, scenes: [...PLAN.scenes, scene("e", "legende", "fondu", "fondu", [{ piece: "curseur" }])] } as unknown as PlanValide;
    expect(empreinteTutoriel("v1", LE, plan2, {}).axes.objets).toEqual(e.axes.objets);
  });
  it("transitions : entrée et sortie, chacune comptée une fois", () => {
    expect(empreinteTutoriel("v1", LE, PLAN, {}).axes.transitions).toEqual([
      "autre:tutoriel:fondu", "autre:tutoriel:glisse-gauche", "autre:tutoriel:glisse-haut", "autre:tutoriel:zoom-doux",
    ]);
  });
  it("récit : G-Journee commun, G-Flux sans équivalent, gabarit inconnu ignoré", () => {
    expect(empreinteTutoriel("v", LE, PLAN, { gabarit: "G-Journee" }).axes.recit).toEqual(["une-journee"]);
    expect(empreinteTutoriel("v", LE, PLAN, { gabarit: "G-Flux" }).axes.recit).toEqual(["autre:tutoriel:G-Flux"]);
    expect(empreinteTutoriel("v", LE, PLAN, { gabarit: "G-Inconnu" }).axes.recit).toBeUndefined();
    expect(empreinteTutoriel("v", LE, PLAN, {}).axes.recit).toBeUndefined();
  });
  it("sous-titres : lecture du cas concret ; valeur inconnue ignorée", () => {
    expect(empreinteTutoriel("v", LE, PLAN, { sousTitres: "sobre" }).axes.sousTitres).toEqual(["calmes"]);
    expect(empreinteTutoriel("v", LE, PLAN, { sousTitres: "equilibre" }).axes.sousTitres).toEqual(["equilibres"]);
    expect(empreinteTutoriel("v", LE, PLAN, { sousTitres: "tres-dynamique" }).axes.sousTitres).toEqual(["appuyes"]);
    expect(empreinteTutoriel("v", LE, PLAN, { sousTitres: "zzz" }).axes.sousTitres).toBeUndefined();
  });
  it("dosage : `aucun` présent mais neutre ; sans dosage, aucun axe dosage", () => {
    const e = empreinteTutoriel("v", LE, PLAN, { dosage: { cran: "aucun", choisiPar: "video" } });
    expect(e.axes.dosage).toEqual(["aucun"]);
    expect(NEUTRES).toContain("aucun");
    expect(e.imposes).toEqual(["dosage"]);
    expect(empreinteTutoriel("v", LE, PLAN, {}).axes.dosage).toBeUndefined();
  });
  it("déterminisme et entrée intacte", () => {
    const avant = JSON.stringify(PLAN);
    const choix = { gabarit: "G-Journee", sousTitres: "sobre", dosage: { cran: "sobre", choisiPar: "code" as const } };
    expect(empreinteTutoriel("v", LE, PLAN, choix)).toEqual(empreinteTutoriel("v", LE, PLAN, choix));
    expect(JSON.stringify(PLAN)).toBe(avant);
  });
  it("vocabulaire : « tutoriel » répond ; les 5 générateurs d'avant gardent leurs réponses", () => {
    expect(GENERATEURS).toEqual(["cas-concret", "image-video", "tableau", "facecam-animee", "cartes", "tutoriel"]);
    expect(versCommun("tutoriel", "dosage", "equilibre")).toBe("equilibre");
    expect(versCommun("tutoriel", "recit", "G-Journee")).toBe("une-journee");
    expect(versCommun("tutoriel", "transitions", "fondu")).toBe("autre:tutoriel:fondu");
    expect(versCommun("tutoriel", "ouverture", "x")).toBe("autre:tutoriel:x");
    const avant: [GenerateurCommun, "habillage" | "transitions" | "ouverture", string, string][] = [
      ["tableau", "habillage", "ardoise", "ardoise"],
      ["tableau", "habillage", "inconnu", "autre:tableau:inconnu"],
      ["cas-concret", "ouverture", "inconnu", "autre:cas-concret:inconnu"],
      ["cartes", "transitions", "inconnu", "autre:cartes:inconnu"],
      ["image-video", "ouverture", "OUV-A", "chiffre-geant"],
      ["facecam-animee", "ouverture", "inconnu", "autre:facecam-animee:inconnu"],
    ];
    for (const [g, axe, code, attendu] of avant) expect(versCommun(g, axe, code)).toBe(attendu);
  });
  it("aucun fichier hors services/variete-commune et tests n'importe empreintes-tutoriel", () => {
    const racine = resolve(__dirname, "..", "..");
    let sortie = "";
    try { sortie = execFileSync("git", ["grep", "-l", "empreintes-tutoriel", "--", "src", "scripts", "studio-rendu"], { cwd: racine, encoding: "utf8" }); } catch { sortie = ""; }
    const fichiers = sortie.split("\n").filter(Boolean).filter((f) => !f.startsWith("src/services/variete-commune/"));
    expect(fichiers).toEqual([]);
  });
});
