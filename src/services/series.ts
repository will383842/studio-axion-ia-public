/**
 * SÉRIES RECONNAISSABLES ET « VOTRE MARQUE » (équipe 7, docs/conception/TIKTOK-SERIES-HASHTAGS.md § 2.3-2.4).
 *
 * - Une série a un nom qui se lit à l'écran (ligne « Série : » de l'encadré d'ouverture) ; un sujet ou une vidéo s'y
 *   rattache et reçoit un numéro d'épisode automatique, jamais réutilisé (`Serie.dernierEpisode`).
 * - La vidéo d'un sujet en série prend la série et l'épisode du sujet (`serieEffective`).
 * - « Cette vidéo met en avant Axion IA » : choix de Will, sinon déduit du texte (`votreMarque`).
 * Aucun appel extérieur.
 */
import "server-only";
import type { CommandeFabrication, Id, Serie, Video } from "@/domaine/types";
import { NOM_SERIE_MAX, NOM_SERIE_MIN, encadreAvecSerie, enteteSerie, prochainEpisode, serieEffective, serieNumerotee } from "@/domaine/series";
import { votreMarque } from "@/domaine/votre-marque";
import { texteScript } from "@/domaine/derivations";
import { themeTientDansEncadre } from "@/briques/composition/encadre";
import { nouvelId } from "@/lib/ids";
import { depots, ErreurStudio, filtreExemples, horodatage, journaliser, sousVerrou } from "./_commun";
import { exigerSession } from "./auth";

export interface VueSerie {
  id: Id;
  nom: string;
  /** Sujets et vidéos rattachés (une vidéo d'un sujet en série n'est comptée qu'une fois, par son sujet). */
  episodes: number;
  dernierEpisode?: number;
}

export interface SerieDeVideo {
  id: Id;
  nom: string;
  episode?: number;
  /** « L'IA qui fait gagner 1 h · ép. 3 » : première ligne du texte envoyé. */
  entete: string;
}

type ResultatNom = { ok: true; nom: string } | { ok: false; message: string };

/** Nom de série : 2 à 40 caractères, sans « : » (il couperait l'encadré), lisible sur sa ligne de l'encadré. */
export function validerNomSerie(brut: string): ResultatNom {
  const nom = String(brut ?? "").replace(/\s+/g, " ").trim();
  if (nom.length < NOM_SERIE_MIN) return { ok: false, message: "Donnez un nom à la série." };
  if (nom.includes(":")) return { ok: false, message: "Sans « : » dans le nom, il couperait le titre à l'écran." };
  if (nom.length > NOM_SERIE_MAX || !themeTientDansEncadre(nom)) return { ok: false, message: "Nom trop long pour tenir à l'écran : raccourcissez-le." };
  return { ok: true, nom };
}

const cle = (nom: string) => nom.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();

/** Séries actives (Écrire › Séries, atelier, kit), les plus récentes d'abord. */
export async function listerSeries(): Promise<VueSerie[]> {
  const d = depots();
  const exemples = await filtreExemples<Serie>();
  const series = await d.series.lister((s) => !s.archiveLe && exemples(s));
  const sujets = await d.scriptsMaitres.lister((m) => !!m.brief.serieId && !m.archiveLe);
  const videos = await d.videos.lister((v) => !!v.serieId && v.statut !== "archivee");
  return series
    .sort((a, b) => b.creeLe.localeCompare(a.creeLe))
    .map((s) => ({
      id: s.id,
      nom: s.nom,
      episodes: sujets.filter((m) => m.brief.serieId === s.id).length + videos.filter((v) => v.serieId === s.id).length,
      ...(s.dernierEpisode ? { dernierEpisode: s.dernierEpisode } : {}),
    }));
}

