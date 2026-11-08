/**
 * TÉLÉCHARGEMENT GROUPÉ (plan v5 B.6.10, lot G1b) : « Tout le sujet » → `0042-<titre-court>.zip` ; « Par réseau » →
 * `TikTok-<date-début>-<date-fin>.zip` (publications programmées de la période). Un fichier par ratio exporté, nommé par
 * `nomFichier()` ; sous-titres même racine (.srt, .vtt), tirés de la forme affichée. Archive « stockée » (`lib/zip.ts`).
 */
import "server-only";
import { exporterSrt, exporterVtt } from "@/briques/sous-titres";
import { nomFichier, numeroSur4, titreCourt, versionsCourantes } from "@/domaine/derivations-generateur";
import { texteScript } from "@/domaine/derivations";
import { type Id, type IdReseau, type ReseauDeclinaison, type SegmentSousTitres, type Video, videoIdSure } from "@/domaine/types";
import { reseauxDeLaVideo } from "@/domaine/reseaux-video";
import { creerZip } from "@/lib/zip";
import { obtenirReseau } from "@/reseaux";
import { meilleureSortie } from "@/reseaux/sorties";
import { depots, ErreurStudio, filtreExemples, fournisseur, lireParametre, maintenant } from "./_commun";
import { exigerSession } from "./auth";
import { sousTitresDepuisTexte, sousTitresUtilisables } from "./telechargements-sous-titres";
import { nomTelechargement } from "./telechargement-video";
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
  const videoIds = [...new Set(pubs.map((p) => videoIdSure(p)).filter((id): id is string => !!id))];
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

/* ------------------------------------------------------------------ */
/* Vidéos validées (lot V)                                              */
/* ------------------------------------------------------------------ */

const objet = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const cleValide = (c: unknown): c is string => typeof c === "string" && c.length > 0;

/** Livraison image → vidéo de la version choisie (lue avec prudence), ou null si la vidéo n'en a pas. */
async function livraisonDe(video: Video): Promise<Record<string, unknown>[] | null> {
  const version = video.versionChoisieId ? await depots().versions.obtenir(video.versionChoisieId) : null;
  const l = objet(version?.projetMontage?.imageVideo)?.livraison;
  if (!Array.isArray(l) || !l.length) return null;
  return l.map(objet).filter((x): x is Record<string, unknown> => !!x);
}

/**
 * Réseau(x) d'une vidéo telle qu'elle est enregistrée (rien n'est stocké en plus) et « téléchargement seul » : une
 * vidéo image → vidéo n'est jamais envoyée d'ici, le fichier enregistré est le 9:16 commun.
 */
export async function reseauxDeVideoStockee(video: Video, parDefaut: readonly IdReseau[]): Promise<{ reseaux: IdReseau[]; precis: boolean; telechargementSeul: boolean }> {
  const d = depots();
  const livraison = await livraisonDe(video);
  const sorties = video.versionChoisieId ? await d.sorties.lister((s) => s.versionId === video.versionChoisieId) : [];
  const { reseaux, precis } = reseauxDeLaVideo({
    reseau: video.reseau,
    entreesIV: objet(video.entrees?.imageVideo)?.reseaux,
    livraisonIV: livraison ?? undefined,
    sortiesReseaux: sorties.map((s) => s.reseaux),
    parDefaut,
  });
  return { reseaux, precis, telechargementSeul: !!livraison || !!video.entrees?.imageVideo };
}

/** Adresse lisible d'une clé de stockage (comme `urlFichier`, mais depuis la clé). */
async function urlDeCle(cle: string): Promise<string | null> {
  return ((await (await fournisseur("stockage")).urlLecture(cle)) as string | null) || null;
}

/**
 * Zip « Tout télécharger » d'un réseau : les vidéos validées de ce réseau, rien d'autre (ni programmées, ni à relire,
 * ni corbeille, ni exemples). Par vidéo : le fichier du réseau (livraison image → vidéo, plus le fil pour Facebook, sinon la
 * meilleure sortie), le texte déjà enregistré (jamais écrit pour l'occasion) et les sous-titres s'ils existent.
 */
export async function contenuArchiveValidees(reseau: IdReseau): Promise<ContenuArchive> {
  await exigerSession();
  const d = depots();
  const exemples = await filtreExemples<{ estDemo?: boolean }>();
  const parDefaut = await lireParametre<IdReseau[]>("reseaux.parDefaut", ["linkedin", "instagram", "tiktok", "youtube-shorts"]);
  const validees = await d.videos.lister((v) => exemples(v) && v.statut === "prete" && !v.corbeilleLe && v.etapeEditoriale === "validee");
  const entrees: EntreeArchive[] = [];
  const pris = new Set<string>();
  const poser = (nom: string, e: { url: string } | { contenu: string }) => {
    let final = nom;
    for (let i = 2; pris.has(final); i++) final = nom.replace(/(\.[A-Za-z0-9]+)$/, `-${i}$1`);
    pris.add(final);
    entrees.push({ nom: final, ...e });
  };
  for (const video of validees) {
    if (!(await reseauxDeVideoStockee(video, parDefaut)).reseaux.includes(reseau)) continue;
    const base = nomTelechargement(video.titre, reseau).replace(/\.mp4$/, "");
    const livraison = await livraisonDe(video);
    const sorties = video.versionChoisieId ? await d.sorties.lister((s) => s.versionId === video.versionChoisieId) : [];
    let trouve = false;
    if (livraison) {
      const ligne = livraison.find((l) => l.reseau === reseau && l.version !== "aucune" && cleValide(l.fichierCle));
      const url = ligne ? await urlDeCle(ligne.fichierCle as string) : null;
      if (ligne && url) {
        poser(`${base}.mp4`, { url });
        trouve = true;
        const fil = reseau === "facebook" && cleValide(ligne.fichierCleFil) ? await urlDeCle(ligne.fichierCleFil) : null;
        if (fil) poser(`${base}-fil.mp4`, { url: fil });
      }
    } else {
      const choisie = meilleureSortie(reseau, sorties) ?? sorties[0] ?? null;
      const fichier = choisie ? await d.fichiers.obtenir(choisie.fichierId) : null;
      const url = fichier?.cleStockage ? await urlDeCle(fichier.cleStockage) : null;
      if (choisie && url) {
        poser(`${nomTelechargement(video.titre, reseau, choisie.ratio)}`, { url });
        trouve = true;
      }
    }
    if (!trouve) continue;
    // Texte déjà enregistré (jamais généré ici) : lu dans le kit, tel quel.
    const kit = await d.kits.trouver((k) => k.videoId === video.id);
    const t = kit?.textes[reseau];
    if (t?.texte) poser(`${base}.txt`, { contenu: [t.titre, t.texte, t.motsDiese.join(" ")].filter(Boolean).join("\n\n") + "\n" });
    const detail = await obtenirVideo(video.id);
    if (sousTitresUtilisables(detail?.sousTitres?.segments)) poser(`${base}.srt`, { contenu: exporterSrt(detail!.sousTitres!.segments) });
  }
  if (!entrees.length) throw new ErreurStudio("RIEN_A_TELECHARGER", "Aucune vidéo validée pour ce réseau.");
  return { nom: `${obtenirReseau(reseau).nom.replace(/\s+/g, "")}-validees-${maintenant().slice(0, 10)}.zip`, entrees };
}
