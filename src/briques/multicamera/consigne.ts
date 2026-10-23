/**
 * BRIQUE MULTICAMÉRA — consignes envoyées au double HeyGen, et consigne dite au Monteur (lot F4). PUR.
 *
 * Fabrication d'un angle en deux temps :
 *  1. UNE FOIS par double : un look par angle (`creerLook`), à partir d'une image de la prise de face, avec la consigne
 *     « même personne, mêmes vêtements, même décor, même lumière, seule la caméra bouge » ;
 *  2. À CHAQUE vidéo : un rendu de ce look sur le MÊME audio que la prise (`audio_url` : lèvres pilotées par le son,
 *     durée identique), gestes appris sur le look filmé (`reference_look_id`).
 * Le texte n'est jamais relu par une voix de synthèse : c'est la voix de la prise qui fait parler chaque angle.
 */
import type { DemandeRenduVisage, FondRenduVisage } from "@/fournisseurs/types";
import type { Ratio } from "@/domaine/types";
import { normaliser } from "@/briques/coupes/texte";
import type { AngleGenere } from "./types";

const GARDER = "Same person, same face, same hairstyle, same outfit and accessories, same background, same lighting and colour grade as the reference image. Only the camera position changes. Photorealistic, natural skin, 9:16 vertical, waist-up framing, sharp focus on the face.";

/** Consigne de création du look de chaque angle (une fois par double). */
export const CONSIGNE_LOOK_ANGLE: Record<AngleGenere, string> = {
  cote: `${GARDER} Camera moved about 35 degrees to the side of the person, at eye level: a three-quarter view, the person still looks toward the original front camera, slightly off our lens.`,
  "contre-plongee": `${GARDER} Camera placed slightly below eye level, tilted up about 10 degrees (gentle low angle, no distortion): a calm posture of authority, shoulders open, chin neutral.`,
};

const GESTES = "steady head, small natural hand gestures below the chest, hands relaxed between gestures, calm and confident delivery, no pointing, no counting on fingers, no thumbs up";

/** Consigne de gestes du rendu (`motion_prompt`), cohérente avec celle de l'avocat. */
export const CONSIGNE_GESTES_ANGLE: Record<AngleGenere, string> = {
  cote: `eyes toward the front camera just off our lens, ${GESTES}`,
  "contre-plongee": `eyes on the camera lens, upright authoritative posture, ${GESTES}`,
};

export interface EntreeDemandeAngle {
  angle: AngleGenere;
  /** Look de cet angle chez le fournisseur (créé à l'étape 1). */
  lookId: string;
  /** Look filmé de la personne (gestes appris), s'il est connu. */
  referenceLookId?: string;
  /** Son de la prise d'origine (clé de stockage), adresse signée facultative. */
  audioCle: string;
  audioUrl?: string;
  ratio: Ratio;
  fond: FondRenduVisage;
  /** Identifiant stable du travail : la clé d'idempotence en dépend (jamais deux rendus payés pour un même essai). */
  travailId: string;
  essai: number;
}

/** La demande de rendu d'un angle : même son, même durée, même tenue, même décor. */
export function demandeRenduAngle(e: EntreeDemandeAngle): DemandeRenduVisage {
  return {
    visageId: e.lookId,
    audioCle: e.audioCle,
    ...(e.audioUrl ? { audioUrl: e.audioUrl } : {}),
    fond: e.fond,
    ratio: e.ratio,
    motionPrompt: CONSIGNE_GESTES_ANGLE[e.angle],
    cleIdempotence: `multicam:${e.travailId}:${e.angle}:e${e.essai}`,
    titre: `axion-multicam-${e.travailId}-${e.angle}-e${e.essai}`,
    ...(e.referenceLookId ? { referenceLookId: e.referenceLookId } : {}),
  };
}

/**
 * « Monteur, fais-le en 3 caméras » (et ses variantes : « en trois angles », « en multicaméra »). Une négation
 * (« pas », « sans », « une seule caméra ») ne l'allume jamais.
 */
export function estConsigneTroisCameras(texte: string): boolean {
  const formes = texte
    .replace(/[-'’]/g, " ")
    .split(/\s+/)
    .map(normaliser)
    .filter(Boolean);
  if (formes.some((f) => f === "pas" || f === "sans" || f === "plus" || f === "arrete" || f === "enleve")) return false;
  if (formes.some((f) => f === "multicamera" || f === "multicam" || f === "multicameras")) return true;
  return formes.some((f, i) => (f === "3" || f === "trois") && /^(cameras?|angles?|cams?)$/.test(formes[i + 1] ?? ""));
}
