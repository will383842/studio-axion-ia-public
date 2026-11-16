/**
 * Recollage aux images clés (G11-02) : fonctions PURES, NON BRANCHÉES (le branchement attend la mesure G13-09).
 * Aucun `spawn`, aucun accès disque, aucun import `@/…`. Ne change rien tant que personne ne les appelle.
 */
import { recollable, type SondeFfprobe } from "./empreinte-encodage";

export type Plage = { debutSec: number; finSec: number };
export type PlanDecoupe = { ok: true; debutSec: number; finSec: number } | { ok: false; raison: string };
export type Morceau = { chemin: string; dureeSec: number };
export type MesureImages = { images: number; tempsSec: number[] };
export type Verdict = { ok: boolean; raisons: string[] };

/** Bornes arrondies aux images clés qui entourent la plage : début à la clé ≤ début, fin à la clé ≥ fin. */
export function planDecoupe(clesSec: number[], plage: Plage): PlanDecoupe {
  const { debutSec, finSec } = plage;
  if (!Number.isFinite(debutSec) || !Number.isFinite(finSec) || finSec < debutSec)
    return { ok: false, raison: "plage invalide (la fin précède le début)" };
  const cles = clesSec.filter(Number.isFinite);
  const avant = cles.filter((c) => c <= debutSec);
  const apres = cles.filter((c) => c >= finSec);
  if (!avant.length) return { ok: false, raison: `aucune image clé à ${debutSec} s ou avant` };
  if (!apres.length) return { ok: false, raison: `aucune image clé à ${finSec} s ou après` };
  return { ok: true, debutSec: Math.max(...avant), finSec: Math.min(...apres) };
}

/** Texte du fichier `concat` FFmpeg ; l'apostrophe d'un chemin s'écrit `'\''`. */
export function listeConcat(morceaux: Morceau[]): string {
  const lignes = ["ffconcat version 1.0"];
  for (const m of morceaux) lignes.push(`file '${m.chemin.replace(/'/g, "'\\''")}'`, `duration ${m.dureeSec.toFixed(6)}`);
  return lignes.join("\n") + "\n";
}

/** Arguments FFmpeg : copie sans réencodage, vidéo seule (le son se pose une fois à part). */
export function argumentsRecollage(liste: string, sortie: string): string[] {
  return ["-f", "concat", "-safe", "0", "-i", liste, "-c", "copy", "-an", sortie];
}

/** Même nombre d'images avant/après, temps strictement croissants ; refus lisible sinon. */
export function controleRecollage(avant: MesureImages, apres: MesureImages): Verdict {
  const raisons: string[] = [];
  if (avant.images !== apres.images)
    raisons.push(`nombre d'images différent : ${avant.images} avant, ${apres.images} après`);
  for (let i = 1; i < apres.tempsSec.length; i++)
    if (!(apres.tempsSec[i] > apres.tempsSec[i - 1])) {
      raisons.push(`temps non croissant à l'image ${i} (${apres.tempsSec[i - 1]} puis ${apres.tempsSec[i]} s)`);
      break;
    }
  return { ok: raisons.length === 0, raisons };
}

/** À appeler avant tout recollage : refus si `recollable` dit non, raisons reprises. */
export function verifierRecollable(a: SondeFfprobe, b: SondeFfprobe): Verdict {
  const r = recollable(a, b);
  return r.recollable ? { ok: true, raisons: [] } : { ok: false, raisons: r.raisons };
}
