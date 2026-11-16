/**
 * G11-07 : graphe FFmpeg PUR d'un extrait (b-roll) posé sur une plage du master.
 * Aucun import du Studio, aucun lancement de processus, aucun branchement : l'appelant décide quoi faire de la chaîne.
 * Le son du master est recopié tel quel (carte `0:a`) : aucun mélange de sons, aucun son neuf.
 * Jamais sur un visage : une plage qui chevauche une transition de visage est refusée.
 */

export interface EntreeBrollPlage {
  /** `dureeSec` facultatif : si donné, la plage ne peut pas le dépasser. */
  master: { largeur: number; hauteur: number; fps: number; dureeSec?: number };
  /** `entree` : indice de l'entrée FFmpeg de l'extrait (≥ 1 ; 0 est le master). */
  extrait: { entree: number; debutSec: number; finSec: number };
  plage: { debutSec: number; finSec: number };
  transitionsVisage: { debutSec: number; finSec: number }[];
}

export type GrapheBrollPlage = { ok: true; filtre: string; cartes: string[] } | { ok: false; raison: string };

const refus = (raison: string): GrapheBrollPlage => ({ ok: false, raison });
const fini = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** Nombre court et stable (3 décimales au plus, sans zéros inutiles). */
function nb(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

export function grapheBrollPlage(e: EntreeBrollPlage): GrapheBrollPlage {
  const { master, extrait, plage, transitionsVisage } = e;
  if (![master.largeur, master.hauteur, master.fps].every((v) => fini(v) && v > 0)) return refus("master invalide (largeur, hauteur, fps)");
  if (!Number.isInteger(extrait.entree) || extrait.entree < 1) return refus("entrée de l'extrait invalide (entier ≥ 1)");
  if (![extrait.debutSec, extrait.finSec, plage.debutSec, plage.finSec].every(fini)) return refus("durées non finies");
  if (plage.debutSec < 0 || plage.finSec <= plage.debutSec) return refus("plage invalide (début < fin, début ≥ 0)");
  if (extrait.debutSec < 0 || extrait.finSec <= extrait.debutSec) return refus("extrait invalide (début < fin, début ≥ 0)");
  if (master.dureeSec !== undefined && (!fini(master.dureeSec) || plage.finSec > master.dureeSec)) return refus("plage hors de la durée du master");
  const dureePlage = plage.finSec - plage.debutSec;
  if (extrait.finSec - extrait.debutSec < dureePlage - 1e-9) return refus("extrait trop court pour la plage");
  for (const t of transitionsVisage) {
    if (!fini(t.debutSec) || !fini(t.finSec)) return refus("transition de visage non finie");
    if (t.debutSec < plage.finSec && plage.debutSec < t.finSec) return refus("la plage chevauche une transition de visage");
  }

  const a = nb(plage.debutSec);
  const b = nb(plage.finSec);
  const id = `${extrait.entree}_${Math.round(plage.debutSec * 1000)}`;
  const brut = `vb${id}`;
  const sortie = `vo${id}`;
  const { largeur: w, hauteur: h, fps } = master;
  const filtre =
    `[${extrait.entree}:v]trim=start=${nb(extrait.debutSec)}:end=${nb(extrait.debutSec + dureePlage)},setpts=PTS-STARTPTS+${a}/TB,` +
    `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},fps=${nb(fps)},setsar=1[${brut}]` +
    `;[0:v][${brut}]overlay=enable='between(t,${a},${b})':eof_action=pass[${sortie}]`;
  return { ok: true, filtre, cartes: [`[${sortie}]`, "0:a"] };
}
