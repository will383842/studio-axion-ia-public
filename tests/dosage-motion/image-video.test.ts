/**
 * X3-08 · Image → vidéo : le cran « Sobre » / « Dynamique » règle l'intensité des sous-titres (branchement moteur seul).
 * Tout éteint : sans cran (ou « équilibre »), aucune clé `dosage` nulle part, ligne de temps identique octet pour octet.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import { demandeDeLaCommande } from "@/moteurs/montage-image-video";
import type { BruitageValideIV } from "@/moteurs/montage-image-video/bruitages";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { avancerIV, attendWillIV, etatInitialIV, idRenduSansStyleIV, lignesDesVersionsIV, validerCarteIV, validerScriptIV, type EtatFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { INTENSITE_SOUS_TITRES_IV, intensiteSousTitresIV, sousTitresVariesIV } from "@/moteurs/montage-image-video/sous-titres-varies";
import { RECETTE_REFERENCE_IV } from "@/moteurs/montage-image-video/variete/tirage";
import { carteFixe, demandeEssai, monde, outilsSimules } from "../image-video/doubles-fabrication";

vi.setConfig({ testTimeout: 120_000 });

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
    const { dosage: _b, ...resteDyn } = dyn;
    expect(resteDyn).toEqual(sans);
  });
});

describe("X3-08 · mise en scène", () => {
  it("sans dosage : ligne identique octet pour octet ; avec dosage : seule la clé s'ajoute", () => {
    const base = mettreEnSceneIV(entree).ligne;
    expect(base).not.toHaveProperty("dosage");
    // Vraie comparaison : « sans dosage » = ligne d'avant, construite sans AUCUNE clé dosage (pas la même entrée relue deux fois).
    const { dosage: _aucun, ...entreeSansClef } = { ...entree, dosage: undefined };
    expect(JSON.stringify(mettreEnSceneIV(entreeSansClef).ligne)).toBe(JSON.stringify(base));
    for (const cran of ["sobre", "dynamique"] as const) {
      const avec = mettreEnSceneIV({ ...entree, dosage: cran }).ligne;
      expect(avec.dosage).toBe(cran);
      const { dosage: _d, ...reste } = avec;
      expect(JSON.stringify(reste)).toBe(JSON.stringify(base));
    }
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
  it("sobre et dynamique CHANGENT les sous-titres variés ; sans dosage, tout est identique en profondeur", () => {
    const sortie = (dosage?: "sobre" | "dynamique") => JSON.stringify(sousTitresVariesIV(mettreEnSceneIV({ ...entree, ...(dosage ? { dosage } : {}) }).ligne));
    const sans = sortie();
    const sobre = sortie("sobre");
    const dyn = sortie("dynamique");
    expect(sobre).not.toBe(sans);
    expect(dyn).not.toBe(sans);
    expect(dyn).not.toBe(sobre);
    // Sans dosage : deux constructions indépendantes donnent exactement la même sortie, et la même ligne de temps.
    expect(sortie()).toBe(sans);
    expect(JSON.stringify(mettreEnSceneIV({ ...entree }).ligne)).toBe(JSON.stringify(mettreEnSceneIV({ ...entree, voix: { ...entree.voix } }).ligne));
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

/** Fabrication simulée (doubles, 0 €) menée jusqu'à la mise en scène : c'est `sceneDe` (fabrication.ts, ligne X3-08) qui fait passer le cran de la demande à la scène. */
async function jusquALaMiseEnScene(plus: { dosage?: "sobre" | "dynamique" }): Promise<EtatFabricationIV> {
  const c = carteFixe("C");
  const o = outilsSimules(c, monde());
  let e = etatInitialIV(demandeEssai(c, plus));
  for (let i = 0; i < 200 && e.etape !== "mise-en-scene" && e.etape !== "refusee"; i++) {
    if (attendWillIV(e) === "carte") e = validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-16T08:00:00.000Z" });
    else if (attendWillIV(e) === "script") e = validerScriptIV(e, { proposition: e.propositionScript!.empreinte, choixFormules: Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const])) });
    else e = JSON.parse(JSON.stringify(await avancerIV(e, o)));
  }
  expect(e.etape).toBe("mise-en-scene");
  return e;
}

describe("X3-08 · fabrication : le cran de la demande arrive jusqu'à la scène (sceneDe)", () => {
  it("avec un cran : chaque version porte le cran et l'intensité des sous-titres suit ; sans cran : aucune clé, rien ne change", async () => {
    const sans = await jusquALaMiseEnScene({});
    const lignesSans = lignesDesVersionsIV(sans);
    expect(lignesSans.length).toBeGreaterThan(0);
    for (const v of lignesSans) {
      expect(v.ligne).not.toHaveProperty("dosage");
      expect(intensiteSousTitresIV(v.ligne)).toBe(INTENSITE_SOUS_TITRES_IV);
    }
    const attendue = { sobre: "sobre", dynamique: "tres-dynamique" } as const;
    for (const cran of ["sobre", "dynamique"] as const) {
      const avec = await jusquALaMiseEnScene({ dosage: cran });
      const lignesAvec = lignesDesVersionsIV(avec);
      expect(lignesAvec.length).toBe(lignesSans.length);
      lignesAvec.forEach((v, i) => {
        expect(v.ligne.dosage).toBe(cran);
        expect(intensiteSousTitresIV(v.ligne)).toBe(attendue[cran]);
        // Seule la clé s'ajoute à la ligne de temps ; les sous-titres, eux, changent.
        const { dosage: _d, ...reste } = v.ligne;
        expect(JSON.stringify(reste)).toBe(JSON.stringify(lignesSans[i].ligne));
        expect(JSON.stringify(sousTitresVariesIV(v.ligne))).not.toBe(JSON.stringify(sousTitresVariesIV(lignesSans[i].ligne)));
      });
    }
    // Sans le champ ou avec une demande identique sans lui : même état, mêmes clés de rendu, en profondeur.
    const sans2 = await jusquALaMiseEnScene({});
    expect(JSON.stringify(sans2)).toBe(JSON.stringify(sans));
    lignesDesVersionsIV(sans2).forEach((v, i) => expect(idRenduSansStyleIV(v.version, v.ligne, "m")).toBe(idRenduSansStyleIV(lignesSans[i].version, lignesSans[i].ligne, "m")));
  });
});
