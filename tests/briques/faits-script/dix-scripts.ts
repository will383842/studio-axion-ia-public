/**
 * Les dix scripts de contrôle des animations nées du script (GV2-40, GV2-42…), recopiés tels quels.
 * Ce fichier est relu par d'autres fiches : garder les deux noms exportés `DIX_SCRIPTS` et `motsHorodates`.
 */
import type { MotFait } from "../../../src/briques/faits-script/types";

export const DIX_SCRIPTS: string[] = [
  "Vous perdez deux heures par jour à répondre aux mêmes mails. Avec un assistant bien réglé, on passe de 2 heures à 20 minutes. Le secret tient en trois étapes : d'abord trier, ensuite répondre, enfin classer. Essayez dès lundi.",
  "Un artisan sur deux ne rappelle jamais ses prospects. Résultat : 40 % des devis partent chez le concurrent. La différence entre un artisan débordé et un artisan organisé, c'est un simple rappel automatique. Mettez-le en place aujourd'hui.",
  "Hier, une cliente m'a dit : je n'ai pas le temps de m'occuper de l'intelligence artificielle. Je lui ai répondu que c'est justement pour ça qu'il faut s'y mettre. Le temps ne se trouve pas, il se gagne.",
  "Les 4 erreurs qui ruinent votre fiche Google : pas de photos, pas d'horaires, aucun avis, aucune réponse. Corrigez-les cette semaine et regardez vos appels remonter.",
  "À Lyon, un restaurant de quarante couverts a réduit son gaspillage de 30 % en trois mois. Comment ? En prévoyant ses commandes avec ses ventes passées. Pas de magie, juste des chiffres bien lus.",
  "Avant, je passais mes dimanches sur ma comptabilité. Aujourd'hui, tout est rangé le vendredi soir. Ce qui a changé : une photo de chaque facture, envoyée au bon endroit, au bon moment.",
  "Faut-il un site internet en 2026 ? Oui, mais pas pour les raisons que vous croyez. Votre site rassure, il ne vend pas. Ce qui vend, c'est la réponse rapide. Répondez en moins de cinq minutes et vous signez deux fois plus.",
  "D'un côté, le bouche à oreille, lent mais solide. De l'autre, la publicité, rapide mais chère. Entre les deux, il y a vos anciens clients. Écrivez-leur une fois par mois.",
  "Trois questions à poser avant de signer avec une agence : qui fait le travail, combien de temps ça dure, et comment on arrête. Si la réponse est floue, fuyez.",
  "Votre téléphone sonne pendant que vous êtes sur un chantier. Vous ne décrochez pas. Le client appelle le suivant. Un répondeur intelligent prend le message, propose un créneau et vous prévient par SMS. Vous ne perdez plus un seul appel.",
];

/** Un mot par espace, `pasMs` millisecondes par mot (350 par défaut). */
export function motsHorodates(script: string, pasMs = 350): MotFait[] {
  return script
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((texte, i) => ({ texte, debutMs: i * pasMs, finMs: (i + 1) * pasMs }));
}
