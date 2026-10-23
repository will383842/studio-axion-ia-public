/**
 * MOTION DE SCHÉMA · lisibilité (plan § 5, B3 ; Q15). PUR.
 *
 * Taille EFFECTIVE d'un texte = taille sur la toile × zoom de la caméra. Elle doit rester ≥ plancher de la charte
 * (`TAILLE_PLANCHER_DUO`, fraction de la hauteur) à chaque instant où le texte est à l'écran. Les tailles de la toile
 * sont donc choisies pour tenir le plancher au zoom le plus faible (0,8) ; la scène « Ensemble » ne porte aucun texte à
 * lire (pastilles, chiffres-clés de 3 mots au plus).
 */
import { TAILLE_PLANCHER_DUO } from "../habillage/charte-duo";
import { BORNES_CAMERA, boiteALEcran, cameraA } from "./camera";
import { ECRAN_IV, type DispositionEnsemble, type DispositionToile, type TrajectoireCamera } from "./types";

export const PLANCHER_IV = TAILLE_PLANCHER_DUO;

/** Taille du libellé d'un nœud sur la toile (Anton), au-dessus du plancher même à zoom 0,8. */
export const TAILLE_LIBELLE_IV = 0.04;
/** Taille du détail d'un nœud (Inter Bold) : exactement le plancher au zoom le plus faible. */
export const TAILLE_DETAIL_IV = TAILLE_PLANCHER_DUO / BORNES_CAMERA.zoomMin;

/** Plus long texte permis dans la scène « Ensemble ». */
export const MOTS_MAX_ENSEMBLE = 3;

export function tailleEffective(taille: number, zoom: number): number {
  return taille * zoom;
}

export function nombreDeMots(texte: string): number {
  return texte.trim().split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;
}

export type DefautLisibilite = { t: number; noeud: string; texte: string; tailleEffective: number };

/**
 * Contrôle, instant par instant (pas en secondes), que tout texte d'une boîte visible à l'écran garde sa taille effective
 * au-dessus du plancher. Une boîte compte comme visible dès qu'elle touche l'écran.
 */
export function controlerLisibiliteToile(toile: DispositionToile, traj: Pick<TrajectoireCamera, "images">, pas = 1 / 25): DefautLisibilite[] {
  const defauts: DefautLisibilite[] = [];
  const fin = traj.images.length ? traj.images[traj.images.length - 1].t : 0;
  for (let k = 0; k * pas <= fin + 1e-9; k++) {
    const t = Math.round(k * pas * 1000) / 1000;
    const pose = cameraA(traj, t);
    for (const b of toile.boites) {
      const e = boiteALEcran(b, pose);
      const visible = e.x < ECRAN_IV.largeur && e.x + e.largeur > 0 && e.y < ECRAN_IV.hauteur && e.y + e.hauteur > 0;
      if (!visible) continue;
      for (const tx of b.textes) {
        const eff = tailleEffective(tx.taille, pose.zoom);
        if (eff < PLANCHER_IV - 1e-9) defauts.push({ t, noeud: b.id, texte: tx.texte, tailleEffective: eff });
      }
    }
  }
  return defauts;
}

/** Textes de la scène « Ensemble » trop longs (> 3 mots) ou sous le plancher. */
export function controlerEnsemble(e: DispositionEnsemble): string[] {
  const defauts: string[] = [];
  for (const c of e.chiffresCles) {
    if (nombreDeMots(c.texte) > MOTS_MAX_ENSEMBLE) defauts.push(`« ${c.texte} » : plus de ${MOTS_MAX_ENSEMBLE} mots.`);
    if (c.taille < PLANCHER_IV - 1e-9) defauts.push(`« ${c.texte} » : sous le plancher.`);
  }
  for (const p of e.pastilles) {
    if (!p.numero) continue;
    if (nombreDeMots(p.numero.texte) > MOTS_MAX_ENSEMBLE) defauts.push(`Pastille ${p.id} : plus de ${MOTS_MAX_ENSEMBLE} mots.`);
    if (p.numero.taille < PLANCHER_IV - 1e-9) defauts.push(`Pastille ${p.id} : numéro sous le plancher.`);
  }
  return defauts;
}
