/**
 * Opération `recollage-plages` (T-EXT-52c-a-v20h, conception CONCEPTION-T-EXT-52c-OPERATION.md § 1). Recolle, SANS réencoder
 * l'image (`-c copy`), des tronçons du fichier d'avant (coupés à des images clés) et des morceaux MUETS neufs, puis pose la voix.
 * Opération sœur de `collage-chapitres` (qu'elle n'appelle pas : seulement ses fonctions pures `argumentsPoseVoix`).
 *
 *  1 télécharger ; 2 `ffprobe` de `avant` et de chaque morceau ; 3 `verifierRecollable` ; 4 images clés de `avant` (`-skip_frame nokey`)
 *  et contrôle des bornes ; 5 liste `ffconcat` avec `inpoint`/`outpoint` ; 6 `-f concat -c copy -an` ; 7 `controleRecollage` ; 8 pose de la voix.
 * Chaque refus : `ErreurRendu({code:"refuse", reessayable:false})`, message en français (l'appelant retombe sur « rendu entier »).
 *
 * Paramètres : `segments` (ordonnés : `{source:"avant",debutSec,finSec}` | `{source:"plage",entree,dureeSec}`), `avant`, `voix?`, `dureeSec`.
 * NON déclarée (ni `contrat.ts`, ni `types.ts`, ni `index.ts`) : aucune demande ne peut l'appeler. Aucun import payant, 0 €.
 */
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { ErreurRendu, type Operation } from "../contrat.js";
import { deposer, executer, FFMPEG, FFPROBE, telecharger } from "../outils.js";
import { argumentsRecollage, controleRecollage, planDecoupe, verifierRecollable, type MesureImages } from "../composition/recollage.js";
import type { SondeFfprobe } from "../composition/empreinte-encodage.js";
import { argumentsPoseVoix } from "./collage-chapitres.js";

export type SegmentAvant = { source: "avant"; debutSec: number; finSec: number };
export type SegmentPlage = { source: "plage"; entree: string; dureeSec: number };
export type SegmentRecollage = SegmentAvant | SegmentPlage;
export interface ParametresRecollage {
  segments: SegmentRecollage[];
  avant: string;
  voix?: string;
  dureeSec: number;
}

const refuser = (message: string): never => {
  throw new ErreurRendu({ code: "refuse", reessayable: false, message });
};
const nombre = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const nomValide = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const EPS = 1e-6;

/** Lit et contrôle les paramètres (PUR) : segments sans trou ni recouvrement, durées > 0, entrées nommées. */
export function lireParametresRecollage(p: Record<string, unknown>): ParametresRecollage {
  if (!nomValide(p.avant)) return refuser("Fichier d'avant manquant ou invalide.");
  if (p.voix !== undefined && !nomValide(p.voix)) return refuser("Nom de voix invalide.");
  if (!nombre(p.dureeSec) || p.dureeSec <= 0) return refuser("Durée du recollage invalide (elle doit être supérieure à 0).");
  if (!Array.isArray(p.segments) || !p.segments.length) return refuser("Aucun segment à recoller.");
  const segments: SegmentRecollage[] = [];
  let derniereFinAvant: number | undefined; // fin du dernier tronçon « avant », tant qu'aucune plage ne s'est intercalée
  const noms = new Set<string>();
  for (const [i, brut] of p.segments.entries()) {
    const s = (brut ?? {}) as Record<string, unknown>;
    const n = `Segment ${i + 1}`;
    if (s.source === "avant") {
      if (!nombre(s.debutSec) || !nombre(s.finSec)) return refuser(`${n} : bornes illisibles.`);
      if (s.debutSec < 0 || s.finSec - s.debutSec <= EPS) return refuser(`${n} : durée nulle ou négative (${s.debutSec} à ${s.finSec} s).`);
      if (derniereFinAvant !== undefined) {
        if (s.debutSec < derniereFinAvant - EPS) return refuser(`${n} : recouvrement avec le tronçon précédent (${s.debutSec} s < ${derniereFinAvant} s).`);
        if (s.debutSec > derniereFinAvant + EPS) return refuser(`${n} : trou entre deux tronçons d'avant (${derniereFinAvant} s à ${s.debutSec} s) sans morceau neuf.`);
      }
      derniereFinAvant = s.finSec;
      segments.push({ source: "avant", debutSec: s.debutSec, finSec: s.finSec });
    } else if (s.source === "plage") {
      if (!nomValide(s.entree)) return refuser(`${n} : entrée du morceau manquante.`);
      if (!nombre(s.dureeSec) || s.dureeSec <= 0) return refuser(`${n} : durée nulle ou négative.`);
      if (s.entree === p.avant || s.entree === p.voix) return refuser(`${n} : l'entrée « ${s.entree} » ne peut pas servir deux fois.`);
      if (noms.has(s.entree)) return refuser(`${n} : le morceau « ${s.entree} » est cité deux fois.`);
      noms.add(s.entree);
      derniereFinAvant = undefined;
      segments.push({ source: "plage", entree: s.entree, dureeSec: s.dureeSec });
    } else return refuser(`${n} : source inconnue.`);
  }
  if (typeof p.voix === "string" && p.voix === p.avant) return refuser("La voix ne peut pas être le fichier d'avant.");
  return { segments, avant: p.avant, ...(typeof p.voix === "string" ? { voix: p.voix } : {}), dureeSec: p.dureeSec };
}

