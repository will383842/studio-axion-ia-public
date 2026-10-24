/**
 * EXEMPLES DE RYTHME (écriture du cas concret, 18/10/2026). Remplacent l'exemple unique (`EXEMPLE_TON_V4`, début de la v4
 * mot pour mot) qui faisait copier la première vidéo par tous les scripts suivants. Sujets INVENTÉS, sans lien avec les
 * cas du catalogue, de structures différentes : l'IA y prend le souffle d'un texte parlé, jamais ses mots ni ses faits.
 * PUR.
 */
import type { RolePatron } from "./patrons-ecriture";

export interface ExempleDeRythme {
  /** Sujet inventé (dit à l'IA pour qu'elle voie qu'il n'a rien à voir avec le cas). */
  sujet: string;
  /** Ce que l'extrait montre comme structure (accroche, « avant », bascule, résultat, fin). */
  structure: string;
  /** Le patron (`patrons-ecriture.ts`) que l'extrait illustre, rôle par rôle : chaque exemple montre une combinaison différente. */
  patrons: Record<RolePatron, string>;
  texte: string;
}

export const EXEMPLES_DE_RYTHME: readonly ExempleDeRythme[] = [
  {
    sujet: "un tableur de devis",
    structure: "accroche qui affirme · « avant » en liste de verbes · bascule courte · résultat chiffré · question finale directe",
    patrons: { accroche: "affirme", avant: "verbes", bascule: "courte", resultat: "chiffre", question: "metier" },
    texte:
      "Nos devis partent en dix minutes. Avant : saisir, recopier, vérifier, corriger, renvoyer. Une demi-journée par client. Alors le tableur travaille seul. Résultat : dix minutes au lieu d'une demi-journée. Et vous, quel tableau recopiez-vous encore à la main ?",
  },
  {
    sujet: "les réservations d'une salle de réunion",
    structure: "accroche qui dit le sujet par une scène · « avant » en une scène · bascule en règle · résultat en image · question sur le même problème",
    patrons: { accroche: "scene", avant: "scene", bascule: "regle", resultat: "image", question: "metier" },
    texte:
      "Vos réservations de salle se croisent. Lundi matin, deux équipes arrivent à la même porte : l'une a réservé par message, l'autre sur le tableau. Personne ne sait qui est arrivé en premier, et la réunion commence en retard. Voici ce que devient une réservation. Elle est notée une seule fois, au même endroit, quel que soit le moyen. La salle affiche alors qui l'occupe, en direct. Votre équipe n'arbitre plus rien. Combien de réservations se croisent chez vous ?",
  },
  {
    sujet: "les factures d'un artisan",
    structure: "accroche qui pose une question · « avant » en une scène · bascule courte · résultat durable · invitation à imaginer",
    patrons: { accroche: "question", avant: "scene", bascule: "courte", resultat: "durable", question: "imaginer" },
    texte:
      "Vos factures d'artisan partent-elles le jour même ? Un plombier termine un chantier à midi. Le soir, il note ses heures sur un papier ; la facture attend dans la camionnette. Alors le papier devient un message. La facture se prépare à partir de ce message, avec le client et les heures déjà remplis. Le plombier relit, puis valide. Désormais, la facture part avant le chantier suivant. Imaginez le même soir sans le papier froissé. Quelle facture attend dans votre camionnette ?",
  },
  {
    sujet: "un planning de bénévoles",
    structure: "accroche qui affirme par contraste · « avant » en liste de verbes courts · bascule par un choix · résultat en gain de temps · question de choix",
    patrons: { accroche: "contraste", avant: "verbes", bascule: "regle", resultat: "libere", question: "choix" },
    texte:
      "Le planning de samedi s'écrit tout seul. Avant, on relançait, on comparait, on rayait, on réécrivait, on s'excusait. Une soirée entière, chaque mois. Un seul choix a suffi : donner la main au tableau. Les rappels partent, les remplaçants répondent, la liste se range. Le temps gagné sert à accueillir les gens. Entre l'accueil et le planning, que préférez-vous garder ?",
  },
];

/**
 * Le bloc de la consigne : les extraits, avec la mise en garde (exemples de RYTHME, sujets inventés ; ni leurs mots ni
 * leurs faits).
 */
export function blocExemplesDeRythme(): string {
  return [
    "EXEMPLES DE RYTHME ET DE TON PARLÉ (sujets INVENTÉS, sans aucun lien avec ton cas) : ils montrent le souffle d'un texte dit, la longueur des phrases, la façon d'enchaîner. Ne reprends NI leurs mots NI leurs faits NI leurs chiffres ; leurs structures sont volontairement toutes différentes, aucune n'est LA structure à suivre.",
    ...EXEMPLES_DE_RYTHME.map((e) => `- ${e.sujet} (${e.structure}) : « ${e.texte} »`),
  ].join("\n");
}
