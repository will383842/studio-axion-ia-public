/**
 * Le banc comme test : chaque fiche du banc × chaque style, par la vraie fabrication, toutes les sorties. Objectif :
 * AUCUN refus dû au moteur. Seuls les refus de CONTENU listés ici sont admis, chacun avec sa raison.
 */
import { describe, expect, it } from "vitest";
import { STYLES_TABLEAU } from "../../../src/briques/tableau-scene/trois-styles/styles";
import { passerAuBanc } from "./banc";
import { fichesBanc } from "./fiches-banc";

/**
 * Refus légitimes (le contenu de la fiche, pas le moteur) : le témoin BRUT de la vidéo d'essai v-667edcd8e3a8 (tel
 * qu'enregistré avant sa correction) écrit « Tâches à apprendre en premier, des minutes gagnées par mail. » (les
 * chiffres dits « trois » et « dix » retirés, phrase tronquée) et ne montre pas sa preuve : la fiche est refusée à sa
 * relecture, comme elle doit l'être. Sa version corrigée passe.
 */
const DEBIT_165 = /règle « (durée de 90 secondes au plus|du rythme : un événement visuel toutes les 4 secondes) »/;
export const REFUS_ADMIS: Readonly<Record<string, RegExp>> = {
  "fiche-temoin-v-667edcd8e3a8-reference-3": /preuve validée à l'écran|a retiré « (trois|dix) »/,
  "trois-styles · témoin v-667edcd8e3a8": /preuve validée à l'écran|a retiré « (trois|dix) »/,
  // Lot B2b : fiches RÉELLES enregistrées avant le débit de 165 mots/min (voix-tableau/3, 16,9 car/s, limite 1 520 caractères).
  // Leur texte dit, inchangé, dépasse maintenant 90 s (habitude-equipe : 1 670 caractères, fabrication-arrêtée : 1 561 ;
  // 91,7 s) ou laisse un trou de rythme dû à des ancres posées pour l'ancien débit (tâches répétitives, s09 : 70,8 à 76,4 s).
  // C'est le comportement voulu : elles sont refusées à la fiche, pas par le moteur.
  "fiche-habitude-equipe-prod": DEBIT_165,
  "fiche-habitude-equipe-reference-2": DEBIT_165,
  "fabrication-arretee-ecriture-a-l-heure-2026-10-15": DEBIT_165,
  "fiche-taches-repetitives-reference-2": DEBIT_165,
};

/** Les fiches du banc dont l'index vaut `part` modulo `parts` (le banc est réparti sur plusieurs fichiers de test). */
export function verifierBanc(part: number, parts: number): void {
  const fiches = fichesBanc().filter((_, i) => i % parts === part);
  for (const fb of fiches)
    describe(fb.nom, () => {
      for (const style of STYLES_TABLEAU)
        it(`${style} : toutes les sorties, aucun refus du moteur`, async () => {
          const lignes = await passerAuBanc(fb, style);
          const admis = REFUS_ADMIS[fb.nom];
          const refus = lignes.flatMap((l) => (l.refus ? l.refus.raisons.filter((r) => !admis?.test(r)).map((r) => `${l.sortie} · ${l.refus!.etape} · ${r}`) : []));
          expect(refus).toEqual([]);
          if (admis) expect(lignes.every((l) => l.refus?.etape === "fiche")).toBe(true);
          else expect(lignes.map((l) => l.refus)).toEqual(lignes.map(() => null));
        }, 300_000);
    });
}
