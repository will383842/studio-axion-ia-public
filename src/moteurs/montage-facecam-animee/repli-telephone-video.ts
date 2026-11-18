/**
 * C4-U4.9b-b : repli du téléphone qui joue un extrait quand aucun extrait n'est trouvé. Pur, rien ne l'importe.
 * Éteint : sans l'option, la liste est exactement `IDS_PLAQUETTES_A_VIDEO_V4`.
 */
import { IDS_PLAQUETTES_A_VIDEO_V4 } from "./repli-sans-video-v4";

/** Égal à `ID_TELEPHONE_VIDEO` de `rendus-lot6.tsx` (vérifié par le test) ; on n'importe pas C4-U4.9a-a, qui peut ne pas être fusionnée. */
const ID = "telephone-video";

/** Liste des plaquettes à vidéo : seul `telephoneVideo === true` y ajoute le téléphone. PUR. */
export function idsPlaquettesAVideoOuvertes(options?: { telephoneVideo?: unknown }): readonly string[] {
  if (options?.telephoneVideo !== true) return IDS_PLAQUETTES_A_VIDEO_V4;
  return Object.freeze([...IDS_PLAQUETTES_A_VIDEO_V4, ID]);
}

const secondes = (x: number) => `${x.toFixed(1).replace(".", ",")} s`;

/** Consigne D16 propre au téléphone (même forme que `erreursRepliV4`). PUR, ne lève jamais. */
export function erreurRepliTelephone(rang: number, debutSec: number): string {
  return `D16 — élément v4 ${rang + 1} « ${ID} » à ${secondes(debutSec)} : aucun extrait des vidéos de Will n'a été trouvé ; remplacez-le par une plaquette sans vidéo qui montre littéralement ce qui est dit (FenetreTelephone, FenetreDouble, CarrouselFeuillete…), sans « recherches ». Gardez V6, V7, H1 et H2.`;
}
