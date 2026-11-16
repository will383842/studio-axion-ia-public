/** G10-07 : schémas de lecture des propriétés des compositions (non branchés). */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { PlanValide } from "../../src/briques/plan-scenes/schema";
import type { ProprietesDemoFacecam } from "../../src/moteurs/montage-demo-facecam/proprietes";
import type { ProprietesImageComposition, ProprietesTexteComposition } from "../../src/briques/composition/scene";
import { SCHEMAS_PROPS, lireProps } from "../../studio-rendu/compositions/commune/schemas-props";

const CHEMIN = "studio-rendu/compositions/commune/schemas-props.ts";

/** Copie de `PLAN_VIDE` (PlanDeScenes.tsx) : le .tsx importe remotion, absent de la racine. Typée : une dérive casse `tsc`. */
const PLAN_VIDE: { plan: PlanValide } = {
  plan: {
    version: "plan-scenes-1",
    format: { largeur: 1080, hauteur: 1920, fps: 25 },
    facecam: false,
    dureeMs: 3000,
    habillage: { fond: "ivoire", accent: "terracotta" },
    mots: [],
    scenes: [
      { id: "s1", version: 1, empreinte: "0000000000000000", mots: { premier: 0, dernier: 0 }, debutMs: 0, finMs: 3000, niveau: 1, position: "centre", transition: { entree: "fondu", sortie: "fondu", dureeMs: 400 }, piece: "legende", parametres: { texte: "Axion IA", sousTexte: "", style: "titre" } },
    ],
  },
};
/** Forme de `DEMO_FACECAM_VIDE` (DemoFacecam.tsx), mise en page 4:5 écrite à la main. */
const DEMO_FACECAM_VIDE = {
  largeur: 1080, hauteur: 1350, fps: 25, images: 88, dureeParoleMs: 1000,
  miseEnPage: { ratio: "4:5" },
  recadrageFacecam: { x: 0, y: 0, largeur: 1920, hauteur: 1080 },
  recadrageEcran: { x: 0, y: 0, largeur: 1920, hauteur: 1080 },
  sourceFacecam: { largeur: 1920, hauteur: 1080 },
  sourceEcran: { largeur: 1920, hauteur: 1080 },
  decalageEcranSec: 0, zooms: [], clics: [], surlignages: [], legendes: [],
  plan: { ...PLAN_VIDE.plan, scenes: [] },
  sousTitres: [],
  carteFin: { titre: "Axion IA", sousTitre: "axion-ia.com" },
} as unknown as Omit<ProprietesDemoFacecam, never>;
const TUTORIEL = { ...PLAN_VIDE, fin: { titre: "Axion IA", sousTitre: "axion-ia.com" }, finMs: 2500 };
const CALQUE = {
  largeur: 1080, hauteur: 1920, segments: [], base: "karaoke",
  couleurs: { texte: "#F3EDE4", accent: "#E07040", contour: "#16120F" },
  largeurMaxPx: 691, positions: { milieuPct: 48, hautPct: 19, basPct: 65, poitrinePct: 51 },
};
const IMAGE: ProprietesImageComposition = {
  ratio: "9:16", largeur: 1080, hauteur: 1920, fps: 25, images: 25,
  decor: { teinte: "#110A05", directionLumiere: "face", flouPx: 0, clair: false },
  doubles: { principal: { type: "silhouette", tenue: "#1E2128", peau: "#C4967A" } },
  plans: [],
};
const TEXTE: ProprietesTexteComposition = { ratio: "9:16", largeur: 1080, hauteur: 1920, fps: 25, images: 25, incrustations: [] };

const EXEMPLES: Record<string, Record<string, unknown>> = {
  PlanDeScenes: PLAN_VIDE as Record<string, unknown>,
  TutorielOutil: TUTORIEL as unknown as Record<string, unknown>,
  DemoFacecam: DEMO_FACECAM_VIDE as unknown as Record<string, unknown>,
  SousTitres: { donnees: CALQUE },
  CompositionImage: IMAGE as unknown as Record<string, unknown>,
  CompositionTexte: TEXTE as unknown as Record<string, unknown>,
};

describe("schemas-props", () => {
  it("couvre les six compositions", () => {
    expect(Object.keys(SCHEMAS_PROPS).sort()).toEqual(Object.keys(EXEMPLES).sort());
  });

  for (const [id, exemple] of Object.entries(EXEMPLES)) {
    it(`${id} : l'exemple existant passe`, () => {
      const r = lireProps(id, exemple);
      expect(r.ok).toBe(true);
    });
    it(`${id} : champ inconnu accepté`, () => {
      expect(lireProps(id, { ...exemple, champFutur: 1 }).ok).toBe(true);
    });
    it(`${id} : une propriété requise retirée nomme le champ`, () => {
      const cle = Object.keys(exemple)[0];
      const { [cle]: _retire, ...reste } = exemple;
      const r = lireProps(id, reste);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.erreurs.join(" ")).toContain(cle);
    });
  }

  it("id inconnu → ok:false, sans lever", () => {
    expect(lireProps("Inconnue", {}).ok).toBe(false);
  });
  it("entrée absurde → ok:false, sans lever", () => {
    for (const brut of [null, undefined, 3, "x", []]) expect(lireProps("TutorielOutil", brut).ok).toBe(false);
  });

  it("garde statique : aucun @/, ni interface-claire, ni visuels", () => {
    const src = readFileSync(CHEMIN, "utf8");
    expect(src).not.toMatch(/from\s+["']@\//);
    expect(src).not.toMatch(/interface-claire/);
    expect(src).not.toMatch(/visuels/);
  });
});
