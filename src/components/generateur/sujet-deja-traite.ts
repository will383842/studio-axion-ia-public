/**
 * Écran Sujet : règles d'ordre du « sujet déjà traité » (lot L5), en fonctions pures pour être testées sans navigateur.
 * Le contrôle est celui du serveur (`creerSujetAction`, avant toute création et toute dépense) : l'écran n'affiche que
 * son refus, laisse choisir (« Choisir un autre sujet » ou « Refaire quand même ») et renvoie le jeton reçu. Pas de
 * « Nouvel angle » ici : rien ne l'honorerait.
 */
import type { Confirmation } from "@/domaine/sujets-traites";
import type { RefusSujetDejaTraite } from "@/services/sujet-central-controle";

/** Le refus est valable pour CE sujet et CE format ; dès que l'idée ou le format change, il tombe. */
export interface RefusAffiche {
  refus: RefusSujetDejaTraite;
  idee: string;
  formatId: string;
}

/** Ce que renvoie `creerSujetAction` en cas de réussite ou de refus. */
export type DonneesCreation = { id: string; ecrit: boolean } | RefusSujetDejaTraite;

export const estRefus = (d: DonneesCreation): d is RefusSujetDejaTraite => "statut" in d && d.statut === "sujet-deja-traite";

/** Le refus affiché ne vaut que pour l'idée et le format pour lesquels il a été donné. */
export const refusEncoreValable = (r: RefusAffiche | undefined, idee: string, formatId: string): RefusAffiche | undefined => (r && r.idee === idee.trim() && r.formatId === formatId ? r : undefined);

/** Le refus à afficher après une réponse du serveur. */
export const refusDeLaReponse = (d: DonneesCreation, idee: string, formatId: string): RefusAffiche | undefined => (estRefus(d) ? { refus: d, idee: idee.trim(), formatId } : undefined);

/** « Refaire quand même » : exactement le choix et le jeton reçus (jamais « nouvel-angle » dans cet écran). */
export const confirmationRefaire = (r: RefusAffiche | undefined): Confirmation | undefined => (r ? { choix: "refaire", jeton: r.refus.jeton } : undefined);

/** « Choisir un autre sujet » : la suggestion remplit le sujet (son titre). */
export const ideeDeLaSuggestion = (titre: string): string => titre.trim();

/**
 * Anti double clic : une écriture ne part que si l'idée est prête, qu'aucune n'est en cours et que le verrou (posé
 * à l'instant du clic, avant que l'écran ne se redessine) est libre.
 */
export const peutLancer = (pret: boolean, enCours: boolean, verrouPose: boolean): boolean => pret && !enCours && !verrouPose;

/** Tant qu'un refus valable est affiché, le bouton principal attend le choix de Will (autre sujet ou refaire). */
export const boutonPrincipalActif = (pret: boolean, refus: RefusAffiche | undefined): boolean => pret && !refus;

/** Phrase au-dessus des précédents. */
export const phraseDuRefus = (r: RefusSujetDejaTraite): string => (r.jetonPerime ? "Ce sujet a changé depuis votre choix : choisissez de nouveau." : r.phrase);
