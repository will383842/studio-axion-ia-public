/**
 * 25/10/2026 (compositions-iv/13) : vue d'ensemble de la vidéo v-b54bb4798246 (fixture de `facturation-j30-scene.test.ts`).
 *
 * Cause : quatre branches en quatre colonnes de 231 px (207 utiles) ; au plancher, « AUTOLIQUIDATION » mesure 370 px et « CORRECTION »
 * 261 px. `ajusterAnton` signalait « trop long » et laissait le mot dépasser ; le texte blanc, hors pastille, devenait invisible
 * (« OLIQUIDAT »). Q21 ne voyait rien : elle ne relisait que les rectangles. Désormais le mot trop large est abrégé (alerte
 * d'information), jamais de texte hors de son bloc, et Q21 mesure ce débordement.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { largeurAnton } from "@/briques/schema-motion/chasse-anton";
import { debordementsEnsemble, libelleCourt, planEnsemble, type PlanEnsemble } from "@/briques/schema-motion/plan-objets";
import { BRUITAGES_V4_IV } from "@/moteurs/montage-image-video/fabrication";
import { miseEnPageAuxInstantsIV } from "@/moteurs/montage-image-video/emprise-ligne";
import { mettreEnSceneIV, type BlocRenduIV, type EntreeMiseEnSceneIV, type ResultatMiseEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { recettePourVersion } from "@/moteurs/montage-image-video/variete/tirage";

interface PisteFixture { version: string; reseaux: string[]; dureeSec: number; finVoixSec: number; motsCorps: number; mots: { mot: string; debutSec: number; finSec: number }[] }
interface FinFixture { id: string; muet: boolean }
const F = JSON.parse(readFileSync(join(__dirname, "fixtures", "facturation-j30-scene.json"), "utf8")) as {
  videoId: string;
  carte: unknown;
  fiche: unknown;
  recette: unknown;
  fins: FinFixture[];
  pistes: PisteFixture[];
  versions: { id: string; piste: string; format: "9:16" | "4:5"; reseaux: string[] }[];
};

/** Même assemblage que `sceneDe` (fabrication.ts), repris de relecture-zero-blocage-b54b.test.ts. */
function entreeDe(v: (typeof F.versions)[number]): EntreeMiseEnSceneIV {
  const p = F.pistes.find((x) => x.version === v.piste)!;
  const fin = F.fins.find((f) => f.id === v.id);
  return {
    carte: F.carte,
    fiche: F.fiche,
    voix: { mots: p.mots, motsCorps: p.motsCorps, dureeSec: p.dureeSec, finVoixSec: p.finVoixSec },
    fin: fin && !fin.muet ? fin : null,
    reseaux: v.reseaux,
    bruitagesValides: BRUITAGES_V4_IV,
    ...(v.format === "4:5" ? { format: v.format } : {}),
    variete: recettePourVersion(F.recette as never, v.reseaux as never, v.format),
    graine: F.videoId,
  } as unknown as EntreeMiseEnSceneIV;
}

const resultats = new Map<number, ResultatMiseEnSceneIV>();
const resultatDe = (k: number): ResultatMiseEnSceneIV => {
  let r = resultats.get(k);
  if (!r) {
    r = mettreEnSceneIV(entreeDe(F.versions[k]));
    resultats.set(k, r);
  }
  return r;
};
const INDEX = F.versions.map((_, k) => k);

type Toile = Extract<BlocRenduIV, { sorte: "toile" }>;
const toileB09 = (k: number): Toile => {
  const b = resultatDe(k).ligne.blocs.find((x) => x.id === "b09");
  if (!b || b.sorte !== "toile") throw new Error("b09 n'est pas une toile");
  return b;
};
const plansDe = (k: number) => {
  const b = toileB09(k);
  return (b.proprietes.ensembles ?? []).map((e) => planEnsemble(b.proprietes.schema, { allumes: e.allumes, chiffresCles: e.chiffresCles }));
};

describe("v-b54bb4798246 : vue d'ensemble b09, aucun libellé hors de son bloc", () => {
  it.each(INDEX)("version %i : chaque ligne de chaque libellé tient dans la largeur utile de son bloc", (k) => {
    const plans = plansDe(k);
    expect(plans.length).toBeGreaterThan(0);
    for (const plan of plans)
      for (const b of plan.blocs) {
        const dispo = b.largeur - 24 - (b.badge ? b.badge + 8 : 0);
        const pire = Math.max(...b.libelle.lignes.map((l) => largeurAnton(l.join(" "), b.libelle.taille)));
        expect(pire, `${b.id} : ${b.libelle.lignes.map((l) => l.join(" ")).join(" / ")}`).toBeLessThanOrEqual(dispo + 0.5);
      }
  });

  it.each(INDEX)("version %i : n05 tient sur 1 ligne, abrégé en « AUTOLI… . », et le dit dans les alertes", (k) => {
    for (const plan of plansDe(k)) {
      const n05 = plan.blocs.find((b) => b.id === "n05")!;
      expect(n05.libelle.lignes).toHaveLength(1);
      expect(n05.libelle.lignes[0].join(" ")).toMatch(/^AUTOLI[A-Z]*\.$/);
      expect(plan.alertes.some((a) => a.includes("Libellé de n05 abrégé (place)"))).toBe(true);
      expect(plan.alertes.some((a) => a.includes("trop long pour son bloc"))).toBe(false);
    }
  });

  it.each(INDEX)("version %i : aucun débordement mesuré (filet Q21) ni défaut de mise en page aux instants de la vue d'ensemble", (k) => {
    for (const plan of plansDe(k)) expect(debordementsEnsemble(plan)).toEqual([]);
    const b = toileB09(k);
    const instants = (b.proprietes.ensembles ?? []).map((e) => b.debut + (e.debut + e.fin) / 2);
    for (const r of miseEnPageAuxInstantsIV(resultatDe(k).ligne, instants)) expect(r.defauts.filter((d) => d.includes("déborde"))).toEqual([]);
  });
});

describe("debordementsEnsemble : le filet voit un libellé hors de son bloc", () => {
  it("rend un défaut nommant n05 pour « AUTOLIQUIDATION » dans 231 px", () => {
    const plan = {
      zone: { x: 0, y: 0, largeur: 231, hauteur: 100 },
      blocs: [{ id: "n05", x: 0, y: 0, largeur: 231, hauteur: 80, couleur: "noir", allume: true, libelle: { taille: 57.6, lignes: [["AUTOLIQUIDATION"]], alerte: null }, badge: 0 }],
      fleches: [],
      rang: new Map(),
      chiffres: [],
      ecart: 16,
      alertes: [],
    } as unknown as PlanEnsemble;
    const defauts = debordementsEnsemble(plan);
    expect(defauts).toHaveLength(1);
    expect(defauts[0]).toContain("n05");
  });
});

describe("libelleCourt : jamais de « + » en fin de libellé", () => {
  it("coupe avant le « + »", () => {
    expect(libelleCourt({ libelle: "Envoi + archivage + écriture comptable" }, 2)).toBe("Envoi");
    expect(libelleCourt({ libelle: "Clôture + trésorerie mise à jour" }, 2)).toBe("Clôture");
  });
});
