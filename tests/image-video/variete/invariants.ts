/**
 * Aide PARTAGÉE des lots de variété (lecture seule pour eux) : une ligne de temps AVEC recette garde ce que la carte
 * montre et dit. Mêmes chiffres et mêmes textes de la carte montrés aux mêmes heures (± 0,2 s), même durée, même voix,
 * contrôles bloquants passés. Pur : aucune date, aucun hasard.
 */
import type { ResultatMiseEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";

const TOLERANCE_SEC = 0.2;

/** Ce que la ligne montre : texte (ou clé de chiffre) → heures, triées. */
function montres(r: ResultatMiseEnSceneIV): Map<string, number[]> {
  const m = new Map<string, number[]>();
  const poser = (cle: string, t: number) => m.set(cle, [...(m.get(cle) ?? []), t]);
  for (const e of r.ligne.evenements) {
    if (!e.visible) continue;
    for (const c of e.chiffres) poser(`chiffre:${c}`, e.instantSec);
    if (e.texte) poser(`texte:${e.texte}`, e.instantSec);
  }
  for (const c of r.ligne.chiffresDits) poser(`dit:${c.cle}`, c.t);
  for (const v of m.values()) v.sort((a, b) => a - b);
  return m;
}

/** Écarts entre la ligne SANS recette et la ligne AVEC recette (vide = invariants tenus). */
export function invariantsVarieteIV(sans: ResultatMiseEnSceneIV, avec: ResultatMiseEnSceneIV): string[] {
  const ecarts: string[] = [];
  if (sans.ligne.dureeSec !== avec.ligne.dureeSec) ecarts.push(`durée ${sans.ligne.dureeSec} ≠ ${avec.ligne.dureeSec}`);
  if (sans.ligne.finVoixSec !== avec.ligne.finVoixSec) ecarts.push(`fin de la voix ${sans.ligne.finVoixSec} ≠ ${avec.ligne.finVoixSec}`);
  if (JSON.stringify(sans.ligne.sousTitres) !== JSON.stringify(avec.ligne.sousTitres)) ecarts.push("voix (mots des sous-titres) changée");
  const a = montres(sans);
  const b = montres(avec);
  for (const [cle, heures] of a) {
    const autres = b.get(cle) ?? [];
    for (const t of heures) if (!autres.some((u) => Math.abs(u - t) <= TOLERANCE_SEC)) ecarts.push(`${cle} montré à ${t} s n'est plus montré à ± ${TOLERANCE_SEC} s`);
  }
  if (!avec.ok) ecarts.push(...avec.phrases.map((p) => `contrôle : ${p}`));
  return ecarts;
}
