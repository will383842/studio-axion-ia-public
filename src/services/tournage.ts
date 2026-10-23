/**
 * SÉANCE DE TOURNAGE ET « ENREGISTRER ICI » (plan v5 B.6 n° 15-16, B.4.7 ; lot G4c).
 *
 * - Versions à filmer : versions courantes VALIDÉES, « je lis » (texte du téléprompteur) ou « j'improvise » (trame),
 *   sans vidéo.
 * - Une séance enchaîne N versions dans un ordre groupé par format (même tenue, même décor).
 * - Chaque prise filmée (caméra avant du téléphone, ou déposée depuis un autre appareil) devient un fichier, une prise
 *   brute (`Rush`) nommée sous son code (« 0042-AV-TT-L · prise 1 ») et la vidéo de la version, RANGÉE AUTOMATIQUEMENT
 *   par `rangerVideo` : aucun geste de classement.
 * - « Prise ratée, on recommence » : la prise reste (marquée ratée, rien n'est effacé) et la version revient « à refaire » ;
 *   la prise suivante s'ajoute à la MÊME vidéo (une version, au plus une vidéo).
 */
import "server-only";
import { assemblerBlocs, versionsCourantes } from "@/domaine/derivations-generateur";
export type { VersionDeSeance } from "@/domaine/tournage";
import { etatSeance, etatVersionSeance, nombrePrises, nomPrise, ordonnerSeance, phrasesPrompteur, prochaineVersion, type VersionDeSeance, type VersionTournable } from "@/domaine/tournage";
import type { Fichier, Id, Rush, Script, ScriptMaitre, SessionTournage, VarianteReseau, Video } from "@/domaine/types";
import { scriptFacultatif } from "@/domaine/facecam-script";
import { formatGenerateur, nomCourtFormat, trouverFormat } from "@/formats";
import { nouvelId } from "@/lib/ids";
import { exigerSession } from "./auth";
import { depots, ErreurStudio, filtreExemples, horodatage, journaliser, maintenant, sousVerrou } from "./_commun";
import { rangerVideo } from "./generateur";

/** Au plus 12 versions par séance (une matinée de tournage). */
export const VERSIONS_MAX_SEANCE = 12;

/** Ce que la vidéo d'une version filmée garde de ses prises (dans `Video.entrees`). */
export interface PrisesVideo {
  origine: "tournage";
  /**
   * G6b (ajout pur) : `partie` d'une prise — toute la version (défaut), ou le corps commun, le début, la fin d'un
   * réseau (assemblés au montage : 1 corps + le début et la fin de chaque réseau).
   */
  prises: { rushId: Id; fichierId: Id; dureeSec: number; le: string; ratee?: boolean; partie?: "version" | "corps" | "debut" | "fin" }[];
  priseRetenueId?: Id;
}

function modeTournable(v: VarianteReseau): VersionTournable["mode"] | null {
  if (v.prompteur?.trim()) return "teleprompteur";
  // Script facultatif (18/10) : une vidéo déjà filmée sans texte (prompteur vide) reste à envoyer, sans rien à lire.
  if (v.prompteur === "" && scriptFacultatif(v.formatId)) return "teleprompteur";
  if (v.trame) return "trame";
  return null;
}

function debitJeLis(formatId: string): number {
  try {
    return formatGenerateur(formatId).recette.debitParMode.teleprompteur;
  } catch {
    return 2.9;
  }
}

async function versionTournable(v: VarianteReseau, maitres?: Map<Id, { numero?: number; titre: string }>): Promise<VersionTournable | null> {
  const mode = modeTournable(v);
  if (!mode) return null;
  let m = maitres?.get(v.scriptMaitreId);
  if (!m) {
    const x = await depots().scriptsMaitres.obtenir(v.scriptMaitreId);
    m = { numero: x?.numero, titre: x?.angle?.titre ?? x?.brief.idee ?? v.code };
  }
  const f = trouverFormat(v.formatId);
  const duree = mode === "teleprompteur" ? Math.round(phrasesPrompteur(v.prompteur!, debitJeLis(v.formatId)).dureeSec) : Math.round(v.dureeEstimeeSec);
  return { id: v.id, code: v.code, scriptMaitreId: v.scriptMaitreId, numero: m.numero, titre: m.titre, formatId: v.formatId, formatNom: f ? nomCourtFormat(f) : v.formatId, reseau: v.reseau, mode, dureeSec: duree };
}

