/**
 * Contrôle pur d'une pièce neuve : contraste du texte (4,5 pour 1) et police (Manrope).
 * Aucun import « @/ » : ce dossier est copié par l'image du rendu. Importe seulement `./contraste`.
 * Appelé par les tests des pièces neuves (C6, C9, C10, C8). Jamais d'exception.
 */
import { rapportContraste } from "./contraste";

export const CONTRASTE_TEXTE_MIN = 4.5;
export const POLICE_PIECE_NEUVE = "Manrope";
export const POLICE_V4 = "Manrope"; // POLICES-P7-f (25/11) : la face caméra v4 passe en Manrope (décision P7 de Williams)

const OPAQUE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function controlerPieceNeuve(p: {
  id: string;
  textes: { couleur: string; fond: string }[];
  police?: string;
}): string[] {
  const erreurs: string[] = [];
  for (const { couleur, fond } of p.textes) {
    if (!OPAQUE.test(couleur.trim()) || !OPAQUE.test(fond.trim())) {
      erreurs.push(`${p.id} : couleur opaque attendue (#RGB ou #RRGGBB), reçu ${couleur} sur ${fond}`);
      continue;
    }
    const r = rapportContraste(couleur, fond);
    if (r < CONTRASTE_TEXTE_MIN) {
      erreurs.push(
        `${p.id} : contraste ${(Math.floor(r * 10) / 10).toFixed(1).replace(".", ",")} pour 1 entre ${couleur} et ${fond}, minimum 4,5`,
      );
    }
  }
  if (p.police !== undefined && !p.police.trim().startsWith(POLICE_PIECE_NEUVE)) {
    erreurs.push(`${p.id} : police « ${p.police} » refusée, une pièce neuve est en ${POLICE_PIECE_NEUVE}`);
  }
  return erreurs;
}
