/**
 * ANNULER une vidéo non terminée / NETTOYER les vidéos non terminées (demande de Will du 18/10). Règle de Will : rien de
 * définitif sans corbeille → « Annuler » = METTRE À LA CORBEILLE (`mettreALaCorbeille` : restaurable 30 jours, puis
 * supprimée par la purge). Jamais d'effacement ici. Une vidéo prête n'est jamais annulée ni proposée au nettoyage.
 * Mêmes refus que la corbeille (publication programmée, envoi Buffer incertain) ; une fabrication en cours est arrêtée
 * d'abord (seules les étapes déjà faites sont payées), puis mise de côté.
 */
import "server-only";
import { peutAnnuler } from "@/domaine/corbeille";
import type { Id, Video } from "@/domaine/types";
import { depots, ErreurStudio, filtreExemples } from "./_commun";
import { exigerSession } from "./auth";
import { mettreALaCorbeille } from "./corbeille";
import { annulerTravail } from "./travaux";
import { versCarte } from "./presentation";
import type { VueVideoCarte } from "./vues";

/** Une vidéo non terminée n'est proposée au nettoyage qu'après 24 h : pas de brouillon qu'on est en train d'écrire. */
export const DELAI_NETTOYAGE_MS = 86_400_000;
/** Au plus 50 vidéos par nettoyage (liste et exécution) : un nettoyage reste relisible, on relance pour la suite. */
export const PLAFOND_NETTOYAGE = 50;
const NON_TERMINEES = new Set<Video["statut"]>(["brouillon", "echec", "annulee"]);

/** Non terminée ET sans version finie : une retouche ratée ou arrêtée sur une vidéo finie ne la rend pas nettoyable. */
const aNettoyer = (v: Video, maintenantMs: number) =>
  NON_TERMINEES.has(v.statut) && peutAnnuler(v) && !v.corbeilleLe && maintenantMs - Date.parse(v.modifieLe) >= DELAI_NETTOYAGE_MS;

/**
 * « Annuler cette vidéo » : la met à la corbeille. Pour une fabrication en cours, `travailId` est le travail à arrêter
 * d'abord ; sans lui, la fabrication en cours est refusée (« arrêtez-la d'abord »).
 */
export async function annulerVideo(videoId: Id, options: { travailId?: Id } = {}): Promise<{ mises: number; brouillonsBuffer: number; pagesRetirees: number; centimes: number; refus?: string }> {
  await exigerSession();
  const video = await depots().videos.obtenir(videoId);
  if (!video) throw new ErreurStudio("INTROUVABLE", "Cette vidéo n'existe plus.");
  if (!peutAnnuler(video)) throw new ErreurStudio("VIDEO_TERMINEE", `« ${video.titre} » est terminée : on ne l'annule pas. Vous pouvez la mettre à la corbeille depuis Mes vidéos.`);
  let centimes = 0;
  if (options.travailId) {
    const travail = await depots().travaux.obtenir(options.travailId);
    if (!travail || travail.cibleId !== videoId) throw new ErreurStudio("INTROUVABLE", "Cette fabrication ne correspond pas à cette vidéo.");
    // Les refus de la corbeille (publication programmée, versions en attente…) tombent AVANT l'arrêt : on n'arrête (et ne paie) rien pour un refus connu d'avance.
    const { refusSuppression } = await import("./suppression-video");
    const refus = await refusSuppression(video, { ignorerSite: true, ignorerFabrication: true });
    if (refus) throw new ErreurStudio(refus.code, refus.message);
    centimes = (await annulerTravail(options.travailId))?.depense.centimes ?? 0;
  }
  try {
    // Garde rejouée sous le verrou de la corbeille : une fabrication terminée pendant l'arrêt n'est pas mise de côté.
    const r = await mettreALaCorbeille([videoId], peutAnnuler);
    return { ...r, centimes };
  } catch (e) {
    // Fabrication déjà arrêtée (étapes payées) : on dit ce qui s'est passé au lieu d'une simple erreur.
    if (options.travailId && e instanceof ErreurStudio) return { mises: 0, brouillonsBuffer: 0, pagesRetirees: 0, centimes, refus: e.message };
    throw e;
  }
}

/** Les vidéos que « Nettoyer » propose : brouillons, échecs, annulées de plus de 24 h. Ne change rien. */
export async function listerANettoyer(): Promise<VueVideoCarte[]> {
  await exigerSession();
  const exemples = await filtreExemples<Video>();
  const maintenantMs = Date.now();
  const liste = await depots().videos.lister((v) => exemples(v) && aNettoyer(v, maintenantMs));
  liste.sort((a, b) => a.modifieLe.localeCompare(b.modifieLe));
  return Promise.all(liste.slice(0, PLAFOND_NETTOYAGE).map(versCarte));
}

/**
 * Met à la corbeille les vidéos cochées. Chaque id est relu : une vidéo prête, en fabrication, trop récente ou déjà à la
 * corbeille est IGNORÉE. Une vidéo refusée (publication programmée…) reste, les autres partent.
 */
export async function nettoyerVideos(ids: Id[]): Promise<{ mises: number; refusees: number; ignorees: number; brouillonsBuffer: number; pagesRetirees: number; messages: string[] }> {
  await exigerSession();
  const d = depots();
  const maintenantMs = Date.now();
  const lues = (await Promise.all([...new Set(ids)].map((id) => d.videos.obtenir(id)))).filter((v): v is Video => !!v);
  const eligibles = lues.filter((v) => aNettoyer(v, maintenantMs)).slice(0, PLAFOND_NETTOYAGE);
  let mises = 0;
  let refusees = 0;
  let brouillonsBuffer = 0;
  let pagesRetirees = 0;
  let tardives = 0;
  const messages: string[] = [];
  for (const v of eligibles) {
    try {
      // Garde rejouée sous le verrou : devenue prête (ou retouchée) entre la relecture et la corbeille, la vidéo est ignorée.
      const r = await mettreALaCorbeille([v.id], (x) => aNettoyer(x, maintenantMs));
      mises += r.mises;
      brouillonsBuffer += r.brouillonsBuffer;
      pagesRetirees += r.pagesRetirees;
    } catch (e) {
      if (!(e instanceof ErreurStudio)) throw e;
      if (e.code === "VIDEO_TERMINEE") tardives++;
      else {
        refusees++;
        if (!messages.includes(e.message)) messages.push(e.message);
      }
    }
  }
  return { mises, refusees, ignorees: new Set(ids).size - eligibles.length + tardives, brouillonsBuffer, pagesRetirees, messages };
}
