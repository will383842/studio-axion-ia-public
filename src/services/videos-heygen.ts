/**
 * MA VIDÉO HEYGEN (lot R7, décision de Will du 03/10). Will fait ses vidéos avec son double DANS L'APPLICATION
 * HEYGEN. Le studio :
 *  1. lit les vidéos récentes du compte (titre, date, durée, aperçu) — lecture gratuite ;
 *  2. télécharge celle que Will choisit dans le stockage du studio et la range comme une PRISE de la version
 *     (même chemin que « Filmer ici ») : « Monter ma prise » fait ensuite la finition (calage sur le texte validé,
 *     son, sous-titres, miniature) ;
 *  3. secours : si la vidéo n'apparaît pas, Will dépose le fichier téléchargé depuis HeyGen (envoi par morceaux
 *     existant) et il est rangé de la même façon.
 * Aucun appel payant, aucune génération. Rien n'est effacé : une vidéo rattachée deux fois ne crée rien de plus.
 *
 * Corrections de la relecture sécurité (`3042b94`) :
 *  - le téléchargement passe par `fournisseurs/heygen/telechargement.ts` (hôtes HeyGen seulement, redirections
 *    revalidées, IP non publiques refusées, taille annoncée et plafonnée, octets comptés) — n° 1 et 2 ;
 *  - avant de ranger, les premiers octets de l'objet STOCKÉ sont relus : seule une vidéo MP4/MOV (`ftyp`) ou
 *    Matroska/WebM est rangée ; sinon refus, rien n'est rangé (et la copie HeyGen est effacée) — n° 3 ;
 *  - secours : le fichier doit être « prêt » (dépôt confirmé par le stockage) — n° 4 ;
 *  - la taille confirmée par le stockage est comparée à celle relayée et au plafond — n° 5 ;
 *  - une vidéo HeyGen est RÉSERVÉE avant d'être téléchargée, et « déjà rattachée » est revérifié sous le verrou au
 *    moment de ranger : deux clics ne font qu'une prise ; un échec après la copie efface l'objet stocké — n° 6.
 *
 * Corrections de la relecture exactitude (`3042b94`) :
 *  - « déjà rattachée » décidé sur la version relue sous le verrou, et complété si la prise brute existe sans sa
 *    prise dans la vidéo (arrêt du serveur entre deux écritures) — n° 3 et 4 ;
 *  - une vidéo bien plus longue que le texte de la version est refusée avant tout téléchargement — n° 5 ;
 *  - seule une version « Je lis » reçoit une vidéo HeyGen — n° 8.
 */
import "server-only";
import type { Fichier, Id, Rush, VarianteReseau } from "@/domaine/types";
import { ErreurHeygen } from "@/fournisseurs/heygen/client";
import { videosHeygen } from "@/fournisseurs/heygen/inscription";
import type { VideoDuCompte } from "@/fournisseurs/heygen/videos-compte";
import type { StockageFichiers } from "@/fournisseurs/types";
import { nouvelId } from "@/lib/ids";
import { OCTETS_SIGNATURE, signatureVideo } from "@/lib/signature-video";
import { depots, ErreurStudio, fournisseur, horodatage, journaliser, sousVerrou } from "./_commun";
import { exigerSession } from "./auth";
import type { PrisesVideo } from "./tournage";
import { ajouterPriseAVideo, rangerPriseDeVersion } from "./tournage";

export interface VideoHeygenAffichee extends VideoDuCompte {
  /** Code de la version à laquelle elle est déjà rattachée. */
  rattacheeA?: string;
}

/** Mot-clé de la prise brute qui garde l'identifiant HeyGen (une vidéo n'est jamais rattachée deux fois). */
const motCle = (idExterne: string) => `heygen:${idExterne}`;

