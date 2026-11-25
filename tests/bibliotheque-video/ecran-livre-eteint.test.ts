/**
 * C4-U4.13t : filet de préparation de C4-U4.13 (passage `prevu` -> `eteint` des 2 capacités « écran » du chantier 4).
 * Il ne lit ni n'écrit aucun état « prod ». Il reste vert avant ET après ce passage.
 * Le jour où Williams en allume une (passage à `prod`), la fiche d'allumage met ce test à jour dans sa PR,
 * avec l'accord du relecteur (même règle que tests/bibliotheque-video/texte-livre-eteint.test.ts).
 * Les fichiers de `studio-rendu/` sont lus par `readFileSync` seulement : jamais d'import (PIEGE-REMOTION-TSC.md).
 */
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ID, etatCapacite } from "@/briques/bibliotheque-video/catalogue";
import { LIGNES_ECRAN } from "@/briques/bibliotheque-video/catalogue/ecran";
import { PROFILS_DU_CODE, profilNeutre } from "@/briques/bibliotheque-video/profils";
import type { IdCapacite } from "@/briques/bibliotheque-video/types";
import { CATALOGUE_V4 } from "@/moteurs/montage-facecam-animee/realisateur/catalogue-v4";
import { catalogueV4Ouvert, ficheV4Ouverte, ID_TELEPHONE_VIDEO_V4 } from "@/moteurs/montage-facecam-animee/realisateur/catalogue-v4-extensions";
import { telephoneVideoActif } from "@/moteurs/montage-facecam-animee/realisateur/consigne-telephone-video";

const racine = process.cwd();
const LOT6 = "studio-rendu/compositions/interface-claire/motion-v4/lot6";
const EXTRAITS = "src/moteurs/montage-facecam-animee/extraits-maison";

interface Piece {
  id: string;
  fichiers: [string, string][];
}

// Étiquettes relues dans le vrai texte de chaque fichier (master 18/11). Deux fichiers ne citent pas leur fiche d'origine
// (preparer.ts : C4-U4.3 ; TelephoneVideo.tsx et PlancheLot6.tsx : C4-U4.7) : repère réel utilisé à la place, signalé au journal.
const PIECES: readonly Piece[] = [
  {
    id: ID.ecranMosaiqueExtraits,
    fichiers: [
      [`${EXTRAITS}/types.ts`, "C4-U4.1"],
      [`${EXTRAITS}/recherche.ts`, "C4-U4.1"],
      [`${EXTRAITS}/choisir.ts`, "C4-U4.2"],
      [`${EXTRAITS}/preparer.ts`, "Extraits maison de la v4 : préparer l'extrait"],
      ["src/services/extraits-maison-v4.ts", "C4-U4.5a"],
      ["src/moteurs/montage-facecam-animee/realisateur/consigne-extraits-maison.ts", "C4-U4.6a"],
    ],
  },
  {
    id: ID.ecranTelephoneExtrait,
    fichiers: [
      [`${LOT6}/TelephoneVideo.tsx`, "téléphone GÉNÉRIQUE qui joue une vidéo"],
      [`${LOT6}/PlancheLot6.tsx`, "PLANCHE DU LOT 6"],
      [`${LOT6}/entree-lot6.tsx`, "C4-U4.8"],
      [`${LOT6}/rendus-lot6.tsx`, "N-17"],
      [`${LOT6}/entree-repli-lot6.tsx`, "N-17"],
    ],
  },
];

const texteDe = (chemin: string) => readFileSync(join(racine, chemin), "utf8");

