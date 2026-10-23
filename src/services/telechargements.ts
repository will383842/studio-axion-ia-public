/**
 * TÉLÉCHARGEMENT GROUPÉ (plan v5 B.6.10, lot G1b) : « Tout le sujet » → `0042-<titre-court>.zip` ; « Par réseau » →
 * `TikTok-<date-début>-<date-fin>.zip` (publications programmées de la période). Un fichier par ratio exporté, nommé par
 * `nomFichier()` ; sous-titres même racine (.srt, .vtt), tirés de la forme affichée. Archive « stockée » (`lib/zip.ts`).
 */
import "server-only";
import { exporterSrt, exporterVtt } from "@/briques/sous-titres";
import { nomFichier, numeroSur4, titreCourt, versionsCourantes } from "@/domaine/derivations-generateur";
import { texteScript } from "@/domaine/derivations";
import type { Id, ReseauDeclinaison, SegmentSousTitres, Video } from "@/domaine/types";
import { creerZip } from "@/lib/zip";
import { obtenirReseau } from "@/reseaux";
import { depots, ErreurStudio } from "./_commun";
import { exigerSession } from "./auth";
import { sousTitresDepuisTexte, sousTitresUtilisables } from "./telechargements-sous-titres";
import { obtenirVideo } from "./videos";

/** Une entrée de l'archive : une adresse à lire (vidéo) ou un contenu déjà prêt (sous-titres). */
export type EntreeArchive = { nom: string; url: string } | { nom: string; contenu: string };

export interface ContenuArchive {
  nom: string;
  entrees: EntreeArchive[];
}

/** Rang du test d'accroche d'une vidéo (`-A2`, `-A3`…) parmi les vidéos « variante-accroche » de la même version. */
function rangAccroche(video: Video, soeurs: Video[]): number | undefined {
  if (video.typeDerive !== "variante-accroche") return undefined;
  const tests = soeurs.filter((v) => v.varianteId === video.varianteId && v.typeDerive === "variante-accroche").sort((a, b) => a.creeLe.localeCompare(b.creeLe));
  return tests.findIndex((v) => v.id === video.id) + 2;
}

/**
 * Sous-titres du zip : ceux de la vidéo s'ils existent ; sinon (fabrication simulée, moteur qui n'en pose pas) ceux tirés
 * du texte affiché de la vidéo, répartis sur sa durée (vérification E2E n° 1, problème n° 6 : .srt vides).
 */
export async function sousTitresDeLaVideo(video: Video, aligne: SegmentSousTitres[] | undefined, sorties: { dureeSec?: number }[]): Promise<SegmentSousTitres[]> {
  if (sousTitresUtilisables(aligne)) return aligne;
  const script = video.scriptId ? await depots().scripts.obtenir(video.scriptId) : null;
  if (!script) return [];
  const duree = Math.max(0, ...sorties.map((s) => s.dureeSec ?? 0)) || video.dureeCibleSec;
  return sousTitresDepuisTexte(texteScript(script.blocs), duree);
}

async function entreesVideo(video: Video, code: string, titre: string, version: number, soeurs: Video[]): Promise<EntreeArchive[]> {
  const detail = await obtenirVideo(video.id);
  if (!detail) return [];
  const essai = rangAccroche(video, soeurs);
  const entrees: EntreeArchive[] = detail.sorties
    .filter((s) => !!s.url)
    .map((s) => ({ nom: nomFichier({ code, titre, ratio: s.ratio, extension: "mp4", essaiAccroche: essai, version }), url: s.url }));
  const segments = await sousTitresDeLaVideo(video, detail.sousTitres?.segments, detail.sorties);
  if (segments.length) {
    entrees.push({ nom: nomFichier({ code, titre, extension: "srt", essaiAccroche: essai, version }), contenu: exporterSrt(segments) });
    entrees.push({ nom: nomFichier({ code, titre, extension: "vtt", essaiAccroche: essai, version }), contenu: exporterVtt(segments) });
  }
  return entrees;
}

/** « Tout le sujet » : chaque version courante qui a une vidéo, tous ratios, sous-titres compris. */
export async function contenuArchiveSujet(scriptMaitreId: Id): Promise<ContenuArchive> {
  await exigerSession();
  const d = depots();
  const m = await d.scriptsMaitres.obtenir(scriptMaitreId);
  if (!m) throw new ErreurStudio("INTROUVABLE", "Ce sujet n'existe plus.");
  if (m.numero === undefined) throw new ErreurStudio("SANS_NUMERO", "Ce sujet n'a pas encore de numéro.");
  const titre = m.angle?.titre ?? m.brief.idee;
  const variantes = versionsCourantes(await d.variantes.lister((v) => v.scriptMaitreId === m.id));
  const ids = new Set(variantes.map((v) => v.id));
  const videos = await d.videos.lister((v) => !!v.varianteId && ids.has(v.varianteId) && v.statut !== "archivee");
  const entrees: EntreeArchive[] = [];
  for (const v of variantes) for (const video of videos.filter((x) => x.varianteId === v.id)) entrees.push(...(await entreesVideo(video, v.code, titre, v.version, videos)));
  return { nom: `${numeroSur4(m.numero)}-${titreCourt(titre)}.zip`, entrees };
}

/** Lundi et dimanche de la semaine d'une date (AAAA-MM-JJ), en UTC. */
export function cetteSemaine(maintenant = new Date()): { debut: string; fin: string } {
  const d = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate()));
  const decalage = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - decalage);
  const debut = d.toISOString().slice(0, 10);
  d.setUTCDate(d.getUTCDate() + 6);
  return { debut, fin: d.toISOString().slice(0, 10) };
}

/** « Par réseau » : les vidéos des publications programmées sur ce réseau entre deux jours (bornes comprises). */
export async function contenuArchiveReseau(reseau: ReseauDeclinaison, debut: string, fin: string): Promise<ContenuArchive> {
  await exigerSession();
  const d = depots();
  const pubs = await d.publications.lister((p) => p.reseau === reseau && p.statut === "programmee" && p.via !== "simulation" && p.date.slice(0, 10) >= debut && p.date.slice(0, 10) <= fin);
  const videoIds = [...new Set(pubs.map((p) => p.videoId))];
  const videos = (await Promise.all(videoIds.map((id) => d.videos.obtenir(id)))).filter((v): v is Video => !!v && v.statut !== "archivee");
  const entrees: EntreeArchive[] = [];
  for (const video of videos) {
    const v = video.varianteId ? await d.variantes.obtenir(video.varianteId) : null;
    const m = v ? await d.scriptsMaitres.obtenir(v.scriptMaitreId) : null;
    const code = v?.code ?? `video-${video.id}`;
    entrees.push(...(await entreesVideo(video, code, m?.angle?.titre ?? m?.brief.idee ?? video.titre, v?.version ?? 1, videos)));
  }
  return { nom: `${obtenirReseau(reseau).nom.replace(/\s+/g, "")}-${debut}-${fin}.zip`, entrees };
}

/** Lit chaque entrée (`lire` : lecture d'une adresse, injectée par la route ou les tests) et construit l'archive. */
export async function construireArchive(contenu: ContenuArchive, lire: (url: string) => Promise<Uint8Array>): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const fichiers = [];
  for (const e of contenu.entrees) fichiers.push({ nom: e.nom, donnees: "contenu" in e ? enc.encode(e.contenu) : await lire(e.url) });
  return creerZip(fichiers);
}
