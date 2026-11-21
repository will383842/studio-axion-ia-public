/**
 * AUD-4 · DÉPÔT MANUEL DU FILM DE NAVIGATION du tutoriel d'outil. SENSIBLE SÉCURITÉ (fichier déposé).
 *
 * Quand l'équipe est allumée, la vidéo s'arrête sur `TO_FILM_A_CAPTURER` : le film se fait sur le poste de capture. Ici,
 * Williams le dépose à la main : le fichier vidéo (mp4 ou webm, déjà envoyé par la zone de dépôt, même stockage que le dossier
 * zip) et le `navigation.json` qui l'accompagne (le contrat `navigation-filmee.v1`, relu par `lireNavigationFilmee`).
 * Le service range `entrees.tutorielOutil.navigationFilmee` dans la vidéo ET dans la commande figée de la version en cours
 * (modèle : `validerTutoriel`), puis sort le travail de sa pause : la boucle reprend au tour suivant.
 *
 * Aucun appel payant, aucun octet lu ici (seule la fiche du fichier est contrôlée) : 0 €. La capture AUTOMATIQUE par le poste
 * 51b est HORS de ce lot. Le `videoCle` du film est TOUJOURS la clé de stockage du fichier déposé, jamais celle du JSON.
 */
import "server-only";
import type { Fichier, Id, Travail } from "@/domaine/types";
import { TAILLE_MAX_ENVOI } from "@/formats";
import { lireNavigationFilmee } from "@/briques/plan-scenes/tutoriel/navigation-filmee";
import { ENTREE_TUTORIEL } from "@/moteurs/montage-tutoriel-outil/entrees";
import { depots, ErreurStudio } from "./_commun";
import { exigerSession } from "./auth";

export const CODE_FILM_A_CAPTURER = "TO_FILM_A_CAPTURER";
/** Le `navigation.json` n'est qu'un petit descriptif : au-delà, ce n'est pas le bon fichier. */
export const TAILLE_NAVIGATION_MAX = 256 * 1024;
export const FORMATS_FILM: Readonly<Record<string, readonly string[]>> = { "video/mp4": ["mp4"], "video/webm": ["webm"] };

export type IssueFilm = { statut: "ok"; phrase: string } | { statut: "refusee"; phrase: string };

export interface DemandeFilm {
  /** Le film déjà envoyé (`typeEntite: "entree"`, `entiteId` : la vidéo). */
  fichierId: unknown;
  /** Le contenu texte de `navigation.json`. */
  navigation?: unknown;
}

export interface DependancesFilm {
  fichier?: (fichierId: string, videoId: Id) => Promise<Pick<Fichier, "id" | "nom" | "mime" | "taille" | "cleStockage">>;
}

const refus = (phrase: string): IssueFilm => ({ statut: "refusee", phrase });
const objet = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

async function fichierParDefaut(fichierId: string, videoId: Id) {
  const { fichierEnvoye } = await import("./fichiers");
  return fichierEnvoye(fichierId, "entree", videoId);
}

async function derniereFabrication(videoId: Id): Promise<Travail | null> {
  const liste = await depots().travaux.lister((t) => t.cibleId === videoId && t.type === "fabrication");
  return liste.sort((a, b) => b.creeLe.localeCompare(a.creeLe))[0] ?? null;
}

const pauseFilm = (t: Travail | null): boolean => objet(t?.parametres?.pause) && t?.parametres?.pause.code === CODE_FILM_A_CAPTURER;

/** La page n'affiche le bloc « Déposer le film » que si la vidéo attend ce film. Lecture seule. */
export async function filmAttendu(videoId: Id): Promise<boolean> {
  await exigerSession();
  if (typeof videoId !== "string" || !videoId) return false;
  const video = await depots().videos.obtenir(videoId);
  if (!video) return false;
  return pauseFilm(await derniereFabrication(videoId));
}

function lireNavigationTexte(brut: unknown): { ok: true; valeur: Record<string, unknown> } | { ok: false; phrase: string } {
  if (typeof brut !== "string" || !brut.trim()) return { ok: false, phrase: "Déposez aussi le fichier navigation.json qui accompagne le film." };
  if (brut.length > TAILLE_NAVIGATION_MAX) return { ok: false, phrase: "Le fichier navigation.json est trop gros : ce n'est pas le bon fichier." };
  try {
    const v: unknown = JSON.parse(brut);
    if (!objet(v)) return { ok: false, phrase: "Le fichier navigation.json n'est pas lisible." };
    return { ok: true, valeur: v };
  } catch {
    return { ok: false, phrase: "Le fichier navigation.json n'est pas lisible." };
  }
}

export async function deposerFilmNavigation(videoId: Id, demande: DemandeFilm, dep: DependancesFilm = {}): Promise<IssueFilm> {
  await exigerSession();
  if (typeof videoId !== "string" || !videoId || !objet(demande)) return refus("Cette vidéo n'existe pas.");
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  if (!video) return refus("Cette vidéo n'existe pas.");
  const travail = await derniereFabrication(videoId);
  if (!travail || !pauseFilm(travail)) return refus("Cette vidéo n'attend pas de film pour le moment.");

  const fichierId = typeof demande.fichierId === "string" ? demande.fichierId : "";
  if (!fichierId) return refus("Envoyez d'abord le film.");
  let fichier: Awaited<ReturnType<NonNullable<DependancesFilm["fichier"]>>>;
  try {
    fichier = await (dep.fichier ?? fichierParDefaut)(fichierId, videoId);
  } catch (e) {
    return refus(e instanceof ErreurStudio ? e.message : "Ce film n'est pas arrivé. Envoyez-le à nouveau.");
  }
  const extensions = FORMATS_FILM[String(fichier.mime ?? "").toLowerCase()];
  const ext = (fichier.cleStockage ?? "").split(".").pop()?.toLowerCase() ?? "";
  const extNom = (fichier.nom ?? "").split(".").pop()?.toLowerCase() ?? "";
  if (!extensions || !extensions.includes(ext) || !extensions.includes(extNom)) return refus("Le film doit être un fichier vidéo mp4 ou webm.");
  if (!(fichier.taille > 0) || fichier.taille > TAILLE_MAX_ENVOI) return refus("Ce film est vide ou dépasse la taille permise.");
  const cle = fichier.cleStockage as string;

  const lu = lireNavigationTexte(demande.navigation);
  if (!lu.ok) return refus(lu.phrase);
  const nav = lireNavigationFilmee({ ...lu.valeur, videoCle: cle });
  if (!nav.ok) return refus(`Le fichier navigation.json n'est pas valable : ${nav.erreurs.slice(0, 3).join(" ")}`);

  const ecrire = (entrees: Record<string, unknown> | undefined): Record<string, unknown> => {
    const base = entrees ?? {};
    return { ...base, [ENTREE_TUTORIEL]: { ...(objet(base[ENTREE_TUTORIEL]) ? base[ENTREE_TUTORIEL] : {}), navigationFilmee: nav.navigation } };
  };
  await d.videos.modifier(videoId, { entrees: ecrire(video.entrees) });
  const version = travail.versionId ? await d.versions.obtenir(travail.versionId) : null;
  if (version) await d.versions.modifier(version.id, { commande: { ...version.commande, entrees: ecrire(version.commande.entrees) } });
  // Sortie de pause (même geste que la validation) : la boucle reprend au prochain tour.
  const { pause: _p, ...parametres } = travail.parametres ?? {};
  void _p;
  await d.travaux.modifier(travail.id, { statut: "en_cours", parametres });
  return { statut: "ok", phrase: "Le film est déposé : la vidéo reprend." };
}
