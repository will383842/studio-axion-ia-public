/**
 * ESSAI 3 · MISE EN PAGE AU MAXIMUM DES BORNES : chaque gabarit du style « blocs/2 », rempli au maximum de ce que la fiche
 * permet (6 éléments de liste de 40 caractères, détails de 40, étiquette de 24, nom d'étape de 14, 40 mots écrits par
 * écran), dans les 5 sorties. Un texte qui respecte les bornes ne sort JAMAIS de la zone sûre ni ne passe sous la taille
 * plancher : soit la relecture de l'image passe, soit la mise en page est refusée par un message qui dit quoi raccourcir.
 * Aucun appel.
 */
import { describe, expect, it } from "vitest";
import { controlerImageSortie } from "../../../src/moteurs/montage-tableau/controles";
import { GABARITS_ECRAN } from "../../../src/moteurs/montage-tableau/fiche";
import { IDS_SORTIES } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { sortiesRelues } from "../../../src/moteurs/montage-tableau/relecture";
import { ficheAvec } from "./gabarits-max";

const PLANCHER_OU_ZONE = new Set(["Zone sûre", "Bande des sous-titres", "Taille du texte"]);

describe("chaque gabarit au maximum de ses bornes, dans les 5 sorties", () => {
  for (const g of GABARITS_ECRAN) {
    it(`${g} : jamais hors zone ni trop petit ; sinon un message qui dit quoi raccourcir`, () => {
      const fiche = ficheAvec(g);
      for (const s of sortiesRelues(fiche, IDS_SORTIES, () => ({ id: "fin-if-mot-envoi", ecran: "Écrivez RELANCES en commentaire", type: "commentaire", mot: "RELANCES", dit: "Écrivez RELANCES en commentaire." }))) {
        const lignes = controlerImageSortie(s.fiche, { id: s.id, libelle: s.libelle, fiche: s.fiche, options: s.options });
        const echecs = lignes.filter((l) => l.etat === "echoue");
        for (const l of echecs) {
          // La mise en page refusée nomme la scène et dit quoi raccourcir ; aucun autre contrôle de l'image n'échoue.
          expect.soft(PLANCHER_OU_ZONE.has(l.libelle), `${g} · ${s.id} · ${l.libelle} : ${l.raison}`).toBe(false);
          if (l.libelle === "Mise en page") expect.soft(l.raison, `${g} · ${s.id}`).toMatch(/Raccourcissez/);
        }
      }
    });
  }
});
