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
    sujet: "un déménagement",
    structure: "accroche qui pose une question · « avant » en une scène · bascule en détour · résultat en image · question finale sur le quotidien",
    patrons: { accroche: "question", avant: "scene", bascule: "detour", resultat: "image", question: "metier" },
    texte:
      "Combien de cartons avez-vous déjà perdus ? Samedi matin, trois personnes cherchent la clé du camion pendant que le canapé attend sur le trottoir. Un détour, pourtant, change tout. Pourquoi cette clé disparaissait-elle ? Personne ne savait qui l'avait prise. Maintenant, chaque clé porte un nom et un créneau. Le canapé entre le premier. Quelle clé cherchez-vous chaque semaine ?",
  },
  {
    sujet: "un camion de livraison",
    structure: "accroche qui décrit une scène · « avant » en une question · bascule en constat · résultat chiffré en image · invitation à imaginer",
    patrons: { accroche: "scene", avant: "question", bascule: "constat", resultat: "image", question: "imaginer" },
    texte:
      "Six heures du matin, le camion démarre déjà chargé. Comment ? La veille, qui comptait les colis un à un, le soir, sous le néon ? Personne n'en voulait. Il existait une autre façon. Le bon colis trouve son camion avant la nuit. Cette semaine : zéro oubli, zéro appel furieux. Imaginez le même soir, sans les cartons à compter. Quelle tâche part trop tard chez vous ?",
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