describe("C4-U4.13t : capacités écran livrées et éteintes", () => {
  it("état : jamais prod, coulisse, absent ni demande", () => {
    for (const p of PIECES) {
      expect(["prevu", "eteint"], p.id).toContain(etatCapacite(p.id as IdCapacite));
    }
  });

  it("livré : chaque fichier existe et porte sa fiche (ou son repère réel)", () => {
    for (const p of PIECES) {
      for (const [chemin, etiquette] of p.fichiers) {
        expect(existsSync(join(racine, chemin)), `${p.id} : ${chemin}`).toBe(true);
        expect(texteDe(chemin), `${chemin} doit citer ${etiquette}`).toContain(etiquette);
      }
    }
  });

  it("éteint : aucun profil du code (ni le neutre) ne permet ces capacités", () => {
    const profils = [...Object.values(PROFILS_DU_CODE), profilNeutre("format-essai")];
    for (const profil of profils) {
      for (const p of PIECES) {
        expect(profil.capacites[p.id as IdCapacite]?.permis, `${p.id}`).not.toBe(true);
      }
    }
  });

  // Ces 2 cas seront REMPLACÉS (jamais supprimés) par le relecteur de la fiche de branchement (C4-U4.5b pour les extraits maison).
  // BR-TELEPHONE-a/c (18/11) a branché le téléphone par OPTION : le catalogue de base reste sans lui, seul `telephoneVideo === true` exact l'ouvre.
  it("éteint : le téléphone n'est pas au catalogue du réalisateur (chemin réel : option absente ou non exacte, réglage par défaut)", async () => {
    expect(texteDe("src/moteurs/montage-facecam-animee/realisateur/catalogue-v4.ts")).not.toContain("telephone-video");
    expect(CATALOGUE_V4.map((f) => f.id)).not.toContain(ID_TELEPHONE_VIDEO_V4);
    for (const option of [undefined, {}, { telephoneVideo: false }, { telephoneVideo: "true" }, { telephoneVideo: 1 }]) {
      const ouvert = catalogueV4Ouvert(option as never);
      expect(ouvert, JSON.stringify(option)).toBe(CATALOGUE_V4);
      expect(ficheV4Ouverte(ID_TELEPHONE_VIDEO_V4, option as never)).toBeUndefined();
    }
    // le réglage, lu avec son défaut réel (le lecteur rend le défaut qu'on lui donne), reste éteint
    expect(await telephoneVideoActif(async (_id, defaut) => defaut)).toBe(false);
    // contrôle positif : la même fonction ouvre bien le téléphone avec `true` exact (la garde n'est donc pas vide)
    expect(catalogueV4Ouvert({ telephoneVideo: true }).map((f) => f.id)).toContain(ID_TELEPHONE_VIDEO_V4);
    expect(await telephoneVideoActif(async () => true)).toBe(true);
  });

  it("éteint : src/services/extraits-maison-v4.ts n'est importé par aucun autre fichier de src/ (branchement = C4-U4.5b, chef)", () => {
    const importeurs: string[] = [];
    const parcourir = (dossier: string) => {
      for (const e of readdirSync(dossier, { withFileTypes: true })) {
        const chemin = join(dossier, e.name);
        if (e.isDirectory()) parcourir(chemin);
        else if (/\.(ts|tsx)$/.test(e.name) && /extraits-maison-v4/.test(readFileSync(chemin, "utf8"))) importeurs.push(chemin.replace(/\\/g, "/"));
      }
    };
    parcourir("src");
    // BR-TELEPHONE-b 18/11 (amendement pilote 10:30) : `telephone-extrait-v4.ts` est le seul autre importeur permis (branchement du téléphone qui joue un extrait) ; tout AUTRE importeur reste refusé.
    // MAJ 25/11 (FIX-ROUGES-ECRAN-EFFETS-v21s, voulue, à relire) : `src/services/facecam-animee.ts` est le SEUL autre importeur permis (FA-SERVICE-INV-v20h #1535), en import dynamique derrière `facecamAnimee.extraitsMaison` (éteint) ; tout AUTRE fichier reste refusé.
    expect(importeurs.filter((f) => f !== "src/services/extraits-maison-v4.ts" && f !== "src/services/telephone-extrait-v4.ts")).toEqual(["src/services/facecam-animee.ts"]);
    const service = readFileSync("src/services/facecam-animee.ts", "utf8");
    expect(service).not.toMatch(/^import .*extraits-maison-v4/m);
    expect(service.indexOf("if (extraitsMaison)")).toBeLessThan(service.indexOf('import("./extraits-maison-v4")'));
    expect(service).toContain("(await lireParametre<unknown>(PARAM_EXTRAITS_MAISON_FA, false)) === true");
  });

  it("table complète : les ids testés = les lignes écran prevu ou eteint", () => {
    const attendus = LIGNES_ECRAN.filter((l) => l.etat === "prevu" || l.etat === "eteint").map((l) => l.id as string).sort();
    expect(PIECES.map((p) => p.id).sort()).toEqual(attendus);
  });
});
