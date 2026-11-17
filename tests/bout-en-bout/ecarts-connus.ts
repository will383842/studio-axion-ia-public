/**
 * Écarts CONNUS de la matrice « générateur × réseau » (fiche ESSAI-BOUT-EN-BOUT-PAR-GENERATEUR).
 *
 * Chaque ligne dit : quel générateur (identifiant de format), quel réseau, quel contrôle échoue, pourquoi, et quelle
 * fiche le corrige. La matrice (`matrice-generateur-reseau.test.ts`) compare ce qu'elle observe à cette liste :
 *  - un écart observé qui n'est PAS listé fait échouer la case (générateur et réseau nommés) ;
 *  - un écart listé qui n'existe plus (corrigé) fait aussi échouer la case : retirer alors la ligne ici.
 * Aucun fichier de src/ n'est corrigé par la fiche d'essai : un défaut s'écrit ici, jamais dans le code.
 */
import type { IdReseau } from "@/domaine/types";

/** Les contrôles d'une case. */
export type ControleMatrice = "texte-du-script" | "hashtags" | "premier-commentaire" | "fichier-choisi" | "avertissement-bloquant" | "corps-zernio";

export interface EcartConnu {
  /** Identifiant du format (générateur), tel que lu dans `src/formats`. */
  generateur: string;
  reseau: IdReseau;
  controle: ControleMatrice;
  /** Morceau du constat attendu : un écart du même contrôle mais d'un autre motif n'est PAS couvert. */
  motif: string;
  /** Ce qui ne va pas, en une phrase. */
  nature: string;
  /** Fiche qui corrige l'écart (« fiche à créer » si aucune n'existe encore). */
  fiche: string;
}

const NATURE_INSTAGRAM =
  "Le rédacteur de textes simulé sort 5 mots-dièse (`legende.motsDieseConseilles` du registre) alors que la règle d'envoi sourcée (`placerHashtags`) en veut 3 au plus sur Instagram : « 5 mots-dièse : 3 au plus pour ce réseau ».";
const FICHE_INSTAGRAM = "fiche à créer (aligner `motsDieseConseilles` d'Instagram dans src/reseaux/index.ts sur la règle d'écriture 0 à 3)";

export const ECARTS_CONNUS: readonly EcartConnu[] = [
];
