/**
 * Fond des vues d'ensemble (répétition générale du 17/10/2026, plan de correctifs visuels, étape 4) : la ligne de temps
 * déclare IVOIRE le plan d'une vue d'ensemble (sous-titres à l'encre sombre, récit sur fond ivoire), mais la scène de
 * toile peignait le fond de la toile (sombre pour certains blocs) : encre sombre sur fond sombre. Le rendu doit suivre
 * la ligne de temps : à chaque instant d'un bloc de toile, le fond PEINT (`fondSceneA`) est celui du plan qui le recouvre.
 */
import { describe, expect, it, vi } from "vitest";
import type { RecetteVarieteIV } from "@/briques/schema-motion/variete";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES, ficheSimuleeRecit } from "@/moteurs/montage-image-video/ecriture.simulation";
import { BRUITAGES_V4_IV } from "@/moteurs/montage-image-video/fabrication";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV, type LigneDeTempsIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { RECETTE_REFERENCE_IV } from "@/moteurs/montage-image-video/variete/tirage";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { fondSceneA } from "../../studio-rendu/compositions/image-video/plan";
import { carteFixe } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 240_000 });

const IMAGES = { A: "essai-a", B: "essai-b", C: "essai-c", D: "essai-d", E: "essai-e", F: "essai-f" } as const;
type Nom = keyof typeof IMAGES;
const NOMS = Object.keys(IMAGES) as Nom[];

function ligneDe(nom: Nom, sur: Partial<RecetteVarieteIV>, format: "9:16" | "4:5", toutSombre = false): LigneDeTempsIV {
  const carte = carteFixe(nom);
  const recette = { ...RECETTE_REFERENCE_IV, ...sur } as RecetteVarieteIV;
  const base = ficheSimuleeRecit(carte.image.empreinte, recette.recit) ?? FICHES_SIMULEES[IMAGES[nom]];
  // Toutes les toiles de la fiche sur fond sombre : le cas de la répétition (b03, b05, b08), où la vue d'ensemble est ivoire.
  const fiche = toutSombre ? { ...base, ecrans: base.ecrans.map((e) => ({ ...e, fond: "sombre" as const })) } : base;
  const reseau = format === "4:5" ? "linkedin" : "youtube-shorts";
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes(reseau))!;
  return mettreEnSceneIV({ carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: BRUITAGES_V4_IV, variete: recette, format }).ligne;
}

describe("fond peint par la scène de toile = fond du plan de la ligne de temps, y compris pendant une vue d'ensemble", () => {
  const RECETTES: { nom: string; sur: Partial<RecetteVarieteIV> }[] = [
    { nom: "référence", sur: {} },
    { nom: "CAM-B", sur: { camera: "CAM-B" } },
    { nom: "CAM-C", sur: { camera: "CAM-C" } },
    { nom: "REC-B", sur: { recit: "REC-B" } },
    { nom: "REC-D", sur: { recit: "REC-D" } },
    { nom: "REC-B + CAM-B", sur: { recit: "REC-B", camera: "CAM-B" } },
  ];

  it("sur les 6 cartes, en 9:16 et en 4:5, à 3 instants de chaque plan de chaque bloc de toile", () => {
    let verifies = 0;
    let ensembles = 0;
    let ivoireSurToileSombre = 0;
    for (const format of ["9:16", "4:5"] as const) {
      for (const { nom: recette, sur } of RECETTES) {
        for (const nom of NOMS) for (const sombre of [false, true]) {
          const l = ligneDe(nom, sur, format, sombre);
          for (const b of l.blocs) {
            if (b.sorte !== "toile") continue;
            ensembles += (b.proprietes.ensembles ?? []).length;
            const cam = (b.variete?.donnees as { camera?: { code?: string; fond?: "ivoire" | "sombre"; ensembles?: { debut: number; fin: number }[] } } | undefined)?.camera;
            const peint = (t: number) =>
              cam?.code === "CAM-B" || cam?.code === "CAM-C"
                ? fondSceneA({ fond: cam.fond ?? b.proprietes.fond, ensembles: b.proprietes.ensembles ?? cam.ensembles }, t)
                : fondSceneA(b.proprietes, t);
            for (const p of l.plans) {
              const d = Math.max(p.debut, b.debut);
              const f = Math.min(p.fin, b.fin);
              if (f - d < 0.05) continue;
              for (const ts of [d + 0.01, (d + f) / 2, f - 0.01]) {
                expect(peint(ts - b.debut), `${format} ${recette} carte ${nom}${sombre ? " (fiche sombre)" : ""} bloc ${b.id} t=${ts.toFixed(2)} (plan ${p.debut.toFixed(2)}-${p.fin.toFixed(2)})`).toBe(p.fond);
                verifies++;
                if (p.fond === "ivoire" && b.proprietes.fond === "sombre") ivoireSurToileSombre++;
              }
            }
          }
        }
      }
    }
    expect(verifies).toBeGreaterThan(100);
    expect(ensembles).toBeGreaterThan(0);
    // Le cas du défaut existe bel et bien dans les données de test (vue d'ensemble ivoire sur une toile sombre).
    expect(ivoireSurToileSombre).toBeGreaterThan(0);
  });

  it("fondSceneA : ivoire dans [début, fin[ d'une vue d'ensemble, le fond de la toile ailleurs", () => {
    const p = { fond: "sombre" as const, ensembles: [{ debut: 2, fin: 3.5 }] };
    expect(fondSceneA(p, 1.99)).toBe("sombre");
    expect(fondSceneA(p, 2)).toBe("ivoire");
    expect(fondSceneA(p, 3.49)).toBe("ivoire");
    expect(fondSceneA(p, 3.5)).toBe("sombre");
    expect(fondSceneA({ fond: "sombre" }, 2)).toBe("sombre");
    expect(fondSceneA({ fond: "ivoire", ensembles: [{ debut: 0, fin: 1 }] }, 0.5)).toBe("ivoire");
  });
});
