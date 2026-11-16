import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { empreinteCasConcret, empreinteImageVideo, empreinteTableau } from "@/services/variete-commune/empreintes-a";
import { VERSION_EMPREINTE } from "@/briques/variete-commune/version";
import { VERSION_VARIETE, type Mise } from "@/moteurs/montage-cas-concret/variete";
import { REFERENCES, type RecetteVarieteIV } from "@/briques/schema-motion/variete";

const LE = "2026-11-16T10:00:00.000Z";

const tirage = (o: Record<string, unknown> = {}) => ({
  version: VERSION_VARIETE, graine: 1, sel: 0, ouverture: "chiffre-choc", structure: "resultat-d-abord", jeuAnimation: "glissement",
  sortie: "poussee", motParMot: "cascade", miseEnPage: {}, transitions: [], camera: { style: "douce", part: 0.5 }, fondFort: 0,
  particules: { groupe: 0, densite: "legere" }, sousTitres: { inclinaison: "v4", intensite: "vif", accent: "v4", hauteur: "v4" },
  bruitages: { depart: 0 }, fin: { phrase: 0, composition: 0, animation: 0 }, relache: 0, ...o,
});
const mise = (t: Record<string, unknown> = {}, ecrans: Record<string, Record<string, unknown>> = {}, extra: Record<string, unknown> = {}) =>
  ({ version: VERSION_VARIETE, tirage: tirage(t), ecrans, ...extra }) as unknown as Mise;

describe("empreinteCasConcret", () => {
  it("donnée → empreinte attendue (vidéo habillée)", () => {
    const m = mise({ habille: true }, { e01: { camera: "zoom-lent", transition: "poussee" }, e02: { transition: "eclair" } });
    const e = empreinteCasConcret("v1", LE, m);
    expect(e).toEqual({
      version: VERSION_EMPREINTE, videoId: "v1", formatId: "cas-concret", le: LE,
      axes: { ouverture: ["chiffre-geant"], recit: ["resultat-d-abord"], dosage: ["autre:cas-concret:glissement"], camera: ["douce"], transitions: ["eclair", "poussee"], sousTitres: ["appuyes"] },
    });
  });
  it("sans habillage : caméra, transitions et jeu d'animation tirés mais non dessinés n'apparaissent pas", () => {
    const e = empreinteCasConcret("v1", LE, mise({}, { e01: { camera: "zoom-lent", transition: "poussee" } }));
    expect(e.axes).toEqual({ ouverture: ["chiffre-geant"], recit: ["resultat-d-abord"], sousTitres: ["appuyes"] });
  });
  it("une variante hors VARIANTES_RENDUES (raccord-objet) n'apparaît pas", () => {
    const e = empreinteCasConcret("v1", LE, mise({ habille: true }, { e01: { transition: "raccord-objet" } }));
    expect(e.axes.transitions).toBeUndefined();
  });
  it("sous-titres : comptés si l'interrupteur est vrai OU si la mise ne les dit pas sans variante (comme le rendu)", () => {
    expect(empreinteCasConcret("v1", LE, mise()).axes.sousTitres).toEqual(["appuyes"]);
    expect(empreinteCasConcret("v1", LE, mise({}, {}, { sousTitresSansVariante: true })).axes.sousTitres).toBeUndefined();
    expect(empreinteCasConcret("v1", LE, mise(), true).axes.sousTitres).toEqual(["appuyes"]);
    expect(empreinteCasConcret("v1", LE, mise({}, {}, { sousTitresSansVariante: true }), true).axes.sousTitres).toEqual(["appuyes"]);
  });
  it("même entrée → même sortie ; mise illisible : empreinte vide", () => {
    const m = mise({ habille: true }, { e01: { transition: "eclair" } });
    expect(empreinteCasConcret("v1", LE, m)).toEqual(empreinteCasConcret("v1", LE, m));
    expect(empreinteCasConcret("v1", LE, null).axes).toEqual({});
  });
});

