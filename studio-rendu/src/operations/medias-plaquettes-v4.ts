/**
 * Vidéos d'illustration des plaquettes v4 côté SERVICE DE RENDU (18/10/2026) — PUR (aucun import de Remotion).
 *
 * Cause du plantage de la vidéo v-60359dd080b1 : une plaquette à vidéo (AvantApres, MosaiqueVideos, duel-video) arrivait sans `medias` ;
 * le rendu demandait alors `…/broll/` SANS nom de fichier (404) et mourait à 99 %. Maintenant :
 *  1. le studio envoie chaque vidéo d'illustration en entrée signée « broll:<nom> » (`v4-<rang>-<k>.mp4`) ; `telechargerVideosIllustrationV4`
 *     les range dans le dossier servi, sous leur nom, avant `preparerMediasV4` ; un ancien studio qui n'en envoie pas reste compris ;
 *  2. un plan dont une plaquette à vidéo n'a pas ses médias est REFUSÉ tout de suite (`controlerMediasPlaquettesV4`, avant de télécharger la
 *     prise), puis une seconde fois quand le dossier servi est prêt (le fichier doit y être), avec une phrase qui cite la plaquette et l'instant.
 * La table des plaquettes à vidéo reprend `videos[0]` des fiches du catalogue v4 du studio (un test la compare à ce catalogue).
 */
import { join } from "node:path";
import { ErreurRendu } from "../contrat.js";

/** Plaquettes qui montrent des vidéos, avec le nombre MINIMUM exigé (`videos[0]` de leur fiche dans `catalogue-v4.ts` du studio). */
export const PLAQUETTES_A_VIDEO_V4: Readonly<Record<string, number>> = Object.freeze({ AvantApres: 1, MosaiqueVideos: 4, "duel-video": 2 });

/** Préfixe des entrées de la demande de rendu qui portent une vidéo d'illustration. */
export const PREFIXE_ENTREE_BROLL_V4 = "broll:";
/** Nom d'une vidéo d'illustration : `v4-` (jamais un nom du dossier de b-roll maison), pas de dossier, `.mp4` seulement. */
const NOM_VIDEO_ILLUSTRATION = /^v4-[A-Za-z0-9_-]+\.mp4$/;

interface ElementMedias {
  id?: unknown;
  debut?: unknown;
  medias?: unknown;
}

const refus = (message: string) => new ErreurRendu({ code: "refuse", reessayable: false, message });
const instant = (x: unknown) => `${(Number.isFinite(x) ? (x as number) : 0).toFixed(1).replace(".", ",")} s`;
/** Nom de fichier d'une clé de média du plan (« broll/v4-0-0.mp4 » → « v4-0-0.mp4 »). */
export const nomDeMedia = (cle: string) => cle.replace(/^broll\//, "");

/**
 * Chaque plaquette à vidéo a ses médias : non vides, au nombre exigé et, si `presents` est donné, servis dans le dossier du rendu.
 * Lève un refus NON réessayable, en français simple, qui cite la plaquette et l'instant. PUR.
 */
export function controlerMediasPlaquettesV4(elements: readonly unknown[], presents?: ReadonlySet<string>): void {
  for (const brut of elements) {
    const e = brut as ElementMedias;
    const id = typeof e?.id === "string" ? e.id : "";
    const minimum = PLAQUETTES_A_VIDEO_V4[id];
    if (minimum === undefined) continue;
    const quoi = `la plaquette « ${id} » à ${instant(e.debut)}`;
    const medias = Array.isArray(e.medias) ? e.medias : [];
    const cles = medias.filter((m): m is string => typeof m === "string" && m.trim() !== "");
    if (!cles.length || cles.length !== medias.length) throw refus(`Montage refusé : ${quoi} n'a pas sa vidéo d'illustration. Rien n'a été monté : refaites la vidéo.`);
    if (cles.length < minimum) throw refus(`Montage refusé : ${quoi} n'a que ${cles.length} vidéo(s) sur ${minimum} au minimum. Rien n'a été monté : refaites la vidéo.`);
    if (presents) {
      const absente = cles.find((c) => !presents.has(nomDeMedia(c)));
      if (absente) throw refus(`Montage refusé : la vidéo « ${nomDeMedia(absente)} » de ${quoi} n'est pas arrivée au service de montage. Refaites la vidéo.`);
    }
  }
}

/**
 * Range les vidéos d'illustration de la demande (entrées « broll:<nom> ») dans `dossier`, sous leur nom. Rend leur nombre.
 * Les autres entrées sont ignorées. Un nom hors du modèle `v4-….mp4` est refusé (aucune sortie du dossier, aucun doublon avec le b-roll maison).
 */
export async function telechargerVideosIllustrationV4(entrees: Readonly<Record<string, string>>, dossier: string, telecharger: (url: string, fichier: string) => Promise<void>): Promise<number> {
  const aTelecharger: { nom: string; url: string }[] = [];
  for (const [cle, url] of Object.entries(entrees)) {
    if (!cle.startsWith(PREFIXE_ENTREE_BROLL_V4)) continue;
    const nom = cle.slice(PREFIXE_ENTREE_BROLL_V4.length);
    if (!NOM_VIDEO_ILLUSTRATION.test(nom)) throw refus(`Montage refusé : le nom de vidéo d'illustration « ${nom.slice(0, 60)} » n'est pas valide.`);
    aTelecharger.push({ nom, url });
  }
  for (const v of aTelecharger) await telecharger(v.url, join(dossier, v.nom));
  return aTelecharger.length;
}