const cite = (c: string) => `file '${c.replace(/'/g, "'\\''")}'`;

/** Liste `ffconcat` (PUR) : `inpoint`/`outpoint` pour les tronçons « avant », `file` seul pour les morceaux. `chemins` : nom d'entrée → fichier. */
export function listeConcatPlages(segments: SegmentRecollage[], chemins: { avant: string; plages: Record<string, string> }): string {
  const l = ["ffconcat version 1.0"];
  for (const s of segments) {
    if (s.source === "avant") l.push(cite(chemins.avant), `inpoint ${s.debutSec.toFixed(6)}`, `outpoint ${s.finSec.toFixed(6)}`);
    else l.push(cite(chemins.plages[s.entree] ?? refuser(`Entrée « ${s.entree} » manquante.`)));
  }
  return l.join("\n") + "\n";
}

/** Refus (message de `planDecoupe`) si une borne d'un tronçon « avant » ne tombe pas sur une image clé (PUR). Renvoie les segments. */
export function bornesSurImagesCles(segments: SegmentRecollage[], clesSec: number[]): SegmentRecollage[] {
  const surCle = (t: number) => clesSec.some((c) => Math.abs(c - t) < 1e-3);
  for (const s of segments) {
    if (s.source !== "avant") continue;
    const plan = planDecoupe(clesSec, { debutSec: s.debutSec, finSec: s.finSec });
    if (!plan.ok) return refuser(`Tronçon ${s.debutSec} à ${s.finSec} s refusé : ${plan.raison}.`);
    if (!surCle(s.debutSec)) return refuser(`La borne de début ${s.debutSec} s n'est pas une image clé (la plus proche : ${plan.debutSec} s).`);
    if (!surCle(s.finSec)) return refuser(`La borne de fin ${s.finSec} s n'est pas une image clé (la plus proche : ${plan.finSec} s).`);
  }
  return segments;
}

const sonder = async (fichier: string, signal: AbortSignal): Promise<SondeFfprobe> =>
  JSON.parse(await executer(FFPROBE, ["-v", "error", "-show_streams", "-show_format", "-of", "json", fichier], signal)) as SondeFfprobe;
const nombres = (t: string) => t.split(/\r?\n/).map((x) => x.split(",")[0].trim()).filter(Boolean).map(Number).filter(Number.isFinite);