/** Les vidéos récentes du compte HeyGen. `branche: false` : aucune clé HeyGen sur le serveur (dépôt manuel seul). */
export async function listerVideosHeygen(): Promise<{ branche: boolean; videos: VideoHeygenAffichee[] }> {
  await exigerSession();
  const acces = videosHeygen();
  if (!acces) return { branche: false, videos: [] };
  const videos = await acces.lister(30);
  const d = depots();
  const sortie: VideoHeygenAffichee[] = [];
  for (const v of videos) {
    const rush = await d.rushs.trouver((r) => r.motsCles.includes(motCle(v.idExterne)));
    sortie.push({ ...v, ...(rush ? { rattacheeA: rush.motsCles[0] } : {}) });
  }
  return { branche: true, videos: sortie };
}

async function versionRattachable(varianteId: Id): Promise<VarianteReseau> {
  const v = await depots().variantes.obtenir(varianteId);
  if (!v || v.archiveLe) throw new ErreurStudio("INTROUVABLE", "Cette version n'existe plus.");
  if (v.etat !== "validee") throw new ErreurStudio("VERSION_A_VALIDER", "Validez d'abord le texte de cette version.");
  // Relecture exactitude (`3042b94`, n° 8) : la vidéo HeyGen est lue sur le texte validé, comme une prise « je lis ».
  if (!v.prompteur) throw new ErreurStudio("PAS_JE_LIS", "Une vidéo HeyGen se rattache seulement à une version « Je lis ».");
  if (v.videoId) {
    const video = await depots().videos.obtenir(v.videoId);
    // Comme une prise filmée : une version déjà fabriquée garde sa vidéo.
    if (video && video.statut !== "brouillon") throw new ErreurStudio("DEJA_FABRIQUEE", "Cette version a déjà sa vidéo.");
  }
  return v;
}

/** Vidéos HeyGen en cours de téléchargement (réservées sous le verrou) : un second clic n'en relance pas une autre. */
const cleReservations = Symbol.for("studio-axion-ia.r7.reservations-heygen");
function reservations(): Set<string> {
  const g = globalThis as typeof globalThis & { [cleReservations]?: Set<string> };
  return (g[cleReservations] ??= new Set());
}

/** Relecture exactitude (`3042b94`, n° 5) : au-delà, ce n'est sans doute pas la vidéo de ce texte. */
const dureeMaxSec = (v: VarianteReseau) => Math.max(180, 3 * (v.dureeEstimeeSec || 0));
function exigerDureePlausible(v: VarianteReseau, dureeSec: number | undefined): void {
  if (dureeSec && dureeSec > dureeMaxSec(v)) throw new ErreurStudio("VIDEO_TROP_LONGUE", "Cette vidéo est bien plus longue que le texte de cette version. Vérifiez que c'est la bonne.");
}

/**
 * Déjà rattachée, décidé SOUS LE VERROU sur la version RELUE (n° 3) : à cette version, son résultat — en complétant
 * le rangement si la prise brute existe sans sa prise dans la vidéo (arrêt du serveur entre les deux écritures,
 * n° 4) ; à une autre version, refus. Aucune : null.
 */
async function resultatSiDeja(varianteId: Id, deja: Rush | null): Promise<{ videoId: Id; nom: string } | null> {
  if (!deja) return null;
  const d = depots();
  const v = await d.variantes.obtenir(varianteId);
  if (!v || deja.motsCles[0] !== v.code) throw new ErreurStudio("DEJA_RATTACHEE", `Cette vidéo est déjà rattachée à la version ${deja.motsCles[0]}.`);
  const video = v.videoId ? await d.videos.obtenir(v.videoId) : null;
  if (video && ((video.entrees as Partial<PrisesVideo>).prises ?? []).some((p) => p.rushId === deja.id)) return { videoId: video.id, nom: deja.nom };
  const videoId = await ajouterPriseAVideo(v, deja);
  await journaliser("tournage", `Vidéo HeyGen rattachée (rangement complété) : ${deja.nom}`, { type: "video", id: videoId });
  return { videoId, nom: deja.nom };
}

/**
 * Range le fichier comme prise de la version, SOUS LE VERROU : « déjà rattachée » y est revérifié (`deja`), et le
 * fichier n'est enregistré (`nouveau`) qu'à ce moment-là — un échec avant ne laisse aucune fiche.
 */
