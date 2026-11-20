/**
 * X3-13b-b : la planche du dosage dit la même chose que les moteurs BRANCHÉS (image→vidéo, cas concret, face caméra, tableau).
 * Test seul : lecture et import, aucun code de production, aucun rendu, aucun réseau. Les fichiers de moteurs sont lus, jamais modifiés.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { demandeDeLaCommande } from "@/moteurs/montage-image-video";
import { intensiteDosageIV } from "@/moteurs/montage-image-video/dosage";
import { appliquerContraintes, contraintesDosageCasConcret } from "@/moteurs/montage-cas-concret/dosage";
import { tirageDose } from "@/moteurs/montage-cas-concret/fabriquer";
import { DENSITES_PARTICULES, FONDS_FORTS, INCLINAISONS, INTENSITES, ACCENTS, HAUTEURS_SOUS_TITRES, type Tirage } from "@/moteurs/montage-cas-concret/variete";
import { tableauDosage } from "../../scripts/dosage-motion/planche";

// Recopié de tests/dosage-motion/planche-moteurs.test.ts:13-21.
function tirageSimule(i: number): Tirage {
  return {
    graine: i * 7919,
    sel: i % 3,
    fondFort: FONDS_FORTS[i % 3],
    particules: { groupe: i % 6, densite: DENSITES_PARTICULES[i % 3] },
    sousTitres: { inclinaison: INCLINAISONS[i % 2], intensite: INTENSITES[i % 3], accent: ACCENTS[i % 2], hauteur: HAUTEURS_SOUS_TITRES[i % 2] },
    relache: i % 4,
  } as unknown as Tirage;
}

// Commande-modèle recopiée de tests/image-video/image-video.test.ts:24-25 : seul `dosageMotion` change.
const commandeModele = (dosageMotion: unknown) =>
  ({ videoId: "v", entrees: { imageVideo: { imageCle: "texte:x", texte: "Une idée", reseaux: ["instagram"] } }, reglages: { validationCarte: "automatique" }, styles: {}, ...(dosageMotion ? { dosageMotion } : {}) }) as never;

const sansCommentaires = (rel: string) =>
  readFileSync(join(process.cwd(), rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const LIGNES = tableauDosage();
const INTENSITE_IV = { sobre: "sobre", dynamique: "tres-dynamique", equilibre: undefined } as const;

describe("planche du dosage × moteurs branchés", () => {
  it("la planche n'est pas vide et toutes ses lignes gardent les sous-titres", () => {
    expect(LIGNES.length).toBeGreaterThan(0);
    for (const l of LIGNES) expect(l.sousTitresPresents, `${l.generateur} · ${l.cran}`).toBe(true);
  });

  describe.each(LIGNES.filter((l) => l.generateur === "image-video").map((l) => [l.cran, l] as const))("image→vidéo · %s", (_c, l) => {
    it("le chemin réel demandeDeLaCommande pose `dosage` pour sobre/dynamique, rien pour équilibre", () => {
      const demande = demandeDeLaCommande(commandeModele(l.commande.dosageMotion), "ver-1");
      if (l.cran === "sobre" || l.cran === "dynamique") expect(demande).toHaveProperty("dosage", l.cran);
      else expect(demande).not.toHaveProperty("dosage");
    });
    it("l'intensité des sous-titres suit le cran", () => {
      expect(intensiteDosageIV(l.cran)).toBe(INTENSITE_IV[l.cran as keyof typeof INTENSITE_IV]);
    });
  });

  describe.each(LIGNES.filter((l) => l.generateur === "cas-concret").map((l) => [l.cran, l] as const))("cas concret · %s", (_c, l) => {
    it("tirageDose = appliquerContraintes(contraintes du cran)", () => {
      for (let i = 0; i < 12; i++) {
        expect(tirageDose(tirageSimule(i), l.cran)).toEqual(appliquerContraintes(tirageSimule(i), contraintesDosageCasConcret(l.cran)));
      }
    });
    it("sans cran, le tirage est rendu inchangé", () => {
      const t = tirageSimule(3);
      expect(tirageDose(t, undefined)).toBe(t);
    });
  });

  describe("gardes statiques des branchements (texte sans commentaires)", () => {
    it("face caméra : chaine.ts importe retireesAvecDosage de ./dosage et l'appelle avec c.dosageMotion?.cran", () => {
      const t = sansCommentaires("src/moteurs/montage-facecam/chaine.ts");
      expect(t, "branchement disparu : import de retireesAvecDosage depuis ./dosage").toMatch(/import\s*\{[^}]*\bretireesAvecDosage\b[^}]*\}\s*from\s*["']\.\/dosage["']/);
      expect(t, "branchement disparu : appel retireesAvecDosage(c.dosageMotion?.cran, …)").toMatch(/retireesAvecDosage\(\s*c\.dosageMotion\?\.cran\b/);
    });
    it("tableau : index.ts importe intensiteSousTitresTableau de ./dosage et l'appelle avec commande.dosageMotion?.cran", () => {
      const t = sansCommentaires("src/moteurs/montage-tableau/index.ts");
      expect(t, "branchement disparu : import de intensiteSousTitresTableau depuis ./dosage").toMatch(/import\s*\{[^}]*\bintensiteSousTitresTableau\b[^}]*\}\s*from\s*["']\.\/dosage["']/);
      expect(t, "branchement disparu : appel intensiteSousTitresTableau(commande.dosageMotion?.cran, …)").toMatch(/intensiteSousTitresTableau\(\s*commande\.dosageMotion\?\.cran\b/);
    });
    it("cas concret : index.ts lit commande.dosageMotion?.cran", () => {
      const t = sansCommentaires("src/moteurs/montage-cas-concret/index.ts");
      expect(t, "branchement disparu : lecture de commande.dosageMotion?.cran").toMatch(/commande\.dosageMotion\?\.cran/);
    });
  });
});
