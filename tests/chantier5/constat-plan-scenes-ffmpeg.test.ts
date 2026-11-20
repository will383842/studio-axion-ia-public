/**
 * Constat C5-5.01. La session qui déploie confirme en plus, sur une vidéo récente, qu'aucune pièce n'est visible, et que
 * `STUDIO_RENDU_IMAGE` n'est pas posé en production (§ 5.5).
 *
 * Test de CONSTAT : il décrit l'existant et ne corrige rien (aucun code de production touché).
 *  1. FFmpeg ignore le plan de scènes : `argumentsImageFfmpeg` rend les mêmes arguments avec et sans `image.planScenes`.
 *     Seuls `ImageComposee.tsx:66-70`, `cas-concret/Ecran.tsx:28-32` et `VideoAnimeeV4.tsx:45` montent `CalquePlanScenes`
 *     (chemin navigateur) ; aucun fichier de `studio-rendu/src/composition/` ne contient `planScenes`.
 *  2. Combien de pièces d'un plan face caméra coupent la bande des sous-titres (centre du calque ± demi-hauteur dessinée).
 *
 * Constat de commentaire : `facecam-branchements.ts:56` dit « ÉTEINT par défaut » alors que
 * `plan-scenes-generateurs/reglage.ts:19` (`ALLUME_PAR_DEFAUT.facecam`) dit `true`. Non corrigé ici (c'est C5-5.02).
 * Le réglage n'est jamais lu : ni `src/services/reglages.ts`, ni `LireReglage`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RECETTE_COMPOSITION_FACECAM } from "@/moteurs/montage-facecam/habillage";
import type { ProprietesImageComposition } from "@/briques/composition/scene";
import { BANDE_SOUS_TITRES_DEFAUT } from "@/briques/plan-scenes/controles";
import { ZONES, type Rectangle } from "@/briques/plan-scenes/zones";
import type { FormatPlan, PlanValide } from "@/briques/plan-scenes/schema";
import { planPourVideo, type MotEnSecondes } from "@/briques/plan-scenes-generateurs/video";
import { donneesCalque } from "@/briques/sous-titres";
import { sceneAuTemps } from "@/briques/sous-titres/scene";
import type { SegmentRendu } from "@/briques/sous-titres/types-rendu";
import { argumentsImageFfmpeg } from "../../studio-rendu/src/composition/image-ffmpeg";

const RACINE = join(__dirname, "..", "..");

const SCRIPT =
  "Aujourd'hui je vous montre comment j'ai généré 12 000 euros de chiffre d'affaires en 30 jours. Ouvrez l'application, cliquez sur le bouton Nouveau projet puis choisissez le modèle. Résultat : 87 % de clients satisfaits et 3 fois plus de demandes.";
const MOTS: MotEnSecondes[] = SCRIPT.split(" ").map((texte, i) => ({ texte, debutSec: i * 0.4, finSec: i * 0.4 + 0.35 }));
const DUREE_SEC = MOTS.length * 0.4 + 0.5;

const FORMATS: { ratio: "9:16" | "1:1" | "4:5" | "16:9"; format: FormatPlan }[] = [
  { ratio: "9:16", format: { largeur: 1080, hauteur: 1920, fps: 25 } },
  { ratio: "1:1", format: { largeur: 1080, hauteur: 1080, fps: 25 } },
  { ratio: "4:5", format: { largeur: 1080, hauteur: 1350, fps: 25 } },
  { ratio: "16:9", format: { largeur: 1920, hauteur: 1080, fps: 25 } },
];

async function planFacecam(format: FormatPlan): Promise<PlanValide> {
  // Comme le ferait le lot R2 (`facecam-branchements.ts:56-61`) : niveau 1 (stock), sans fournisseur, `facecam: true`.
  const m = await planPourVideo({ generateur: "facecam", mots: MOTS, dureeSec: DUREE_SEC, facecam: true, format });
  if (!m.plan) throw new Error("plan de scènes absent");
  return m.plan;
}

describe("constat C5-5.01 · partie 1 : FFmpeg ignore le plan de scènes", () => {
  const fichiers = { decor: "decor.png", doubles: { principal: { fichier: "will.mp4", video: true } }, illustrations: {}, luts: [], son: "son.wav", cartes: {} };
  const couleurs = { grainPct: 0, grainTaillePx: 2, vignettePct: 0 };
  const base = { ratio: "9:16", largeur: 1080, hauteur: 1920, fps: 25, images: 50, decor: { teinte: "#110A05", directionLumiere: "face", flouPx: 0, clair: false }, doubles: { principal: { type: "video", url: "entree:double", transparent: false } }, plans: [{ debutSec: 0, finSec: 2, type: "double", angle: "principal", cadrage: { valeur: "large", zoom: 1, zoomFin: 1, pointX: 0.5, pointY: 0.38 } }], sourcePreCadree: true };

  it("mêmes arguments FFmpeg avec et sans `planScenes` (un plan valide de 3 pièces)", async () => {
    const plan = await planFacecam(FORMATS[0].format);
    expect(plan.scenes.length).toBeGreaterThanOrEqual(3);
    const troisPieces = { ...plan, scenes: plan.scenes.slice(0, 3) };
    const sans = base as unknown as ProprietesImageComposition;
    const avec = { ...base, planScenes: troisPieces } as unknown as ProprietesImageComposition;
    expect(avec.planScenes).toBeDefined();
    expect(argumentsImageFfmpeg(avec, couleurs, fichiers, 2, "master.mov")).toEqual(argumentsImageFfmpeg(sans, couleurs, fichiers, 2, "master.mov"));
  });

  it("EXACTEMENT `studio-rendu/src/composition/texte-instants.ts` contient `planScenes` (BR-DESSIN-FACECAM-b-v20a, 20/11 : plan dans l'empreinte du calque texte)", () => {
    const dossier = join(RACINE, "studio-rendu", "src", "composition");
    const lister = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? lister(join(d, n)) : [join(d, n)]));
    const fichiersTexte = lister(dossier).filter((f) => /\.(ts|tsx)$/.test(f));
    expect(fichiersTexte.length).toBeGreaterThan(0);
    // 20/11 (BR-DESSIN-FACECAM-b-v20a) : attente déplacée, pas retirée — un seul fichier est autorisé ; tout autre fichier qui contiendrait `planScenes` fait rougir.
    expect(fichiersTexte.filter((f) => /planScenes/.test(readFileSync(f, "utf8"))).map((f) => f.slice(RACINE.length + 1).replaceAll("\\", "/"))).toEqual(["studio-rendu/src/composition/texte-instants.ts"]);
  });

  it("seuls `ImageComposee.tsx`, `cas-concret/Ecran.tsx` et `VideoAnimeeV4.tsx` montent `CalquePlanScenes` (navigateur)", () => {
    const racines = ["src", "studio-rendu/src", "studio-rendu/compositions"].map((d) => join(RACINE, d));
    const lister = (d: string): string[] => {
      try {
        return readdirSync(d).flatMap((n) => (n === "node_modules" ? [] : statSync(join(d, n)).isDirectory() ? lister(join(d, n)) : [join(d, n)]));
      } catch {
        return [];
      }
    };
    const montent = racines
      .flatMap(lister)
      .filter((f) => f.endsWith(".tsx") && /<CalquePlanScenes\b/.test(readFileSync(f, "utf8")))
      .map((f) => f.slice(RACINE.length + 1).replaceAll("\\", "/"))
      .sort();
    expect(montent.map((f) => f.split("/").slice(-2).join("/"))).toEqual(["cas-concret/Ecran.tsx", "commune/ImageComposee.tsx", "interface-claire/VideoAnimeeV4.tsx"].sort().map((x) => x) as string[]);
  });
});

describe("constat C5-5.01 · partie 2 : pièces qui couvrent la bande des sous-titres (face caméra)", () => {
  it("BANDE_SOUS_TITRES_DEFAUT (référence du contrôle du plan)", () => {
    expect(BANDE_SOUS_TITRES_DEFAUT).toEqual({ x: 5, y: 66, largeur: 90, hauteur: 16 });
  });

  const bande = (ratio: (typeof FORMATS)[number]["ratio"], format: FormatPlan): Rectangle => {
    const centre = RECETTE_COMPOSITION_FACECAM.centreSousTitres[ratio as "9:16"] ?? 62;
    const segment: SegmentRendu = { id: "s", debutSec: 0, finSec: 2, mots: [{ mot: "Exemple", debutSec: 0, finSec: 1 }, { mot: "fictif", debutSec: 1, finSec: 2 }] };
    const d = donneesCalque({ segments: [segment], base: "karaoke", ratio, style: { positionPct: centre } as never });
    const e = sceneAuTemps(d, 1)!;
    const demiPct = (e.taillePx / 2 / format.hauteur) * 100;
    const centrePct = (e.yPx / format.hauteur) * 100;
    return { x: 0, y: centrePct - demiPct, largeur: 100, hauteur: 2 * demiPct };
  };

  const compte = async (ratio: (typeof FORMATS)[number]["ratio"], format: FormatPlan) => {
    const plan = await planFacecam(format);
    const b = bande(ratio, format);
    const coupent = plan.scenes.filter((s) => {
      const z = ZONES[s.position];
      return z.y < b.y + b.hauteur && b.y < z.y + z.hauteur;
    });
    const coupentDefaut = plan.scenes.filter((s) => {
      const z = ZONES[s.position];
      return z.y < BANDE_SOUS_TITRES_DEFAUT.y + BANDE_SOUS_TITRES_DEFAUT.hauteur && BANDE_SOUS_TITRES_DEFAUT.y < z.y + z.hauteur;
    });
    return { total: plan.scenes.length, coupent: coupent.length, coupentDefaut: coupentDefaut.length, positions: plan.scenes.map((s) => s.position), bande: b };
  };

  for (const { ratio, format } of FORMATS) {
    it(`${ratio} : nombre de pièces qui coupent la bande`, async () => {
      const r = await compte(ratio, format);
      // Plan de 3 pièces (stock, niveau 1) ; 1 coupe la bande réelle dans les 4 formats : la pièce « bas » (y 60-94 %).
      expect(r.total).toBe(3);
      expect(r.coupent).toBe(1);
      // Bande par défaut du contrôle (y 66-82 %) : même nombre. Écart de position : la bande réelle (centre face caméra
      // 62 %, hauteur d'une ligne) commence à 56-60 %, soit 6 à 10 points plus haut que `BANDE_SOUS_TITRES_DEFAUT.y` (66).
      expect(r.coupentDefaut).toBe(1);
      expect(r.bande.y).toBeLessThan(BANDE_SOUS_TITRES_DEFAUT.y);
    });
  }
});