async function ranger(varianteId: Id, fichier: Fichier, dureeSec: number, motsCles: string[], o: { deja: (r: Rush) => boolean; nouveau: boolean }): Promise<{ videoId: Id; nom: string }> {
  return sousVerrou(async () => {
    const d = depots();
    const v = await versionRattachable(varianteId);
    const existant = await resultatSiDeja(v.id, await d.rushs.trouver(o.deja));
    if (existant) return existant;
    if (o.nouveau) await d.fichiers.enregistrer(fichier);
    const video = v.videoId ? await d.videos.obtenir(v.videoId) : null;
    const numero = ((video?.entrees as Partial<PrisesVideo> | undefined)?.prises?.length ?? 0) + 1;
    const { rush, videoId } = await rangerPriseDeVersion(v, fichier, { numero, dureeSec, motsCles });
    await journaliser("tournage", `Vidéo HeyGen rattachée : ${rush.nom}`, { type: "video", id: videoId });
    return { videoId, nom: rush.nom };
  });
}

/** n° 3 : les premiers octets de l'objet STOCKÉ doivent être ceux d'une vidéo (MP4/MOV ou Matroska/WebM). */
async function estUneVideo(stockage: StockageFichiers, cleStockage: string): Promise<boolean> {
  // Stockage simulé : aucun octet n'existe (rien n'est envoyé) ; un stockage réel DOIT savoir relire.
  if (!stockage.lireDebut) return stockage.mode !== "reel";
  let debut: Uint8Array;
  try {
    debut = await stockage.lireDebut(cleStockage, OCTETS_SIGNATURE);
  } catch {
    throw new ErreurStudio("RELECTURE", "La vidéo gardée n'a pas pu être relue. Réessayez dans un instant.");
  }
  return signatureVideo(debut) !== null;
}

/** Efface la copie qui ne sera pas gardée (sans masquer l'erreur d'origine). */
async function effacer(stockage: StockageFichiers, cleStockage: string): Promise<void> {
  try {
    await stockage.supprimer?.(cleStockage);
  } catch (e) {
    console.error("[r7] copie HeyGen non effacée", cleStockage, e);
  }
}

/**
 * « Rattacher à cette version » : la vidéo terminée est RÉSERVÉE, relue chez HeyGen (adresse de téléchargement
 * fraîche), copiée dans le stockage du studio (gardes du téléchargement), vérifiée (taille, premiers octets), puis
 * rangée comme prise de la version. Gratuit. Déjà rattachée : rien de plus.
 */
