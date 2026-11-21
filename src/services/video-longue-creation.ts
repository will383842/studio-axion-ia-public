/**
 * UI-3 · LANCEMENT D'UNE VIDÉO LONGUE depuis le 4e écran : crée le brouillon (script validé = un bloc par chapitre),
 * range le choix « sans voix » (`entrees.videoLongue.sansVoix`) et, avec voix seulement, l'accord EXPLICITE de cette vidéo
 * (`entrees.videoLongue.accord`), puis lance par le chemin commun. Aucune garde d'argent n'est touchée : le moteur garde
 * le réglage, l'accord, le plafond et le chemin gardé ; ici on ne fait que préparer la commande.
 *
 * Éteint par défaut : seul `true` exact de `videoLongue.actif` ouvre. Options payantes coupées : refus (comme la page).
 * Sans voix : distribution vide, aucun accord, aucun appel HeyGen ni ElevenLabs.
 */
import "server-only";
import { decouperScript } from "@/briques/voix-longue";
import type { Distribution, Id, Ratio, Video } from "@/domaine/types";
import { depots, ErreurStudio, lireParametre } from "./_commun";
import { exigerSession } from "./auth";
import type { IssueLancement } from "./creation-format";
import { PARAM_OPTIONS_COUPEES } from "./options-payantes";

export const ID_FORMAT_VIDEO_LONGUE = "video-longue";
const PARAM_ACTIF = "videoLongue.actif";
export const TOTAL_CARACTERES_MAX = 60_000;
/**
 * Le montage AVEC voix n'est pas encore relié (UI-4 : MONTAGE_AVEC_VOIX_RELIE=false) : une vidéo créée avec voix resterait
 * en pause puis échouerait. À passer à true quand UI-4 reliera la voix.
 */
export const VOIX_VIDEO_LONGUE_RELIEE = false;

export const PHRASE_VIDEO_LONGUE_ETEINTE = "La vidéo longue est éteinte : rien n'est parti.";
export const PHRASE_DEPENSES_COUPEES = "Les options payantes sont coupées dans Réglages : rien n'est parti, rien n'est payé.";
export const PHRASE_CHAPITRES_VIDES = "Ajoutez au moins un chapitre avec du texte : rien n'est parti.";
export const PHRASE_CHAPITRES_INVALIDES = "Les chapitres ne sont pas valides (numéros en double) : rien n'est parti.";
export const PHRASE_TROP_LONG = "Le texte est trop long pour une vidéo longue (60 000 caractères au plus) : rien n'est parti.";
export const PHRASE_QUI_PARLE = "Choisissez qui parle : ajoutez d'abord votre double dans Personnages, ou choisissez « Sans voix ».";
export const PHRASE_VOIX_NON_RELIEE = "La vidéo longue avec voix n'est pas encore reliée : choisissez « Sans voix » pour la fabriquer dès maintenant.";
export const PHRASE_LANCEMENT_REFUSE = "Le lancement n'a pas pu se faire : votre demande n'est pas envoyée.";

export interface ChapitreDemande {
  id: string;
  titre: string;
  texte: string;
}

export interface DemandeVideoLongue {
  question: string;
  chapitres: ChapitreDemande[];
  /** Seul `true` exact = sans voix ; tout le reste = avec voix (défaut inchangé). */
  sansVoix?: unknown;
  /** Avec voix : l'accord explicite de cette vidéo. Seul `true` exact compte. */
  accordVoix?: unknown;
}

export type IssueVideoLongue = { statut: "lancee"; videoId: Id } | { statut: "refusee"; phrase: string };

