/**
 * T-EXT-34 · SUIVI DE FABRICATION du tutoriel d'outil : lecture du travail et de la vidéo (session exigée) et pose des
 * notifications de la CLOCHE, une seule fois par événement. Aucun envoi sur téléphone ni e-mail (cloche seulement), aucun
 * type de notification neuf, aucun appel payant. ALLUMÉ par défaut (décision 21/11 07:20, gratuit) : seul `false` écrit
 * au réglage « tutoriel.suiviCloche » l'éteint ; une lecture en panne ne l'allume jamais.
 * Une notification ne cite jamais le texte du script (les paroles de Williams) : seulement le titre de la vidéo et le rôle.
 * Dédoublonnage SANS champ neuf : la clé « tutoriel:<videoId>:<rôle>:<état> » est portée par `lien` + `titre`.
 */
import "server-only";
import type { Notification, Travail, TypeNotification } from "@/domaine/types";
import type { IdRole } from "@/moteurs/montage-tutoriel-outil/journal-roles";
import { grilleProposable, vueRoles, type LigneRole } from "@/moteurs/montage-tutoriel-outil/vue-roles";
import { depots, lireParametre } from "./_commun";
import { exigerSession } from "./auth";
import { derniereFabricationDeLaVideo } from "./travaux";
import type { VueTravail } from "./vues";

export const REGLAGE_SUIVI_CLOCHE = "tutoriel.suiviCloche";

export const lienSuivi = (videoId: string): string => `/tutoriel-outil/suivi/${videoId}`;

export interface SuiviVideo {
  videoId: string;
  titreVideo: string;
  travail: VueTravail | null;
}

/** Ce que l'écran montre : la vidéo et sa dernière fabrication. Session exigée ; `null` si la vidéo n'existe pas. */
export async function lireSuivi(videoId: string): Promise<SuiviVideo | null> {
  await exigerSession();
  const video = await depots().videos.obtenir(videoId);
  if (!video) return null;
  return { videoId, titreVideo: video.titre, travail: await derniereFabricationDeLaVideo(videoId) };
}

export type CreerCloche = (n: { type: TypeNotification; titre: string; message: string; lien: string }, options: { cloche: true }) => Promise<unknown>;

/** Cloche réelle (chargée à l'usage) : « cloche seulement », jamais de téléphone ni d'e-mail. */
async function creerClocheReelle(n: Parameters<CreerCloche>[0], options: { cloche: true }): Promise<unknown> {
  const { creerNotification } = await import("./notifications");
  return creerNotification(n, options);
}

export interface DependancesSuivi {
  /** Remplace la cloche réelle (tests). */
  creer?: CreerCloche;
  /** Remplace la lecture du réglage (tests). */
  actif?: boolean;
}

interface Evenement {
  cle: string;
  role: IdRole | "travail";
  etat: string;
  type: TypeNotification;
  titre: string;
  message: string;
}

/** Les événements à signaler pour ce travail (PUR, sans dédoublonnage). */
function evenements(travail: Travail, titreVideo: string): Evenement[] {
  const dessus = (cle: string, role: IdRole | "travail", etat: string, type: TypeNotification, titre: string, message: string): Evenement => ({ cle, role, etat, type, titre, message });
  const sortie: Evenement[] = [];
  const lignes = vueRoles(travail);
  const nom = (l: LigneRole) => l.libelle;
  for (const l of lignes) {
    if (l.etat === "attend-williams") sortie.push(dessus(`${l.role}:attend-williams`, l.role, l.etat, "plan-a-verifier", `Votre tutoriel attend votre choix · ${nom(l)}`, `« ${titreVideo} » : ${l.phrase}`));
    if (l.etat === "a-revoir" && (l.role === "controleur" || l.role === "regardeur")) sortie.push(dessus(`${l.role}:a-revoir`, l.role, l.etat, "plan-a-verifier", `Un point est à revoir avant de vous montrer la vidéo · ${nom(l)}`, `« ${titreVideo} » : ${l.phrase}`));
  }
  if (travail.statut === "echec") {
    const essai = travail.tentatives > 1 ? ` (essai ${travail.tentatives})` : "";
    sortie.push(dessus("travail:echec", "travail", "echec", "echec", `Votre tutoriel s'est arrêté${essai}`, `« ${titreVideo} » : ${travail.erreur?.messagePourWill ?? "la fabrication s'est arrêtée. Vous pouvez la relancer."}`));
  }
  if (travail.statut === "termine" && grilleProposable(travail)) sortie.push(dessus("travail:video-prete", "travail", "video-prete", "video-prete", "Votre tutoriel est prêt", `« ${titreVideo} » est prêt à être regardé.`));
  return sortie;
}

/** Cloche allumée par défaut : seul `false` l'éteint ; lecture en panne = éteint. */
async function lireCloche(): Promise<boolean> {
  try {
    return (await lireParametre<boolean>("tutoriel.suiviCloche", true)) !== false;
  } catch {
    return false;
  }
}

/**
 * Pose au plus UNE notification de la cloche par (vidéo, rôle, état). Rend les titres posés cette fois-ci.
 * Éteint (réglage `false`, ou lecture en panne) : ne pose rien ; réglage absent : allumé.
 */
export async function signalerSuivi(travail: Travail, dependances: DependancesSuivi = {}): Promise<string[]> {
  const actif = dependances.actif ?? (await lireCloche());
  if (!actif) return [];
  const video = await depots().videos.obtenir(travail.cibleId);
  if (!video) return [];
  const lien = lienSuivi(video.id);
  const creer: CreerCloche = dependances.creer ?? creerClocheReelle;
  const deja: Notification[] = await depots().notifications.lister((n) => n.lien === lien);
  const titres = new Set(deja.map((n) => n.titre));
  const posees: string[] = [];
  for (const e of evenements(travail, video.titre)) {
    if (titres.has(e.titre)) continue;
    await creer({ type: e.type, titre: e.titre, message: e.message, lien }, { cloche: true });
    titres.add(e.titre);
    posees.push(e.titre);
  }
  return posees;
}