export async function rattacherVideoHeygen(varianteId: Id, idExterne: string): Promise<{ videoId: Id; nom: string }> {
  await exigerSession();
  const d = depots();
  const v = await versionRattachable(varianteId);
  const memeVideo = (r: Rush) => r.motsCles.includes(motCle(idExterne));

  // n° 6 : « déjà rattachée » lu SOUS LE VERROU (jamais un état à moitié rangé), puis réservation AVANT tout
  // téléchargement (deux clics, deux onglets : un seul téléchargement, une seule prise).
  const deja = await sousVerrou(async () => {
    const encore = await resultatSiDeja(v.id, await d.rushs.trouver(memeVideo));
    if (encore) return encore;
    if (reservations().has(idExterne)) throw new ErreurStudio("EN_COURS", "Cette vidéo est déjà en train d'arriver : patientez un instant.");
    reservations().add(idExterne);
    return null;
  });
  if (deja) return deja;

  try {
    const acces = videosHeygen();
    if (!acces) throw new ErreurStudio("HEYGEN_NON_RELIE", "HeyGen n'est pas relié au serveur : déposez le fichier téléchargé depuis HeyGen.");
    const lue = await acces.lire(idExterne);
    if (!lue.terminee || !lue.adresse) throw new ErreurStudio("VIDEO_PAS_PRETE", lue.raison ?? "HeyGen termine encore cette vidéo : revenez dans un moment.");
    exigerDureePlausible(v, lue.dureeSec);
    const stockage = await fournisseur("stockage");
    const fichierId = nouvelId("f");
    const { cleStockage } = await stockage.preparerDepot({ fichierId, nom: `${v.code}-heygen.mp4`, mime: "video/mp4", taille: 0, typeEntite: "rush", entiteId: v.id });
    const depot = stockage.urlDepotDuree ? await stockage.urlDepotDuree(cleStockage, 3600, "video/mp4") : "";
    if (!/^https?:\/\//.test(depot)) throw new ErreurStudio("STOCKAGE_NON_RELIE", "Le stockage des fichiers n'est pas relié : la vidéo ne peut pas être gardée. Vérifiez Réglages > Connexions.");
    // Téléchargement HORS verrou (plusieurs minutes possibles) ; rien n'est rangé tant qu'il n'a pas réussi.
    let taille: number;
    try {
      taille = await acces.copier(lue.adresse, depot, "video/mp4");
    } catch (e) {
      await effacer(stockage, cleStockage);
      if (e instanceof ErreurHeygen) throw new ErreurStudio("TELECHARGEMENT", e.message);
      throw e;
    }
    try {
      // n° 5 : la taille confirmée par le stockage = celle relayée, sous le plafond.
      const confirmation = await stockage.confirmerDepot(cleStockage);
      if (!confirmation.ok || (confirmation.taille !== undefined && (confirmation.taille !== taille || confirmation.taille > acces.plafond))) throw new ErreurStudio("TELECHARGEMENT", "La vidéo HeyGen est arrivée incomplète : réessayez.");
      // n° 3 : un fichier qui n'est pas une vidéo n'est jamais rangé.
      if (!(await estUneVideo(stockage, cleStockage))) throw new ErreurStudio("PAS_UNE_VIDEO", "Ce fichier n'est pas une vidéo lisible : il n'est pas gardé.");
      const fichier: Fichier = { id: fichierId, cleStockage, nom: `${lue.titre.slice(0, 120)}.mp4`, mime: "video/mp4", taille, ...(lue.dureeSec ? { dureeSec: lue.dureeSec } : {}), origine: "fournisseur", statut: "pret", ...horodatage() };
      const r = await ranger(v.id, fichier, lue.dureeSec ?? 0, [motCle(idExterne), "heygen"], { deja: memeVideo, nouveau: true });
      // Rangée entre-temps par un autre chemin : cette copie-ci n'est pas gardée.
      if (!(await d.fichiers.obtenir(fichierId))) await effacer(stockage, cleStockage);
      return r;
    } catch (e) {
      await effacer(stockage, cleStockage);
      throw e;
    }
  } finally {
    reservations().delete(idExterne);
  }
}

/** Secours : le fichier téléchargé depuis HeyGen, déposé par Will (envoi par morceaux), rangé comme prise de la version. */
export async function rattacherFichierHeygen(varianteId: Id, fichierId: Id): Promise<{ videoId: Id; nom: string }> {
  await exigerSession();
  const v = await versionRattachable(varianteId);
  const f = await depots().fichiers.obtenir(fichierId);
  // Seule une vidéo envoyée pour CETTE version, et bien arrivée (n° 4), est acceptée.
  if (!f || !f.mime.startsWith("video/") || !f.cleStockage.includes(`/rush/${v.id}/`)) throw new ErreurStudio("FICHIER", "Cette vidéo est introuvable : envoyez-la à nouveau.");
  if (f.statut !== "pret") throw new ErreurStudio("FICHIER_PAS_PRET", "Cette vidéo n'est pas encore bien arrivée : envoyez-la à nouveau.");
  const memeFichier = (r: Rush) => r.fichierId === f.id;
  const deja = await sousVerrou(async () => resultatSiDeja(v.id, await depots().rushs.trouver(memeFichier)));
  if (deja) return deja;
  exigerDureePlausible(v, f.dureeSec);
  // n° 3 : le type déclaré par le navigateur ne compte pas, seuls les premiers octets du fichier stocké comptent.
  if (!(await estUneVideo(await fournisseur("stockage"), f.cleStockage))) throw new ErreurStudio("PAS_UNE_VIDEO", "Ce fichier n'est pas une vidéo lisible : déposez la vidéo téléchargée depuis HeyGen.");
  return ranger(v.id, f, f.dureeSec ?? 0, ["heygen"], { deja: memeFichier, nouveau: false });
}
