/**
 * BRIQUE MULTICAMÉRA — vérification de cohérence des angles fabriqués et repli (lot F4). PUR.
 *
 * Un angle fabriqué n'entre au montage que s'il raccorde avec la prise d'origine :
 *  - même durée, au mot près (écart ≤ 2 images à 25 i/s) ;
 *  - même son : les lèvres suivent l'audio (décalage ≤ 1 image) ;
 *  - un visage présent sur (presque) toutes les images contrôlées.
 * Un angle en échec (rendu raté, mesure absente ou hors tolérance) est ÉCARTÉ : ses passages repartent sur la face
 * (repli automatique). La face, prise d'origine, est toujours retenue.
 */
import { ANGLES_GENERES, type AngleGenere, type AngleMulticamera } from "./types";

/** Mesures d'une vidéo d'angle comparée à la prise d'origine (faites par l'analyseur : `studio-rendu` ou simulation). */
export interface MesureAngle {
  dureeSec: number;
  /** Décalage mesuré entre les lèvres et le son (ms, valeur absolue prise). */
  decalageAudioMs: number;
  /** Part des images contrôlées où un visage est trouvé (0-100). */
  visagePresentPct: number;
}

export const TOLERANCES_MULTICAMERA = { ecartDureeSec: 0.08, decalageAudioMs: 40, visageMinPct: 95 };

export interface VerdictAngle {
  angle: AngleGenere;
  ok: boolean;
  /** Phrases simples, pour Will (vide si l'angle est bon). */
  raisons: string[];
}

const NOMS: Record<AngleGenere, string> = { cote: "L'angle de côté", "contre-plongee": "L'angle d'en bas" };

export function verifierAngle(angle: AngleGenere, dureeReferenceSec: number, mesure?: MesureAngle | null, erreur?: string): VerdictAngle {
  if (erreur) return { angle, ok: false, raisons: [`${NOMS[angle]} n'a pas pu être fabriqué : ${erreur}`] };
  if (!mesure) return { angle, ok: false, raisons: [`${NOMS[angle]} n'a pas pu être contrôlé.`] };
  const raisons: string[] = [];
  const t = TOLERANCES_MULTICAMERA;
  if (!Number.isFinite(mesure.dureeSec) || Math.abs(mesure.dureeSec - dureeReferenceSec) > t.ecartDureeSec) raisons.push(`${NOMS[angle]} n'a pas la même durée que votre prise.`);
  if (!Number.isFinite(mesure.decalageAudioMs) || Math.abs(mesure.decalageAudioMs) > t.decalageAudioMs) raisons.push(`${NOMS[angle]} : les lèvres ne suivent pas exactement la voix.`);
  if (!Number.isFinite(mesure.visagePresentPct) || mesure.visagePresentPct < t.visageMinPct) raisons.push(`${NOMS[angle]} : le visage n'est pas visible partout.`);
  return { angle, ok: raisons.length === 0, raisons };
}

/** Les angles retenus (face toujours en tête) et les angles écartés avec leur raison. */
export function anglesRetenus(verdicts: readonly VerdictAngle[]): { angles: AngleMulticamera[]; replis: { angle: AngleGenere; raison: string }[] } {
  const angles: AngleMulticamera[] = ["face"];
  const replis: { angle: AngleGenere; raison: string }[] = [];
  for (const a of ANGLES_GENERES) {
    const v = verdicts.find((x) => x.angle === a);
    if (v?.ok) angles.push(a);
    else replis.push({ angle: a, raison: v?.raisons[0] ?? `${NOMS[a]} manque.` });
  }
  return { angles, replis };
}
