/**
 * MÉMOIRE COMMUNE BRANCHÉE DANS L'ÉCRITURE DU CAS CONCRET (lot C4). Même schéma que l'écriture centrale (lot C3,
 * `domaine/ecriture-commune/memoire-centrale.ts`) : le bloc « à ne pas redire » va dans la partie VARIABLE du prompt, jamais
 * dans la consigne ni dans le socle (cache) ; la ressemblance est une ALERTE (note de l'étape), jamais une relance payée ni
 * un refus. L'outil est fourni par le service (réglage `ecriture.memoireCasConcret`, coupé par défaut) : sans lui, ou s'il
 * rend « rien », le prompt est identique octet pour octet. PUR : aucun service importé.
 *
 * PHRASES IMPOSÉES du format : le gabarit de transition, la question finale du gabarit, les amorces fixes, la phrase de
 * conformité et les appels de la banque des fins reviennent mot pour mot dans les scripts gardés. Sans exclusion, elles
 * déclenchent une fausse alerte sur presque chaque script et arrivent en tête du bloc « à ne pas redire » alors que le prompt
 * demande de les dire. Elles sont donc passées en `tolere` à la mémoire ET en `exclusions` à la mesure.
 */
import { PHRASES_BANQUE_FINS } from "@/briques/fins/banque";
import type { MemoireCentrale } from "@/domaine/ecriture-commune/memoire-centrale";
import { CATALOGUE, estCasStock } from "@/formats/cas-concret/catalogue";

/** Le format dans la mémoire commune. */
export const FORMAT_CAS_CONCRET = "cas-concret";

/** Phrases du gabarit (`ficheParGabarit`) : une seule source, utilisée par le gabarit ET par les exclusions. */
export const BASCULE_GABARIT = "Voici la méthode, étape par étape.";
export const QUESTION_GABARIT = "Et dans votre entreprise, quelle tâche pourrait tourner toute seule ?";
export const QUESTION_GABARIT_LONGUE = "Et chez vous, dans votre entreprise, quelle tâche répétitive pourrait tourner toute seule ?";
export const AMORCE_GESTE_GABARIT = "Ce geste vous évite";
export const AMORCE_RESTE_HUMAIN_GABARIT = "Ce qui reste humain";

/**
 * Phrases de conformité validées par Will (dites mot pour mot dans chaque cas qui en porte une). Les cas du STOCK par métier
 * n'y sont PAS : ils n'existent que si `casConcret.stockMetiers` est allumé, et ce module est pur (il ne lit aucun réglage).
 * Réglage éteint, la liste est donc celle d'avant le stock. Chaque cas redit déjà SA propre phrase (`textesImposesDuCas`).
 */
const PHRASES_CONFORMITE: string[] = [...new Set(CATALOGUE.filter((c) => !estCasStock(c.id)).map((c) => c.conformite?.rgpd?.phrase).filter((p): p is string => !!p?.trim()))];

/** Tout ce que le format impose ou répète à l'identique, quel que soit le cas. */
export const PHRASES_FIXES_CAS_CONCRET: readonly string[] = [
  BASCULE_GABARIT,
  QUESTION_GABARIT,
  QUESTION_GABARIT_LONGUE,
  AMORCE_GESTE_GABARIT,
  AMORCE_RESTE_HUMAIN_GABARIT,
  ...PHRASES_CONFORMITE,
  ...PHRASES_BANQUE_FINS,
];

/** L'outil de mémoire fourni par le service (`OutilsEcriture.memoireCommune`). */
export interface MemoireCommuneEcriture {
  /** La mémoire à passer à l'écriture, ou `null` (réglage coupé, illisible, vide). `tolere` : les phrases imposées ; `sauf` : la vidéo qui s'écrit. */
  preparer: (tolere: readonly string[], sauf?: string) => Promise<MemoireCentrale | null>;
  /** Range le texte dit d'un script écrit et accepté (fenêtre de 60, partagée). Sans effet réglage coupé. */
  enregistrer: (texte: string) => Promise<void>;
}

/**
 * Fige le bloc au journal de la vidéo : un appel détaché est reconnu à son entrée (partie variable comprise). Si la mémoire
 * grossissait entre deux passages, l'entrée changerait et une réponse déjà payée ne serait plus reconnue (double paiement).
 * Le PREMIER résultat est donc gardé, quel qu'il soit, et rendu à chaque passage : un bloc vide ("") est figé aussi, sinon un
 * bloc apparu au passage suivant (panne de lecture passagère, réglage allumé en cours d'écriture) changerait l'entrée de
 * l'appel déjà lancé et le ferait payer deux fois, le second sans réservation.
 */
export function figerMemoireCommune(source: MemoireCommuneEcriture, journal: { memoireCommune?: string }, garder: () => Promise<void>): MemoireCommuneEcriture {
  return {
    enregistrer: (texte) => source.enregistrer(texte),
    async preparer(tolere, sauf) {
      const frais = await source.preparer(tolere, sauf).catch(() => null);
      if (journal.memoireCommune !== undefined) return { anciens: frais?.anciens ?? [], origine: frais?.origine, appelsRecents: frais?.appelsRecents, bloc: journal.memoireCommune };
      journal.memoireCommune = frais?.bloc.trim() ? frais.bloc : "";
      try {
        await garder();
      } catch {
        // le journal n'est qu'une aide : un échec ne change pas l'écriture
      }
      return frais;
    },
  };
}
