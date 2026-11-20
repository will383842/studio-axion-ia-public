/**
 * C8-X01-t : filet de préparation de C8-X01. La Bibliothèque ne promet jamais plus que le code :
 * pour les logos d'outils, le zoom v4 et l'avis client, « eteint » ou « prod » exige la pièce,
 * et « prod » exige en plus son branchement. Il reste vert quand C8-X01 passe ces lignes de `prevu`/`absent` à `eteint`.
 * Le jour où Williams en allume une (passage à `prod`, interrupteur à `true`), la fiche d'allumage
 * met ce test à jour dans sa PR, avec l'accord du relecteur (comme tests/zoom-gratuit/constat-existant.test.ts:1-4).
 * Les fichiers de studio-rendu/ sont lus par readFileSync, jamais importés (PIEGE-REMOTION-TSC.md).
 */
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { ID, etatCapacite } from "@/briques/bibliotheque-video/catalogue";
import type { IdCapacite } from "@/briques/bibliotheque-video/types";

const racine = process.cwd();

function fichiers(dossier: string): string[] {
  const chemin = join(racine, dossier);
  if (!existsSync(chemin)) return [];
  const sortie: string[] = [];
  for (const nom of readdirSync(chemin)) {
    const rel = `${dossier}/${nom}`;
    if (nom === "node_modules") continue;
    if (statSync(join(racine, rel)).isDirectory()) sortie.push(...fichiers(rel));
    else if (/\.(ts|tsx)$/.test(nom)) sortie.push(rel);
  }
  return sortie;
}
const lire = (rel: string) => readFileSync(join(racine, rel), "utf8");
const existe = (rel: string) => existsSync(join(racine, rel));
const citeDans = (dossier: string, motif: RegExp) =>
  fichiers(dossier).some((f) => !/\.test\.tsx?$/.test(f) && motif.test(lire(f)));

interface Piece { pieceLivree: boolean; branchee: boolean }
/** Règle : eteint/prod => pièce ; prod => branchement. Rend les promesses non tenues. */
function promessesNonTenues(etat: string | undefined, p: Piece): string[] {
  const m: string[] = [];
  if ((etat === "eteint" || etat === "prod") && !p.pieceLivree) m.push("pièce absente");
  if (etat === "prod" && !p.branchee) m.push("pièce non branchée");
  return m;
}

const PIECES: Record<string, { id: IdCapacite; piece: Piece }> = {
  logos: {
    id: ID.texteLogoOutil,
    piece: {
      pieceLivree: ["index", "manifeste", "resoudre", "dessins"].every((n) => existe(`src/briques/motion/logos-outils/${n}.ts`)),
      branchee: citeDans("src/moteurs", /logos-outils/) || citeDans("studio-rendu", /logos-outils/),
    },
  },
  zoomV4: {
    id: ID.cadrageZoomV4,
    piece: {
      pieceLivree: existe("src/moteurs/montage-facecam-animee/zoom-gratuit-v4.ts"),
      branchee: citeDans("src/services", /zoomGratuitV4Actif|PARAM_ZOOM_GRATUIT_FA/),
    },
  },
  avis: {
    id: ID.motionAvisClient,
    piece: {
      pieceLivree: existe("studio-rendu/compositions/avis-client/CarteAvisClient.tsx") && existe("src/domaine/avis-client/provenance.ts"),
      branchee: existe("src/fournisseurs/site/avis.ts"),
    },
  },
};

describe("C8-X01-t : le catalogue ne promet jamais plus que le code (logos, zoom v4, avis)", () => {
  it("le garde-fou détecte une promesse non tenue (copie locale de cadrageZoomV4 à « prod »)", () => {
    expect(promessesNonTenues("prod", { pieceLivree: true, branchee: false })).toEqual(["pièce non branchée"]);
    expect(promessesNonTenues("eteint", { pieceLivree: false, branchee: false })).toEqual(["pièce absente"]);
    expect(promessesNonTenues("prevu", { pieceLivree: false, branchee: false })).toEqual([]);
  });

  for (const [nom, { id, piece }] of Object.entries(PIECES)) {
    it(`${nom} : « eteint »/« prod » exige la pièce, « prod » exige son branchement`, () => {
      expect(etatCapacite(id), `ligne ${id} absente du catalogue`).toBeDefined();
      expect(promessesNonTenues(etatCapacite(id), piece), `${nom} : ${etatCapacite(id)}`).toEqual([]);
    });
  }

  it("constat d'aujourd'hui, en « au plus » : zoom v4 ni eteint ni prod tant qu'aucun service ne lit son réglage", () => {
    if (!PIECES.zoomV4.piece.branchee) expect(["eteint", "prod"]).not.toContain(etatCapacite(ID.cadrageZoomV4));
  });
  it("constat d'aujourd'hui : avis client pas « prod » sans src/fournisseurs/site/avis.ts", () => {
    if (!existe("src/fournisseurs/site/avis.ts")) expect(etatCapacite(ID.motionAvisClient)).not.toBe("prod");
  });
  it("constat d'aujourd'hui : logos pas « prod » tant qu'aucun moteur ni studio-rendu ne cite logos-outils", () => {
    if (!PIECES.logos.piece.branchee) expect(etatCapacite(ID.texteLogoOutil)).not.toBe("prod");
  });

  it("les quatre zooms classiques restent « prod »", () => {
    for (const id of [ID.cadrageZoomClassique, ID.cadrageZoomAvocat, ID.cadrageZoomDemo, ID.cadrageCameraCasConcret]) {
      expect(etatCapacite(id)).toBe("prod");
    }
  });
});