export interface DependancesVideoLongueCreation {
  /** Voix reliée ? (défaut : VOIX_VIDEO_LONGUE_RELIEE). */
  voixReliee?: boolean;
  /** Lecture d'un réglage (défaut : la base). Une lecture qui lève éteint. */
  lire?: (cle: string, defaut: unknown) => Promise<unknown>;
  distribution?: (formatId: string) => Promise<Distribution[]>;
  brouillon?: (e: { titre: string; sujet: string; distribution: Distribution[]; entrees: Record<string, unknown> }) => Promise<Pick<Video, "id">>;
  /** Range le script (un bloc par chapitre), les formats et, le cas échéant, l'accord de cette vidéo. */
  preparer?: (videoId: Id, chapitres: ChapitreDemande[], accord: Record<string, unknown> | null) => Promise<void>;
  lancer?: (videoId: Id) => Promise<IssueLancement>;
  abandonner?: (videoId: Id) => Promise<void>;
}

const refus = (phrase: string): IssueVideoLongue => ({ statut: "refusee", phrase });

async function distributionParDefaut(formatId: string): Promise<Distribution[]> {
  const { distributionParDefaut: d } = await import("./videos");
  return d(formatId);
}

async function brouillonParDefaut(e: { titre: string; sujet: string; distribution: Distribution[]; entrees: Record<string, unknown> }) {
  const { nouveauBrouillonFormat } = await import("./creation-format");
  return nouveauBrouillonFormat({ formatId: ID_FORMAT_VIDEO_LONGUE, ...e });
}

async function preparerParDefaut(videoId: Id, chapitres: ChapitreDemande[], accord: Record<string, unknown> | null): Promise<void> {
  const { enregistrerScriptDuBrouillon } = await import("./videos");
  // Le lancement commun exige un script rattaché : un bloc par chapitre, un segment = le texte du chapitre.
  await enregistrerScriptDuBrouillon(
    videoId,
    chapitres.map((c, i) => ({ id: `${videoId}-b${i + 1}`, blocRecette: "chapitres", segments: [{ id: `${videoId}-s${i + 1}`, texte: c.texte }] })),
  );
  const d = depots();
  const ratios: Ratio[] = ["16:9"];
  if (!accord) {
    await d.videos.modifier(videoId, { ratios });
    return;
  }
  const v = await d.videos.obtenir(videoId);
  const entrees = (v?.entrees ?? {}) as Record<string, unknown>;
  const vl = (entrees.videoLongue ?? {}) as Record<string, unknown>;
  await d.videos.modifier(videoId, { ratios, entrees: { ...entrees, videoLongue: { ...vl, accord: { ...accord, videoId } } } });
}

async function lancerParDefaut(videoId: Id): Promise<IssueLancement> {
  const { lancerAvecAccord } = await import("./creation-format");
  // Le réglage est rafraîchi côté moteur avant le lancement. `rafraichirVideoLongueActif` arrive avec le lot UI-4 : import
  // tolérant, sans effet tant que l'export n'existe pas.
  const m: object = await import("./video-longue-branchements");
  const rafraichir = (m as { rafraichirVideoLongueActif?: unknown }).rafraichirVideoLongueActif;
  if (typeof rafraichir === "function") await (rafraichir as () => Promise<unknown>)();
  // Format sans prix : montant nul. Le moteur garde lui-même le réglage, l'accord et le plafond avant tout appel payant.
  return lancerAvecAccord(videoId, 0, 0);
}

async function abandonnerParDefaut(videoId: Id): Promise<void> {
  const { abandonnerBrouillon } = await import("./videos");
  await abandonnerBrouillon(videoId);
}

/** Chapitres propres (sans les chapitres vides), ou la raison du refus (« vides », « invalides », « trop-long ») : l'appelant choisit la phrase. */
function chapitresPropres(brut: unknown): ChapitreDemande[] | "vides" | "invalides" | "trop-long" {
  if (!Array.isArray(brut)) return "vides";
  const liste: ChapitreDemande[] = [];
  for (const c of brut) {
    if (!c || typeof c !== "object") return "invalides";
    const { id, titre, texte } = c as Record<string, unknown>;
    if (typeof id !== "string" || id === "" || typeof texte !== "string") return "invalides";
    liste.push({ id, titre: typeof titre === "string" ? titre : "", texte: texte.trim() });
  }
  if (new Set(liste.map((c) => c.id)).size !== liste.length) return "invalides";
  if (!liste.some((c) => c.texte !== "")) return "vides";
  if (liste.reduce((s, c) => s + c.texte.length, 0) > TOTAL_CARACTERES_MAX) return "trop-long";
  return liste.filter((c) => c.texte !== "");
}