describe("empreinteImageVideo", () => {
  const recette = { ...REFERENCES, ouverture: "OUV-A", recit: "REC-B", camera: "CAM-A", fin: "FIN-C", sousTitres: "SOU-B" } as unknown as RecetteVarieteIV;
  it("donnée → empreinte attendue ; sous-titres à 0 si VARIANTE_PAR_VERSION faux", () => {
    const e = empreinteImageVideo("iv1", LE, recette);
    expect(e.formatId).toBe("image-video");
    expect(e.axes.ouverture).toEqual(["chiffre-geant"]);
    expect(e.axes.recit).toEqual(["resultat-d-abord"]);
    expect(e.axes.camera).toEqual(["suivi"]);
    expect(e.axes.fin).toEqual(["boucle"]);
    expect(e.axes.sousTitres).toBeUndefined();
  });
  it("sous-titres comptés si le tirage par version est allumé", () => {
    expect(empreinteImageVideo("iv1", LE, recette, undefined, true).axes.sousTitres).toEqual(["equilibres"]);
  });
  it("un repli change la recette effective (ouverture repliée = OUV-D = question)", () => {
    const e = empreinteImageVideo("iv1", LE, recette, [{ axe: "ouverture" }]);
    expect(e.axes.ouverture).toEqual(["question"]);
  });
  it("même entrée → même sortie ; la recette reçue n'est pas modifiée", () => {
    const copie = JSON.stringify(recette);
    expect(empreinteImageVideo("iv1", LE, recette)).toEqual(empreinteImageVideo("iv1", LE, recette));
    expect(JSON.stringify(recette)).toBe(copie);
  });
});

describe("empreinteTableau", () => {
  const resume = { structure: "erreur-corrigee", dessins: ["loupe", "horloge"], accroche: "x", format: "f" };
  it("ardoise → noir-dominant, tableau blanc → ivoire-dominant, paperboard → table X2-02", () => {
    expect(empreinteTableau("t1", LE, "ardoise").axes.palette).toEqual(["noir-dominant"]);
    expect(empreinteTableau("t1", LE, "tableau-blanc").axes.palette).toEqual(["ivoire-dominant"]);
    expect(empreinteTableau("t1", LE, "paperboard").axes.palette).toEqual(["autre:tableau:paperboard"]);
  });
  it("habillage depuis le style, récit et objets depuis le résumé", () => {
    const e = empreinteTableau("t1", LE, "ardoise", resume);
    expect(e).toEqual({
      version: VERSION_EMPREINTE, videoId: "t1", formatId: "tableau", le: LE,
      axes: { habillage: ["ardoise"], palette: ["noir-dominant"], recit: ["autre:tableau:erreur-corrigee"], objets: ["horloge", "loupe"] },
    });
  });
  it("sans résumé : ni récit ni objets ; même entrée → même sortie", () => {
    const e = empreinteTableau("t1", LE, "ardoise");
    expect(e.axes.recit).toBeUndefined();
    expect(e.axes.objets).toBeUndefined();
    expect(e).toEqual(empreinteTableau("t1", LE, "ardoise"));
  });
});

describe("garde statique", () => {
  const src = readFileSync(resolve(__dirname, "../../src/services/variete-commune/empreintes-a.ts"), "utf8");
  const imports = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
  it("aucun import de @/services/ ni de image-video*.ts, ni server-only, ni entrée-sortie", () => {
    expect(imports.filter((i) => i.startsWith("@/services/"))).toEqual([]);
    expect(imports.filter((i) => /image-video[^/]*$/.test(i) && !i.startsWith("@/moteurs/") && !i.startsWith("@/briques/"))).toEqual([]);
    expect(imports).not.toContain("server-only");
    expect(imports.filter((i) => /^(node:)?(fs|http|https|net|child_process)/.test(i))).toEqual([]);
  });
});