/** Versions prêtes à filmer : validées, « je lis » ou « j'improvise », sans vidéo, la plus récente d'abord. */
export async function listerVersionsATourner(): Promise<VersionTournable[]> {
  await exigerSession();
  const d = depots();
  const ex = await filtreExemples<ScriptMaitre>();
  const maitres = await d.scriptsMaitres.lister((m) => ex(m) && !m.archiveLe && m.numero !== undefined);
  const parId = new Map(maitres.map((m) => [m.id, { numero: m.numero, titre: m.angle?.titre ?? m.brief.idee }]));
  const vs = versionsCourantes(await d.variantes.lister((v) => parId.has(v.scriptMaitreId))).filter((v) => v.etat === "validee" && !v.videoId && modeTournable(v));
  const res = (await Promise.all(vs.map((v) => versionTournable(v, parId)))).filter((x): x is VersionTournable => !!x);
  return res.sort((a, b) => (b.numero ?? 0) - (a.numero ?? 0) || a.code.localeCompare(b.code));
}

/** Crée une séance : ordre de passage groupé par format. */
export async function creerSeance(varianteIds: Id[]): Promise<SessionTournage> {
  await exigerSession();
  const ids = [...new Set(varianteIds)];
  if (!ids.length) throw new ErreurStudio("SEANCE_VIDE", "Choisissez au moins une version.");
  if (ids.length > VERSIONS_MAX_SEANCE) throw new ErreurStudio("SEANCE_TROP_LONGUE", `${VERSIONS_MAX_SEANCE} versions au plus par séance.`);
  const d = depots();
  const versions: VersionTournable[] = [];
  for (const id of ids) {
    const v = await d.variantes.obtenir(id);
    if (!v || v.archiveLe) throw new ErreurStudio("INTROUVABLE", "Une de ces versions n'existe plus.");
    const t = await versionTournable(v);
    if (!t) throw new ErreurStudio("PAS_A_FILMER", `La version ${v.code} n'est pas à filmer.`);
    versions.push(t);
  }
  const groupes = ordonnerSeance(versions);
  const s: SessionTournage = { id: nouvelId("seance"), varianteIds: groupes.flatMap((g) => g.varianteIds), groupes, prises: [], etat: "preparee", ...horodatage() };
  await d.sessionsTournage.enregistrer(s);
  await journaliser("tournage", `Séance de tournage préparée (${s.varianteIds.length} version${s.varianteIds.length > 1 ? "s" : ""})`, { type: "seance", id: s.id });
  return s;
}

/** Séances non archivées, la plus récente d'abord. */
export async function listerSeances(): Promise<SessionTournage[]> {
  await exigerSession();
  return (await depots().sessionsTournage.lister((s) => !s.archiveLe)).sort((a, b) => b.creeLe.localeCompare(a.creeLe));
}

export interface VueSeance {
  seance: SessionTournage;
  groupes: { libelle: string; versions: VersionDeSeance[] }[];
  prochaineId: Id | null;
}

export async function vueSeance(id: Id): Promise<VueSeance | null> {
  await exigerSession();
  const d = depots();
  const s = await d.sessionsTournage.obtenir(id);
  if (!s || s.archiveLe) return null;
  const parId = new Map<Id, VersionDeSeance>();
  for (const vid of s.varianteIds) {
    const v = await d.variantes.obtenir(vid);
    if (!v) continue;
    const t = await versionTournable(v);
    if (!t) continue;
    parId.set(vid, { ...t, etat: etatVersionSeance(s.prises, vid), prises: nombrePrises(s.prises, vid), prompteur: v.prompteur, trame: v.trame, debit: debitJeLis(v.formatId) });
  }
  const groupes = (s.groupes?.length ? s.groupes : [{ libelle: "", varianteIds: s.varianteIds }]).map((g) => ({ libelle: g.libelle, versions: g.varianteIds.map((x) => parId.get(x)).filter((x): x is VersionDeSeance => !!x) }));
  return { seance: s, groupes, prochaineId: prochaineVersion(s) };
}