async function imagesCles(fichier: string, signal: AbortSignal): Promise<number[]> {
  return nombres(await executer(FFPROBE, ["-v", "error", "-select_streams", "v:0", "-skip_frame", "nokey", "-show_entries", "frame=pts_time", "-of", "csv=p=0", fichier], signal));
}
async function mesurer(fichier: string, signal: AbortSignal): Promise<MesureImages> {
  const temps = nombres(await executer(FFPROBE, ["-v", "error", "-select_streams", "v:0", "-show_entries", "packet=pts_time", "-of", "csv=p=0", fichier], signal));
  return { images: temps.length, tempsSec: temps };
}
/** Nombre d'images du fichier d'avant dont l'instant tombe dans [début ; fin[ du tronçon (PUR). */
export const imagesDans = (tempsSec: number[], s: SegmentAvant): number => tempsSec.filter((t) => t >= s.debutSec - 1e-3 && t < s.finSec - 1e-3).length;
const nbImages = async (fichier: string, signal: AbortSignal) =>
  Number((await executer(FFPROBE, ["-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", fichier], signal)).trim());

export const recollagePlages: Operation = async (demande, contexte) => {
  const p = lireParametresRecollage(demande.parametres);
  const noms = [p.avant, ...p.segments.flatMap((s) => (s.source === "plage" ? [s.entree] : [])), ...(p.voix ? [p.voix] : [])];
  const fichiers: Record<string, string> = {};
  for (const [i, nom] of noms.entries()) {
    const url = demande.entrees[nom];
    if (!url) return refuser(`Entrée « ${nom} » manquante.`);
    fichiers[nom] = join(contexte.dossier, nom === p.voix ? "voix" : nom === p.avant ? "avant.mp4" : `morceau-${i}.mp4`);
    await telecharger(url, fichiers[nom], contexte.signal);
  }
  contexte.progression(20);
  const sondeAvant = await sonder(fichiers[p.avant], contexte.signal);
  const plages = p.segments.filter((s): s is SegmentPlage => s.source === "plage");
  for (const m of plages) {
    const v = verifierRecollable(sondeAvant, await sonder(fichiers[m.entree], contexte.signal));
    if (!v.ok) return refuser(`Le morceau « ${m.entree} » ne se recolle pas au fichier d'avant : ${v.raisons.join(" ; ")}.`);
  }
  // La fin du fichier d'avant compte comme une borne permise (le dernier tronçon peut aller jusqu'au bout).
  const dureeAvant = Number(sondeAvant.format?.duration);
  bornesSurImagesCles(p.segments, [...(await imagesCles(fichiers[p.avant], contexte.signal)), ...(Number.isFinite(dureeAvant) ? [dureeAvant] : [])]);
  contexte.progression(40);
  const liste = join(contexte.dossier, "liste-plages.txt");
  await writeFile(liste, listeConcatPlages(p.segments, { avant: fichiers[p.avant], plages: Object.fromEntries(plages.map((m) => [m.entree, fichiers[m.entree]])) }));
  const muette = join(contexte.dossier, "recolle-muet.mp4");
  await executer(FFMPEG, ["-v", "error", "-y", ...argumentsRecollage(liste, muette)], contexte.signal);
  contexte.progression(70);
  const tempsAvant = (await mesurer(fichiers[p.avant], contexte.signal)).tempsSec;
  let attendu = 0;
  for (const s of p.segments) {
    attendu += s.source === "plage" ? await nbImages(fichiers[s.entree], contexte.signal) : imagesDans(tempsAvant, s);
  }
  const apres = await mesurer(muette, contexte.signal);
  const verdict = controleRecollage({ images: attendu, tempsSec: [] }, apres);
  if (!verdict.ok) return refuser(`Recollage refusé : ${verdict.raisons.join(" ; ")}.`);
  let final = muette;
  if (p.voix) {
    final = join(contexte.dossier, "recollage-plages.mp4");
    await executer(FFMPEG, argumentsPoseVoix(muette, fichiers[p.voix], final), contexte.signal);
  }
  contexte.progression(90);
  await deposer(demande.sortie.urlDepot, final, "video/mp4", contexte.signal);
  contexte.progression(100);
  return { mesures: { segments: p.segments.length, plages: plages.length, voix: p.voix ? 1 : 0, dureeSec: p.dureeSec } };
};