/** « Nouvelle série » : nom vérifié (lisible à l'écran, pas déjà pris). */
export async function creerSerie(nomSaisi: string): Promise<Serie> {
  await exigerSession();
  const v = validerNomSerie(nomSaisi);
  if (!v.ok) throw new ErreurStudio("NOM_SERIE", v.message);
  return sousVerrou(async () => {
    const d = depots();
    if ((await d.series.lister((s) => !s.archiveLe)).some((s) => cle(s.nom) === cle(v.nom))) throw new ErreurStudio("SERIE_EXISTE", "Cette série existe déjà.");
    const serie = await d.series.enregistrer({ id: nouvelId("serie"), nom: v.nom, formatId: "", ...horodatage() });
    await journaliser("video", `Nouvelle série « ${serie.nom} »`);
    return serie;
  });
}

/** Numéro du prochain épisode d'une série (appelé SOUS le verrou) : le compteur avance, jamais réutilisé. */
async function attribuerEpisode(serieId: Id): Promise<number> {
  const d = depots();
  const serie = await d.series.obtenir(serieId);
  if (!serie || serie.archiveLe) throw new ErreurStudio("SERIE_INCONNUE", "Cette série n'existe plus.");
  const connus = [...(await d.scriptsMaitres.lister((m) => m.brief.serieId === serieId)).map((m) => m.episodeSerie), ...(await d.videos.lister((x) => x.serieId === serieId)).map((x) => x.episodeSerie)];
  const episode = prochainEpisode(serie.dernierEpisode, connus);
  await d.series.modifier(serieId, { dernierEpisode: episode });
  return episode;
}

/**
 * Épisode pris au DÉPART de l'écriture d'un sujet rangé dans une série (appelé SOUS le verrou, par `attribuerNumero`).
 * Une série rangée ou disparue entre-temps n'arrête pas l'écriture : le sujet reste simplement sans épisode.
 */
export async function episodeAuDepart(serieId: Id): Promise<number | undefined> {
  const serie = await depots().series.obtenir(serieId);
  if (!serie || serie.archiveLe) return undefined;
  return attribuerEpisode(serieId);
}

/**
 * Rattache un sujet à une série ou l'en retire (`null`, son numéro n'est pas réutilisé). Un sujet déjà écrit (numéroté)
 * reçoit l'épisode suivant tout de suite ; un sujet pas encore écrit le recevra au départ de son écriture
 * (`episodeAuDepart`) : une idée arrêtée à 0 € ne consomme aucun épisode.
 */
export async function rattacherSujet(sujetId: Id, serieId: Id | null): Promise<{ episode?: number }> {
  await exigerSession();
  return sousVerrou(async () => {
    const d = depots();
    const m = await d.scriptsMaitres.obtenir(sujetId);
    if (!m) throw new ErreurStudio("INTROUVABLE", "Ce sujet n'existe plus.");
    if (!serieId) {
      await d.scriptsMaitres.modifier(sujetId, { brief: { ...m.brief, serieId: undefined }, episodeSerie: undefined });
      return {};
    }
    if (m.brief.serieId === serieId && m.episodeSerie) return { episode: m.episodeSerie };
    if (m.numero === undefined) {
      const serie = await d.series.obtenir(serieId);
      if (!serie || serie.archiveLe) throw new ErreurStudio("SERIE_INCONNUE", "Cette série n'existe plus.");
      await d.scriptsMaitres.modifier(sujetId, { brief: { ...m.brief, serieId }, episodeSerie: undefined });
      return {};
    }
    const episode = await attribuerEpisode(serieId);
    await d.scriptsMaitres.modifier(sujetId, { brief: { ...m.brief, serieId }, episodeSerie: episode });
    return { episode };
  });
}