/**
 * Range une prise filmée (ou déposée) sous le code de sa version, SANS geste de classement : prise brute nommée
 * « code · prise n », vidéo de la version créée à la première prise puis rangée (`rangerVideo`). Rejouer la même prise
 * (même fichier) ne crée rien de plus.
 */
export async function enregistrerPrise(demande: { seanceId: Id; varianteId: Id; fichierId: Id; dureeSec: number; partie?: "version" | "corps" | "debut" | "fin" }): Promise<{ rushId: Id; videoId: Id; nom: string; suivanteId: Id | null }> {
  await exigerSession();
  return sousVerrou(async () => {
    const d = depots();
    const s = await d.sessionsTournage.obtenir(demande.seanceId);
    if (!s || s.archiveLe) throw new ErreurStudio("INTROUVABLE", "Cette séance n'existe plus.");
    if (!s.varianteIds.includes(demande.varianteId)) throw new ErreurStudio("HORS_SEANCE", "Cette version n'est pas dans la séance.");
    const fichier = await d.fichiers.obtenir(demande.fichierId);
    if (!fichier) throw new ErreurStudio("INTROUVABLE", "La prise n'est pas arrivée. Réessayez.");
    const v = await d.variantes.obtenir(demande.varianteId);
    if (!v || v.archiveLe) throw new ErreurStudio("INTROUVABLE", "Cette version n'existe plus.");

    const deja = await d.rushs.trouver((r) => r.fichierId === fichier.id);
    if (deja && v.videoId) return { rushId: deja.id, videoId: v.videoId, nom: deja.nom, suivanteId: prochaineVersion(s) };

    const { rush, videoId } = await rangerPriseDeVersion(v, fichier, { numero: nombrePrises(s.prises, v.id) + 1, dureeSec: demande.dureeSec, partie: demande.partie });

    const prises = [...s.prises, { varianteId: v.id, partie: "corps" as const, videoId, le: maintenant() }];
    const etat = etatSeance({ varianteIds: s.varianteIds, prises });
    await d.sessionsTournage.modifier(s.id, { prises, etat });
    await journaliser("tournage", `Prise rangée : ${rush.nom}`, { type: "video", id: videoId });
    return { rushId: rush.id, videoId, nom: rush.nom, suivanteId: prochaineVersion({ varianteIds: s.varianteIds, prises }) };
  });
}

/**
 * Range une prise sous sa version (prise brute nommée « code · prise n », vidéo de la version créée puis rangée à la
 * première prise, prise retenue). Partagé par la séance de tournage et les vidéos faites dans HeyGen (lot R7).
 * À appeler SOUS le verrou.
 */
export async function rangerPriseDeVersion(v: VarianteReseau, fichier: Pick<Fichier, "id" | "dureeSec">, o: { numero: number; dureeSec: number; partie?: "version" | "corps" | "debut" | "fin"; motsCles?: string[] }): Promise<{ rush: Rush; videoId: Id }> {
  const d = depots();
  const dureeSec = Number.isFinite(o.dureeSec) && o.dureeSec > 0 ? Math.round(o.dureeSec * 10) / 10 : 0;
  const rush: Rush = { id: nouvelId("rush"), nom: nomPrise(v.code, o.numero), fichierId: fichier.id, dureeSec, motsCles: [v.code, v.prompteur ? "je lis" : "j'improvise", ...(o.motsCles ?? [])], ...horodatage() };
  await d.rushs.enregistrer(rush);
  if (!fichier.dureeSec && dureeSec) await d.fichiers.modifier(fichier.id, { dureeSec });
  return { rush, videoId: await ajouterPriseAVideo(v, rush, o.partie) };
}

