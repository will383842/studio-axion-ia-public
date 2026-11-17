/** C4-U4.9b-a : bloc de consigne du téléphone qui joue un extrait et lecture du réglage, purs. Rien ne l'importe. Le branchement (consigne, réalisateur, état figé) vient après C4-U4.9a (chef). Aucun son : le téléphone joue muet. */
import { ecrireRechercheAxion, PREFIXE_AXION } from "../extraits-maison/recherche";
import { DUREE_MIN_EXTRAIT_V4_SEC } from "../extraits-maison/types";

export const PARAM_TELEPHONE_VIDEO_FA = "facecamAnimee.telephoneVideo";

/** Seul `true` exact allume ; toute autre valeur ou une lecture qui lève éteint. */
export async function telephoneVideoActif(lire: (id: string, defaut: unknown) => Promise<unknown>): Promise<boolean> {
  try {
    return (await lire(PARAM_TELEPHONE_VIDEO_FA, false)) === true;
  } catch {
    return false;
  }
}

/** Bloc de consigne ; chaîne vide si `actif` n'est pas exactement `true`. Texte fixe. */
export function blocTelephoneVideo(actif: unknown): string {
  if (actif !== true) return "";
  const exemple = ecrireRechercheAxion(["dirigeant", "qui", "signe", "devis", "ordinateur"]);
  return [
    `TÉLÉPHONE QUI JOUE UN EXTRAIT (plaquette « telephone-video »)`,
    `Choisissez-la quand Will parle d'une chose déjà montrée dans une de SES vidéos publiées ; la première « recherche » commence alors par ${PREFIXE_AXION}, par exemple « ${exemple} ».`,
    `Un seul téléphone à la fois, jamais deux de suite.`,
    `L'extrait dure au moins ${DUREE_MIN_EXTRAIT_V4_SEC} s.`,
    `S'il n'est pas trouvé, choisissez à la place une plaquette sans vidéo, sans rien promettre.`,
  ].join("\n");
}
