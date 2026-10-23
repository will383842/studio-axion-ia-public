/**
 * Réglages › Plafond d'un sujet (Écrire) : Will règle LUI-MÊME `generateur.plafondSujetUsd` (lu par l'écran Écrire et par l'Usine).
 * Serveur seulement, aucune dépense. Règle d'argent : le défaut (1,50 $) ne change JAMAIS sans saisie de Will ; cette
 * écriture ne touche pas `generateur.plafondGrandeChaineUsd`. Montants en centimes de dollar ENTIERS (jamais de flottant dans une somme).
 */
import "server-only";
import { ecrireParametre, ErreurStudio, journaliser, lireParametre, sousVerrou } from "./_commun";
import { formaterUsd } from "@/domaine/plafond-sujet";
import { exigerSession } from "./auth";
import { PARAM_PLAFOND_SUJET, plafondChaineUsd } from "./generation-claude";

/** Bornes de sécurité, en centimes de dollar : de 0,50 $ à 5 $. */
export const BORNES_PLAFOND_SUJET_CENTIMES = Object.freeze({ min: 50, max: 500 });

const estPlafondValable = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= BORNES_PLAFOND_SUJET_CENTIMES.min && v <= BORNES_PLAFOND_SUJET_CENTIMES.max;

/** « 1,50 $ » depuis des centimes entiers. */
export const formaterDollars = (centimes: number): string => `${Math.floor(centimes / 100)},${String(centimes % 100).padStart(2, "0")} $`;

export interface PlafondSujetLu {
  /** Plafond RÉELLEMENT appliqué (dollars), exactement ce que lit `plafondChaineUsd`. */
  usd: number;
  /** Même valeur arrondie au centime (champ de saisie). */
  centimes: number;
  /** Une valeur valable est posée en base (saisie de Will) ; sinon c'est le défaut. */
  reglee: boolean;
  /** La valeur posée est appliquée telle quelle mais sort des bornes de saisie (0,50 $ à 5 $). */
  horsBornes: boolean;
}

/** Plafond en vigueur : la VRAIE valeur appliquée (`plafondChaineUsd`), jamais remplacée. Réglage absent ou illisible → défaut, `reglee: false`. */
export async function lirePlafondSujet(): Promise<PlafondSujetLu> {
  const [usd, brut] = await Promise.all([plafondChaineUsd("courte"), lireParametre<unknown>(PARAM_PLAFOND_SUJET, null)]);
  const reglee = typeof brut === "number" && Number.isFinite(brut) && brut >= 0;
  const centimes = Math.round(usd * 100);
  return { usd, centimes, reglee, horsBornes: reglee && !(Math.abs(usd * 100 - centimes) < 1e-6 && estPlafondValable(centimes)) };
}

/** Écrit le plafond (seul endroit). Session exigée ; refus hors bornes ou non entier ; même valeur → rien d'écrit ni journalisé. */
export async function definirPlafondSujet(centimes: unknown): Promise<number> {
  await exigerSession();
  if (!estPlafondValable(centimes)) {
    throw new ErreurStudio("PLAFOND_INVALIDE", `Indiquez un plafond entre ${formaterDollars(BORNES_PLAFOND_SUJET_CENTIMES.min)} et ${formaterDollars(BORNES_PLAFOND_SUJET_CENTIMES.max)}.`);
  }
  return sousVerrou(async () => {
    const avant = await lirePlafondSujet();
    if (avant.reglee && Math.abs(avant.usd * 100 - centimes) < 1e-6) return centimes;
    await ecrireParametre(PARAM_PLAFOND_SUJET, centimes / 100);
    await journaliser("budget", `Plafond d'un sujet (Écrire) : ${formaterUsd(avant.usd)} → ${formaterUsd(centimes / 100)}`);
    return centimes;
  });
}