/**
 * Le lancement. Session exigée, réglage allumé (`true` exact), options payantes non coupées, chapitres valides, brouillon,
 * script, formats, accord (avec voix, s'il est donné), lancement commun ; lancement refusé : brouillon abandonné.
 */
export async function lancerVideoLongue(demande: DemandeVideoLongue, dep: DependancesVideoLongueCreation = {}): Promise<IssueVideoLongue> {
  await exigerSession();
  const lire = dep.lire ?? ((cle, defaut) => lireParametre<unknown>(cle, defaut));
  const allume = async (cle: string): Promise<boolean> => {
    try {
      if (!dep.lire && cle === PARAM_ACTIF) return await (await import("./reglage-video-longue")).lireVideoLongueActif();
      return (await lire(cle, false)) === true;
    } catch {
      return false;
    }
  };
  if (!(await allume(PARAM_ACTIF))) return refus(PHRASE_VIDEO_LONGUE_ETEINTE);
  if (await allume(PARAM_OPTIONS_COUPEES)) return refus(PHRASE_DEPENSES_COUPEES);

  const chapitres = chapitresPropres(demande?.chapitres);
  if (chapitres === "vides") return refus(PHRASE_CHAPITRES_VIDES);
  if (chapitres === "invalides") return refus(PHRASE_CHAPITRES_INVALIDES);
  if (chapitres === "trop-long") return refus(PHRASE_TROP_LONG);

  const sansVoix = demande.sansVoix === true;
  // Avant toute création : tant que la voix n'est pas reliée, le mode avec voix est refusé proprement.
  if (!sansVoix && !(dep.voixReliee ?? VOIX_VIDEO_LONGUE_RELIEE)) return refus(PHRASE_VOIX_NON_RELIEE);
  let distribution: Distribution[] = [];
  if (!sansVoix) {
    try {
      distribution = await (dep.distribution ?? distributionParDefaut)(ID_FORMAT_VIDEO_LONGUE);
    } catch (e) {
      return refus(e instanceof ErreurStudio ? e.message : PHRASE_QUI_PARLE);
    }
    if (distribution.length === 0 || !distribution[0]?.personnageId) return refus(PHRASE_QUI_PARLE);
  }

  const question = (typeof demande.question === "string" ? demande.question : "").replace(/\s+/g, " ").trim();
  const titre = (question || "Vidéo longue").slice(0, 80);
  let accord: Record<string, unknown> | null = null;
  if (!sansVoix && demande.accordVoix === true) {
    const morceaux = decouperScript(chapitres.map((c) => ({ id: c.id, texte: c.texte })));
    const caracteres = morceaux.reduce((s, m) => s + m.texte.length, 0);
    accord = { donne: true, caracteres, morceaux: morceaux.length };
  }

  const video = await (dep.brouillon ?? brouillonParDefaut)({
    titre,
    sujet: titre,
    distribution,
    entrees: { videoLongue: { chapitres: chapitres.map((c) => ({ id: c.id, titre: c.titre, texte: c.texte })), ...(sansVoix ? { sansVoix: true } : {}) } },
  });
  const abandonner = () => (dep.abandonner ?? abandonnerParDefaut)(video.id).catch(() => undefined);
  try {
    await (dep.preparer ?? preparerParDefaut)(video.id, chapitres, accord);
    const issue = await (dep.lancer ?? lancerParDefaut)(video.id);
    if (issue.statut !== "lancee") {
      await abandonner();
      return refus(PHRASE_LANCEMENT_REFUSE);
    }
    return { statut: "lancee", videoId: video.id };
  } catch (e) {
    await abandonner();
    if (e instanceof ErreurStudio) return refus(e.message);
    throw e;
  }
}
