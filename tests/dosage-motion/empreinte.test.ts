import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { empreinteCasConcret, empreinteImageVideo, empreinteTableau } from "@/services/variete-commune/empreintes-a";
import { empreinteV4, empreinteCartes, avecDosageMotion } from "@/services/variete-commune/empreintes-b";
import { ressemblance, SEUIL_COMMUN } from "@/briques/variete-commune/ressemblance";
import { NEUTRES } from "@/briques/variete-commune/vocabulaire";
import { VERSION_VARIETE, type Mise } from "@/moteurs/montage-cas-concret/variete";
import { REFERENCES } from "@/briques/schema-motion/variete";
import type { EmpreinteVideo } from "@/briques/variete-commune/types";

const LE = "2026-11-17T10:00:00.000Z";
const mise = () =>
  ({
    version: VERSION_VARIETE, ecrans: {},
    tirage: {
      version: VERSION_VARIETE, graine: 1, sel: 0, ouverture: "chiffre-choc", structure: "resultat-d-abord", jeuAnimation: "glissement",
      sortie: "poussee", motParMot: "cascade", miseEnPage: {}, transitions: [], camera: { style: "douce", part: 0.5 }, fondFort: 0,
      particules: { groupe: 0, densite: "legere" }, sousTitres: { inclinaison: "v4", intensite: "vif", accent: "v4", hauteur: "v4" },
      bruitages: { depart: 0 }, fin: { phrase: 0, composition: 0, animation: 0 }, relache: 0, habille: true,
    },
  }) as unknown as Mise;

const base = (): EmpreinteVideo => empreinteV4("v1", LE, { types: [], entrees: [], familles: ["etiquette"] });
const emp = (videoId: string, axes: EmpreinteVideo["axes"]): EmpreinteVideo => ({ ...base(), videoId, axes });

describe("empreinte : l'axe dosage imposé (X3-11)", () => {
  it("cran choisi (vidéo ou générateur) → axe dosage = cran et imposes contient dosage", () => {
    for (const choisiPar of ["video", "generateur"] as const) {
      const e = empreinteCasConcret("v1", LE, mise(), undefined, { cran: "sobre", choisiPar });
      expect(e.axes.dosage).toEqual(["sobre"]);
      expect(e.imposes).toContain("dosage");
    }
    const e = empreinteV4("v1", LE, { types: [], entrees: [], familles: ["etiquette"] }, { cran: "dynamique", choisiPar: "video" });
    expect(e.axes.dosage).toEqual(["dynamique"]);
    expect(e.imposes).toEqual(["dosage"]);
  });
  it("choisiPar « code » : axe présent, mais non imposé", () => {
    const e = empreinteCartes("v1", LE, "avocat", [], { cran: "equilibre", choisiPar: "code" });
    expect(e.axes.dosage).toEqual(["equilibre"]);
    expect(e.imposes).toBeUndefined();
  });
  it("le cran de la commande remplace le dosage déduit du tirage", () => {
    const e = empreinteCasConcret("v1", LE, mise(), undefined, { cran: "aucun", choisiPar: "video" });
    expect(e.axes.dosage).toEqual(["aucun"]);
  });
  it("les cinq autres constructeurs acceptent le cran", () => {
    const d = { cran: "sobre", choisiPar: "video" } as const;
    const iv = empreinteImageVideo("v", LE, Object.values(REFERENCES)[0] as never, undefined, undefined, d);
    const tb = empreinteTableau("v", LE, "ardoise", undefined, d);
    for (const e of [iv, tb]) {
      expect(e.axes.dosage).toEqual(["sobre"]);
      expect(e.imposes).toEqual(["dosage"]);
    }
  });
  it("éteint : sans dosageMotion, empreinte identique à X2 (aucune clé imposes, aucun axe dosage ajouté)", () => {
    const sans = empreinteV4("v1", LE, { types: [], entrees: [], familles: ["etiquette"] });
    expect(sans).toStrictEqual(base());
    expect("imposes" in sans).toBe(false);
    expect(sans.axes.dosage).toBeUndefined();
    expect("imposes" in empreinteTableau("v", LE, "ardoise")).toBe(false);
    const e0 = base();
    expect(avecDosageMotion(e0, undefined)).toBe(e0);
  });
  it("ne modifie jamais l'empreinte reçue", () => {
    const e = base();
    const copie = JSON.stringify(e);
    avecDosageMotion(e, { cran: "sobre", choisiPar: "video" });
    expect(JSON.stringify(e)).toBe(copie);
  });
  it("deux vidéos « Aucun » de suite : l'axe dosage seul ne déclenche pas de refus", () => {
    const a = avecDosageMotion(emp("a", { ouverture: ["question"], palette: ["noir-dominant"], habillage: ["ardoise"], recit: ["une-journee"] }), { cran: "aucun", choisiPar: "video" });
    const b = avecDosageMotion(emp("b", { ouverture: ["affiche"], palette: ["ivoire-dominant"], habillage: ["papier"], recit: ["boucle"] }), { cran: "aucun", choisiPar: "video" });
    const r = ressemblance(a, b, NEUTRES);
    expect(r.axesCommuns).not.toContain("dosage");
    expect(r.score).not.toBeNull();
    expect(r.score as number).toBeLessThan(SEUIL_COMMUN);
  });
  it("une vidéo « Aucun » (axes neutres) ne fait pas refuser la suivante", () => {
    const neutre = avecDosageMotion(emp("a", { camera: ["aucune"], transitions: ["coupe"] }), { cran: "aucun", choisiPar: "video" });
    const suivante = avecDosageMotion(emp("b", { camera: ["aucune"], transitions: ["coupe"] }), { cran: "aucun", choisiPar: "video" });
    const r = ressemblance(neutre, suivante, NEUTRES);
    expect(r.axesCommuns).toEqual([]);
    expect(r.score === null || r.score < SEUIL_COMMUN).toBe(true);
  });
  it("garde statique : empreintes-a et -b restent sans @/services/ ni server-only", () => {
    for (const f of ["empreintes-a", "empreintes-b"]) {
      const src = readFileSync(resolve(__dirname, `../../src/services/variete-commune/${f}.ts`), "utf8");
      const imports = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
      expect(imports.filter((i) => i.startsWith("@/services/"))).toEqual([]);
      expect(imports).not.toContain("server-only");
    }
  });
});
