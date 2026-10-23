/**
 * CORBEILLE de 30 jours (décision de Will du 18/10) : « Mettre à la corbeille » ne supprime rien ; la vidéo est
 * `archivee` avec une date `corbeilleLe`, restaurable tant que 30 jours ne sont pas passés, puis supprimée pour de bon
 * (même suppression que « Supprimer définitivement » : dépenses gardées). Une archivée SANS `corbeilleLe` n'est JAMAIS
 * purgée. Mêmes refus que la suppression : fabrication en cours, publication programmée, envoi vers Buffer incertain.
 */
import "server-only";
import { JOURS_CORBEILLE, joursRestants } from "@/domaine/corbeille";
import type { Id, Video } from "@/domaine/types";
import { depots, ErreurStudio, ecrireParametre, filtreExemples, journaliser, lireParametre, maintenant, sousVerrou } from "./_commun";
import { exigerSession } from "./auth";
import { creerNotification } from "./notifications";
import { versCarte } from "./presentation";
import type { VueVideoCarte } from "./vues";

const JOUR_MS = 86_400_000;
const DELAI_MS = JOURS_CORBEILLE * JOUR_MS;
/** La purge tourne au plus une fois par heure, par paquets de 10 vidéos. */
const PASSAGE_MIN_MS = 3_600_000;
const PAQUET = 10;
export const CLE_DERNIER_PASSAGE = "corbeille.dernierPassage";
const dansLaCorbeille = (v: Video) => v.statut === "archivee" && !!v.corbeilleLe;
const echue = (v: Video, maintenantMs: number) => dansLaCorbeille(v) && maintenantMs - Date.parse(v.corbeilleLe!) >= DELAI_MS;
const cleRefus = (id: Id) => `corbeille.refusNotifie.${id}`;

/**
 * `garde` : prédicat optionnel (ex. « toujours non terminée »), appliqué à la lecture ET rejoué SOUS LE VERROU ; une vidéo
 * qui ne le satisfait plus (fabrication terminée entre-temps) n'est pas mise de côté et sa page du site n'est pas retirée.
 */
export async function mettreALaCorbeille(ids: Id[], garde?: (v: Video) => boolean): Promise<{ mises: number; brouillonsBuffer: number; pagesRetirees: number }> {
  await exigerSession();
  const d = depots();
  const { refusSuppression } = await import("./suppression-video");
  const lire = async () => (await Promise.all([...new Set(ids)].map((id) => d.videos.obtenir(id)))).filter((v): v is Video => !!v && !v.corbeilleLe);
  const exiger = (videos: Video[]) => {
    const terminee = garde && videos.find((v) => !garde(v));
    if (terminee) throw new ErreurStudio("VIDEO_TERMINEE", `« ${terminee.titre} » est terminée : on ne l'annule pas. Vous pouvez la mettre à la corbeille depuis Mes vidéos.`);
  };
  const refuser = async (videos: Video[], ignorerSite = false) => {
    for (const v of videos) {
      const refus = await refusSuppression(v, { ignorerSite });
      if (refus) throw new ErreurStudio(refus.code, refus.message);
    }
  };
  // Refus d'abord (rien n'est retiré du site pour une vidéo qui sera refusée), puis la copie du site, puis sous le verrou.
  exiger(await lire());
  await refuser(await lire(), true); // une page en ligne n'est pas un refus ici : elle est retirée juste après, puis revérifiée sous le verrou
  const { retirerAvantSuppression } = await import("./site-videos");
  // Pages du site retirées par cette mise à la corbeille (la restauration ne les remet PAS en ligne : le message le dit).
  const sonSurLeSite = new Set(["en-ligne", "envoi-en-cours", "retrait-en-cours"]);
  const pagesRetirees = (await Promise.all((await lire()).map((v) => d.kits.trouver((k) => k.videoId === v.id)))).filter((k) => !!k?.site && sonSurLeSite.has(k.site.etat)).length;
  await retirerAvantSuppression((await lire()).map((v) => v.id));
  const instant = maintenant();
  const { videos, brouillonsBuffer } = await sousVerrou(async () => {
    const aMettre = await lire();
    exiger(aMettre);
    await refuser(aMettre);
    for (const v of aMettre) {
      await d.videos.modifier(v.id, { statut: "archivee", statutAvantArchive: v.statut === "archivee" ? v.statutAvantArchive : v.statut, corbeilleLe: instant });
    }
    const ensemble = new Set(aMettre.map((v) => v.id));
    const brouillonsBuffer = await d.publications.compter((p) => ensemble.has(p.videoId) && p.via === "buffer" && !!p.idExterne && p.statut === "brouillon");
    return { videos: aMettre, brouillonsBuffer };
  });
  if (videos.length) await journaliser("video", videos.length > 1 ? `${videos.length} vidéos mises à la corbeille` : `Vidéo mise à la corbeille : « ${videos[0].titre} »`, videos.length === 1 ? { type: "video", id: videos[0].id } : undefined);
  return { mises: videos.length, brouillonsBuffer, pagesRetirees };
}