/** Rattache une vidéo à une série (épisode suivant) ou l'en retire (`null`). */
export async function rattacherVideo(videoId: Id, serieId: Id | null): Promise<{ episode?: number }> {
  await exigerSession();
  return sousVerrou(async () => {
    const d = depots();
    const v = await d.videos.obtenir(videoId);
    if (!v) throw new ErreurStudio("INTROUVABLE", "Cette vidéo n'existe plus.");
    if (!serieId) {
      await d.videos.modifier(videoId, { serieId: undefined, episodeSerie: undefined });
      return {};
    }
    if (v.serieId === serieId && v.episodeSerie) return { episode: v.episodeSerie };
    const episode = await attribuerEpisode(serieId);
    await d.videos.modifier(videoId, { serieId, episodeSerie: episode });
    await journaliser("video", `Vidéo rattachée à une série (ép. ${episode})`, { type: "video", id: videoId });
    return { episode };
  });
}

/** Série d'une vidéo (la sienne, sinon celle du sujet de sa version), avec l'en-tête de description. */
export async function serieDeVideo(video: Id | Video): Promise<SerieDeVideo | null> {
  const d = depots();
  const v = typeof video === "string" ? await d.videos.obtenir(video) : video;
  if (!v) return null;
  const variante = v.varianteId ? await d.variantes.obtenir(v.varianteId) : null;
  const sujet = variante?.scriptMaitreId ? await d.scriptsMaitres.obtenir(variante.scriptMaitreId) : null;
  const eff = serieEffective(v, sujet);
  // `numeroter` : réglage facultatif lu sans toucher au type `Serie` (version 2 : le déclarer dans types.ts).
  const serie: (Serie & { numeroter?: boolean }) | null = eff ? await d.series.obtenir(eff.serieId) : null;
  if (!eff || !serie || serie.archiveLe) return null;
  const numeroter = serieNumerotee(serie);
  return { id: serie.id, nom: serie.nom, ...(eff.episode && numeroter ? { episode: eff.episode } : {}), entete: enteteSerie(serie.nom, eff.episode, numeroter) };
}

/**
 * Commande de fabrication d'une vidéo en série : `encadreTexte` = « Série : accroche ». L'accroche est celle que la
 * composition aurait prise (encadré de la version, sinon texte d'écran « encadré » des plans, sinon le premier) : le
 * dessin ne change pas, la ligne « Thème : » porte le nom de la série. Sans série : la commande telle quelle.
 */
export async function avecSerieALEcran<C extends Pick<CommandeFabrication, "encadreTexte" | "plans">>(video: Video, c: C): Promise<C> {
  const s = await serieDeVideo(video);
  if (!s) return c;
  const actuel = c.encadreTexte?.trim() || (c.plans.find((p) => p.texteEcran?.style === "encadre")?.texteEcran?.texte ?? c.plans[0]?.texteEcran?.texte);
  return { ...c, encadreTexte: encadreAvecSerie(actuel, s.nom) };
}

/* ------------------------------------------------------------------ */
/* « Votre marque »                                                    */
/* ------------------------------------------------------------------ */

/** Texte sur lequel la case est pré-cochée : titre, sujet et texte validé de la vidéo. */
async function texteDeLaVideo(v: Video): Promise<string> {
  const script = v.scriptId ? await depots().scripts.obtenir(v.scriptId) : null;
  return [v.titre, v.sujet ?? "", script ? texteScript(script.blocs) : ""].join("\n");
}

/** État de la case « Cette vidéo met en avant Axion IA » d'une vidéo. */
export async function votreMarqueDeVideo(v: Video): Promise<{ cochee: boolean; auto: boolean }> {
  return votreMarque(v, await texteDeLaVideo(v));
}

/** Will coche ou décoche « Cette vidéo met en avant Axion IA ». */
export async function definirVotreMarque(videoId: Id, valeur: boolean): Promise<void> {
  await exigerSession();
  const d = depots();
  if (!(await d.videos.obtenir(videoId))) throw new ErreurStudio("INTROUVABLE", "Cette vidéo n'existe plus.");
  await d.videos.modifier(videoId, { metEnAvantAxion: valeur === true });
}