/**
 * Ajoute une prise brute déjà enregistrée à la vidéo de la version (créée si besoin). Sert aussi à COMPLÉTER un
 * rangement interrompu entre les deux écritures (relecture exactitude R7 `3042b94`, n° 4).
 */
export async function ajouterPriseAVideo(v: VarianteReseau, rush: Rush, partie?: "version" | "corps" | "debut" | "fin"): Promise<Id> {
  const d = depots();
  const videoId = v.videoId ?? (await creerVideoDeVersion(v));
  const video = (await d.videos.obtenir(videoId))!;
  const avant = (video.entrees as Partial<PrisesVideo>).prises ?? [];
  const entrees: PrisesVideo = { origine: "tournage", prises: [...avant, { rushId: rush.id, fichierId: rush.fichierId, dureeSec: rush.dureeSec, le: maintenant(), ...(partie && partie !== "version" ? { partie } : {}) }], priseRetenueId: rush.id };
  await d.videos.modifier(videoId, { entrees: { ...video.entrees, ...entrees } });
  if (!v.videoId) await rangerVideo(videoId, v.id);
  return videoId;
}

/** Vidéo de la version (comme la fabrication intérimaire : le texte assemblé de la version devient son script). */
async function creerVideoDeVersion(v: VarianteReseau): Promise<Id> {
  const d = depots();
  const script = await d.scripts.obtenir(v.scriptId);
  const m = await d.scriptsMaitres.obtenir(v.scriptMaitreId);
  const assemble: Script = { ...(script as Script), id: nouvelId("script"), blocs: assemblerBlocs({ blocs: script?.blocs ?? [] }, v), version: 1, parentId: undefined, creePourVideoId: undefined, sujet: m?.angle?.titre ?? script?.sujet ?? "", statutEditorial: "valide", ...horodatage() };
  await d.scripts.enregistrer(assemble);
  const { creerBrouillon } = await import("./videos");
  const { ratiosDeLaVersion } = await import("./fabrication-reseaux");
  // Formats par réseau T5 : la version dans le format de SON réseau, par la règle même du prix (`ratiosDeLaVersion`).
  const id = await creerBrouillon(v.formatId, { scriptId: assemble.id, reseaux: [v.reseau], ratios: await ratiosDeLaVersion(v) });
  await d.scripts.modifier(assemble.id, { creePourVideoId: id });
  await d.videos.modifier(id, { titre: `${v.code} · ${assemble.sujet || "prise"}` } satisfies Partial<Video>);
  return id;
}

/** « Prise ratée, on recommence » : la dernière prise de la version est marquée ratée (gardée), la version est à refaire. */
export async function priseRatee(seanceId: Id, varianteId: Id): Promise<void> {
  await exigerSession();
  await sousVerrou(async () => {
    const d = depots();
    const s = await d.sessionsTournage.obtenir(seanceId);
    if (!s) throw new ErreurStudio("INTROUVABLE", "Cette séance n'existe plus.");
    const i = s.prises.map((p) => p.varianteId).lastIndexOf(varianteId);
    if (i < 0 || s.prises[i].ratee) return;
    const prises = s.prises.map((p, k) => (k === i ? { ...p, ratee: true } : p));
    await d.sessionsTournage.modifier(s.id, { prises, etat: etatSeance({ varianteIds: s.varianteIds, prises }) });
    const videoId = s.prises[i].videoId;
    const video = videoId ? await d.videos.obtenir(videoId) : null;
    if (video) {
      const e = video.entrees as Partial<PrisesVideo>;
      const liste = (e.prises ?? []).map((p, k, t) => (k === t.length - 1 ? { ...p, ratee: true } : p));
      await d.videos.modifier(video.id, { entrees: { ...video.entrees, prises: liste, priseRetenueId: undefined } });
    }
    await journaliser("tournage", "Prise ratée, à refaire", { type: "seance", id: s.id });
  });
}