/** Les vidéos des 30 derniers jours, la plus récemment mise de côté d'abord. */
export async function listerCorbeille(): Promise<(VueVideoCarte & { corbeilleLe: string; joursRestants: number })[]> {
  await exigerSession();
  const exemples = await filtreExemples<Video>();
  const liste = await depots().videos.lister((v) => exemples(v) && v.statut === "archivee" && !!v.corbeilleLe);
  liste.sort((a, b) => b.corbeilleLe!.localeCompare(a.corbeilleLe!));
  return Promise.all(liste.map(async (v) => ({ ...(await versCarte(v)), corbeilleLe: v.corbeilleLe!, joursRestants: joursRestants(v.corbeilleLe!) })));
}

/** Rétablit le statut d'avant la mise à la corbeille (comme `desarchiverVideo`) ; le lien privé redevient actif. */
export async function restaurerDeLaCorbeille(ids: Id[]): Promise<{ restaurees: number }> {
  await exigerSession();
  const d = depots();
  // Lecture, contrôle et écriture sous le verrou, comme la purge : une restauration n'est jamais annoncée pour une vidéo
  // que la purge efface au même moment (soit elle passe avant et la garde de la purge laisse la vidéo, soit elle passe après et ne trouve rien).
  const restaurees = await sousVerrou(async () => {
    let n = 0;
    for (const id of new Set(ids)) {
      const v = await d.videos.obtenir(id);
      if (!v || !dansLaCorbeille(v)) continue;
      const statut = v.statutAvantArchive && v.statutAvantArchive !== "archivee" ? v.statutAvantArchive : v.versionChoisieId ? "prete" : "brouillon";
      await d.videos.modifier(id, { statut, statutAvantArchive: undefined, corbeilleLe: undefined });
      await d.parametres.supprimer(cleRefus(id));
      n++;
    }
    return n;
  });
  if (restaurees) await journaliser("video", restaurees > 1 ? `${restaurees} vidéos restaurées de la corbeille` : "1 vidéo restaurée de la corbeille");
  return { restaurees };
}

/** « Supprimer définitivement » depuis la corbeille : seulement des vidéos qui y sont (une autre est ignorée). */
export async function viderCorbeille(ids: Id[]): Promise<{ supprimees: number }> {
  await exigerSession();
  const d = depots();
  const dedans = (await Promise.all([...new Set(ids)].map((id) => d.videos.obtenir(id)))).filter((v): v is Video => !!v && v.statut === "archivee" && !!v.corbeilleLe);
  const { supprimerVideosSansSession } = await import("./videos");
  // Garde sous le verrou : une vidéo restaurée entre la sélection et l'effacement n'est jamais supprimée.
  return supprimerVideosSansSession(dedans.map((v) => v.id), { garde: dansLaCorbeille });
}

/**
 * Purge automatique (boucle de fond, SANS session) : seulement les vidéos AVEC `corbeilleLe` vieux de 30 jours ou plus,
 * par paquets de 10, au plus une fois par heure. Une vidéo refusée (publication programmée…) reste, avec UNE notification.
 */
export async function purgerCorbeille(): Promise<{ supprimees: number; refusees: number; saute?: true }> {
  const d = depots();
  const maintenantMs = Date.now();
  const dernier = Date.parse(await lireParametre<string>(CLE_DERNIER_PASSAGE, ""));
  if (maintenantMs - dernier < PASSAGE_MIN_MS) return { supprimees: 0, refusees: 0, saute: true };
  await ecrireParametre(CLE_DERNIER_PASSAGE, maintenant());
  // Les vidéos déjà refusées (notifiées) passent APRÈS les autres : des refus durables ne bloquent pas la purge du reste.
  const dejaRefusees = new Set<Id>();
  const toutes = await d.videos.lister((v) => echue(v, maintenantMs));
  for (const v of toutes) if (await d.parametres.obtenir(cleRefus(v.id))) dejaRefusees.add(v.id);
  const echues = toutes
    .sort((a, b) => Number(dejaRefusees.has(a.id)) - Number(dejaRefusees.has(b.id)) || a.corbeilleLe!.localeCompare(b.corbeilleLe!))
    .slice(0, PAQUET);
  const { supprimerVideosSansSession } = await import("./videos");
  let supprimees = 0;
  let refusees = 0;
  for (const v of echues) {
    try {
      // Garde rejouée sous le verrou : restaurée entre le choix du paquet et son tour, la vidéo reste.
      const n = (await supprimerVideosSansSession([v.id], { garde: (x) => echue(x, Date.now()) })).supprimees;
      supprimees += n;
      if (n) await d.parametres.supprimer(cleRefus(v.id));
    } catch (e) {
      refusees++;
      const message = e instanceof ErreurStudio ? e.message : "une erreur est survenue";
      if (!(e instanceof ErreurStudio)) console.error("[corbeille] suppression en échec", v.id, e instanceof Error ? e.name : "erreur");
      if (await d.parametres.obtenir(cleRefus(v.id))) continue;
      await ecrireParametre(cleRefus(v.id), maintenant());
      await creerNotification({ type: "info", titre: `« ${v.titre} » reste dans la corbeille`, message: `Elle n'a pas pu être supprimée : ${message}`, lien: `/videos/${v.id}` }).catch(() => undefined);
    }
  }
  return { supprimees, refusees };
}
