/**
 * X3-08 · Image → vidéo : le cran « Sobre » / « Dynamique » règle l'intensité des sous-titres (branchement moteur seul).
 * Tout éteint : sans cran (ou « équilibre »), aucune clé `dosage` nulle part, ligne de temps identique octet pour octet.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import { demandeDeLaCommande } from "@/moteurs/montage-image-video";
import type { BruitageValideIV } from "@/moteurs/montage-image-video/bruitages";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { INTENSITE_SOUS_TITRES_IV, intensiteSousTitresIV, sousTitresVariesIV } from "@/moteurs/montage-image-video/sous-titres-varies";
import { RECETTE_REFERENCE_IV } from "@/moteurs/montage-image-video/variete/tirage";

const commandeAvec = (dosageMotion?: unknown) =>
  ({ videoId: "v", entrees: { imageVideo: { imageCle: "texte:x", texte: "Une idée", reseaux: ["instagram"] } }, reglages: { validationCarte: "automatique" }, styles: {}, ...(dosageMotion ? { dosageMotion } : {}) }) as never;
const cran = (c: string) => ({ cran: c, choisiPar: "video" });

const VALIDES: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const carte: CarteImage = JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes/A.json"), "utf8"));
const fiche = FICHES_SIMULEES["essai-a"];
const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins[0];
const entree = { carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES };

describe("X3-08 · demandeDeLaCommande", () => {
  it("sans cran ou « équilibre » : aucune clé dosage ; sobre / dynamique : la clé ; plafond identique", () => {
    const sans = demandeDeLaCommande(commandeAvec(), "ver-1");
    expect(sans).not.toHaveProperty("dosage");
    expect(demandeDeLaCommande(commandeAvec(cran("equilibre")), "ver-1")).toEqual(sans);
    expect(demandeDeLaCommande(commandeAvec(cran("aucun")), "ver-1")).toEqual(sans);
    const sobre = demandeDeLaCommande(commandeAvec(cran("sobre")), "ver-1");
    const dyn = demandeDeLaCommande(commandeAvec(cran("dynamique")), "ver-1");
    expect(sobre.dosage).toBe("sobre");
    expect(dyn.dosage).toBe("dynamique");
    expect(sobre.plafondCentimes).toBe(sans.plafondCentimes);
    expect(dyn.plafondCentimes).toBe(sans.plafondCentimes);
    const { dosage: _a, ...resteSobre } = sobre;
    expect(resteSobre).toEqual(sans);
  });
});

describe("X3-08 · mise en scène", () => {
  it("sans dosage : ligne identique octet pour octet ; avec dosage : seule la clé s'ajoute", () => {
    const base = mettreEnSceneIV(entree).ligne;
    expect(base).not.toHaveProperty("dosage");
    expect(JSON.stringify(mettreEnSceneIV({ ...entree }).ligne)).toBe(JSON.stringify(base));
    const dyn = mettreEnSceneIV({ ...entree, dosage: "dynamique" }).ligne;
    expect(dyn.dosage).toBe("dynamique");
    const { dosage: _d, ...reste } = dyn;
    expect(JSON.stringify(reste)).toBe(JSON.stringify(base));
  });
});

describe("X3-08 · intensiteSousTitresIV", () => {
  it("le cran gagne ; sans cran : la valeur d'aujourd'hui, avec ou sans SOU-C, styleVarie vrai ou faux", () => {
    expect(intensiteSousTitresIV({ dosage: "sobre" })).toBe("sobre");
    expect(intensiteSousTitresIV({ dosage: "dynamique" })).toBe("tres-dynamique");
    const souC = { variete: { recette: { ...RECETTE_REFERENCE_IV, sousTitres: "SOU-C" as const }, format: "9:16" as const, replis: [] } };
    for (const l of [{}, souC]) {
      expect(intensiteSousTitresIV(l)).toBe(INTENSITE_SOUS_TITRES_IV);
      expect(intensiteSousTitresIV(l, false)).toBe(INTENSITE_SOUS_TITRES_IV);
    }
    expect(intensiteSousTitresIV({}, true)).toBe(INTENSITE_SOUS_TITRES_IV);
    expect(intensiteSousTitresIV(souC, true)).toBe("tres-dynamique");
  });
  it("les sous-titres restent présents pour chaque cran", () => {
    for (const dosage of [undefined, "sobre", "dynamique"] as const) {
      const ligne = mettreEnSceneIV({ ...entree, ...(dosage ? { dosage } : {}) }).ligne;
      expect(sousTitresVariesIV(ligne).length).toBeGreaterThan(0);
    }
  });
});

describe("X3-08 · garde statique", () => {
  it("les fichiers du moteur touchés n'importent pas @/services/ ; le service ne lit pas dosage", () => {
    for (const f of ["index", "fabrication", "mise-en-scene", "sous-titres-varies"]) {
      const src = readFileSync(join(process.cwd(), `src/moteurs/montage-image-video/${f}.ts`), "utf8");
      expect(src).not.toMatch(/from\s+["']@\/services\//);
    }
    expect(readFileSync(join(process.cwd(), "src/services/image-video-rendu.ts"), "utf8")).not.toMatch(/dosage/i);
  });
});
