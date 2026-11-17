/** C4-U4.6a : bloc de consigne `axion:` et lecture du réglage, purs. Rien ne l'importe : le branchement (consigne, réalisateur, état figé) est la suite de C4-U4.6, après C4-U4.5b (chef). */
import { ecrireRechercheAxion, PREFIXE_AXION } from "../extraits-maison/recherche";
import { DUREE_MIN_EXTRAIT_V4_SEC } from "../extraits-maison/types";
import { SEUILS } from "./regles";

export const PARAM_EXTRAITS_MAISON_FA = "facecamAnimee.extraitsMaison";

/** Seul `true` exact allume ; toute autre valeur ou une lecture qui lève éteint. */
export async function extraitsMaisonActif(lire: (id: string, defaut: unknown) => Promise<unknown>): Promise<boolean> {
  try {
    return (await lire(PARAM_EXTRAITS_MAISON_FA, false)) === true;
  } catch {
    return false;
  }
}

/** Bloc de consigne ; chaîne vide si `actif` n'est pas exactement `true`. Texte fixe. */
export function blocExtraitsMaison(actif: unknown): string {
  if (actif !== true) return "";
  const exemple = ecrireRechercheAxion(["dirigeant", "qui", "signe", "devis", "ordinateur"]);
  return [
    `EXTRAITS DES VIDÉOS DE WILL (préfixe « ${PREFIXE_AXION} »)`,
    `Une « recherche » de vidéo peut commencer par ${PREFIXE_AXION} suivi de mots-clés, par exemple « ${exemple} », pour demander un extrait des vidéos de Will déjà publiées.`,
    `Faites-le seulement quand ce qui est dit montre une chose que Will a déjà filmée : son écran, son outil, une de ses vidéos. Sinon, gardez la recherche habituelle (QUI + FAIT QUOI + OÙ).`,
    `La recherche ${PREFIXE_AXION} garde les mêmes règles : au moins ${SEUILS.rechercheMotsMin} mots porteurs, et au moins un mot de « illustre ».`,
    `Un extrait dure au moins ${DUREE_MIN_EXTRAIT_V4_SEC} s. Il peut ne pas être trouvé : la plaquette suit alors le chemin habituel, sans rien promettre.`,
  ].join("\n");
}
